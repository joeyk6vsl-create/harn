/** Pure money and persistence rules. All amounts are integer Lao kip. */
export const LIMITS = Object.freeze({ amount: 1_000_000_000, members: 40, items: 300, bills: 100 });

export function allocate(amount, ids) {
  if (!Number.isSafeInteger(amount) || amount < 0 || ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error('Invalid allocation');
  }
  const base = Math.floor(amount / ids.length);
  const remainder = amount % ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, base + (i < remainder ? 1 : 0)]));
}

export const lineTotal = item => item.amount * (item.quantity ?? 1);
export function validateGroup(group) {
  if (!group || typeof group.id !== 'string' || !group.id || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 100 || !Array.isArray(group.members) || !group.members.length) throw new Error('Invalid group');
  validateBill({id:group.id,name:group.name,date:'2026-01-01',mode:'items',members:group.members,items:[],defaultPayer:group.members[0].id});
  return group;
}
export function validateBill(bill) {
  if (!bill || typeof bill !== 'object') throw new Error('Invalid bill');
  const validText = (s, max = 100) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;
  if (!validText(bill.id) || !validText(bill.name) || !/^\d{4}-\d{2}-\d{2}$/.test(bill.date) || !['equal', 'items'].includes(bill.mode)) throw new Error('Invalid bill details');
  if (!Array.isArray(bill.members) || bill.members.length > LIMITS.members || !Array.isArray(bill.items) || bill.items.length > LIMITS.items) throw new Error('Invalid bill size');
  const ids = new Set();
  const names = new Set();
  for (const member of bill.members) {
    if (!validText(member.id) || !validText(member.name, 40) || ids.has(member.id) || names.has(member.name.trim().toLocaleLowerCase())) throw new Error('Invalid member');
    ids.add(member.id);
    names.add(member.name.trim().toLocaleLowerCase());
  }
  if (bill.members.length && !ids.has(bill.defaultPayer)) throw new Error('Invalid default payer');
  if (!bill.members.length && bill.items.length) throw new Error('Items require members');
  const itemIds = new Set();
  for (const item of bill.items) {
    if (!validText(item.id) || itemIds.has(item.id) || !validText(item.name) || !Number.isSafeInteger(item.amount) || item.amount <= 0 || item.amount > LIMITS.amount) throw new Error('Invalid item');
    if (!Number.isSafeInteger(item.quantity ?? 1) || (item.quantity ?? 1) < 1 || (item.quantity ?? 1) > 999 || lineTotal(item) > LIMITS.amount) throw new Error('Invalid quantity');
    if (!ids.has(item.payer) || !Array.isArray(item.participants) || item.participants.length === 0 || new Set(item.participants).size !== item.participants.length || item.participants.some(id => !ids.has(id))) throw new Error('Invalid item participants or payer');
    itemIds.add(item.id);
  }
  return true;
}

export function calculateBill(bill) {
  validateBill(bill);
  const people = bill.members.map(member => ({ ...member, owed: 0, paid: 0, balance: 0 }));
  const byId = Object.fromEntries(people.map(person => [person.id, person]));
  const total = bill.items.reduce((sum, item) => sum + lineTotal(item), 0);
  for (const item of bill.items) {
    byId[item.payer].paid += lineTotal(item);
    if (bill.mode === 'items') {
      // Member order is stable, so residual kip are assigned deterministically.
      const ids = bill.members.filter(p => item.participants.includes(p.id)).map(p => p.id);
      for (const [id, amount] of Object.entries(allocate(lineTotal(item), ids))) byId[id].owed += amount;
    }
  }
  if (bill.mode === 'equal' && people.length) {
    for (const [id, amount] of Object.entries(allocate(total, people.map(p => p.id)))) byId[id].owed = amount;
  }
  for (const person of people) person.balance = person.paid - person.owed;
  const debtors = people.filter(p => p.balance < 0).map(p => ({ id: p.id, amount: -p.balance })).sort((a, b) => b.amount - a.amount);
  const creditors = people.filter(p => p.balance > 0).map(p => ({ id: p.id, amount: p.balance })).sort((a, b) => b.amount - a.amount);
  const transfers = [];
  let d = 0, c = 0;
  // Net balances into a short, deterministic plan; not a claim of global optimality.
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    transfers.push({ from: debtors[d].id, to: creditors[c].id, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (!debtors[d].amount) d++;
    if (!creditors[c].amount) c++;
  }
  return { total, people, transfers };
}

/** Removal is refused when it would silently change payments or leave an item unassigned. */
export function canRemoveMember(bill, id) {
  if (bill.items.some(item => item.payer === id)) return 'payer';
  if (bill.items.some(item => item.participants.length === 1 && item.participants[0] === id)) return 'sole';
  return null;
}

export function removeMember(bill, id) {
  const reason = canRemoveMember(bill, id);
  if (reason) throw new Error(reason);
  const next = structuredClone(bill);
  next.members = next.members.filter(member => member.id !== id);
  next.items = next.items.map(item => ({ ...item, participants: item.participants.filter(p => p !== id) }));
  if (next.defaultPayer === id) next.defaultPayer = next.members[0]?.id ?? '';
  return next;
}

export function validateStore(value) {
  if (!value || ![1, 2].includes(value.version) || !Array.isArray(value.bills) || value.bills.length > LIMITS.bills) throw new Error('Invalid backup');
  const ids = new Set();
  value.bills.forEach(bill => { validateBill(bill); if (ids.has(bill.id)) throw new Error('Duplicate bill'); ids.add(bill.id); });
  const groups = value.version === 1 ? [] : value.groups;
  if (!Array.isArray(groups) || groups.length > 100) throw new Error('Invalid groups');
  const groupIds = new Set();
  for (const group of groups) { validateGroup(group); if (groupIds.has(group.id)) throw new Error('Duplicate group'); groupIds.add(group.id); }
  return {version:2, groups:structuredClone(groups), bills:value.bills.map(b => ({...structuredClone(b),items:b.items.map(i=>({...structuredClone(i),quantity:i.quantity ?? 1}))}))};
}

export const money = amount => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount);
export const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function sampleBill() {
  return {
    id: uid(), name: 'ມື້ແລງກັບໝູ່', date: localDate(), mode: 'items', defaultPayer: 'joey', demo: true,
    members: [{ id: 'joey', name: 'Joey' }, { id: 'noy', name: 'ນ້ອຍ' }, { id: 'keo', name: 'ແກ້ວ' }, { id: 'bee', name: 'ບີ' }],
    items: [
      { id: 'i1', name: 'ປີ້ງໄກ່', amount: 120000, participants: ['joey', 'noy', 'keo', 'bee'], payer: 'joey' },
      { id: 'i2', name: 'ຕຳໝາກຫຸ່ງ', amount: 50000, participants: ['joey', 'noy', 'keo', 'bee'], payer: 'joey' },
      { id: 'i3', name: 'ເຂົ້າໜຽວ', amount: 40000, participants: ['joey', 'noy', 'keo', 'bee'], payer: 'joey' },
      { id: 'i4', name: 'ປານຶ່ງ', amount: 150000, participants: ['joey', 'noy', 'keo', 'bee'], payer: 'joey' },
      { id: 'i5', name: 'ເຄື່ອງດື່ມ', amount: 90000, participants: ['noy', 'keo', 'bee'], payer: 'noy' }
    ]
  };
}
