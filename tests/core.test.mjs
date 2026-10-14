import test from 'node:test';
import assert from 'node:assert/strict';
import { allocate, calculateBill, validateBill, validateStore, canRemoveMember, removeMember, sampleBill, LIMITS } from '../docs/core.js';

const makeBill = (items = [], mode = 'items') => ({
  id: 'test', name: 'Meal', date: '2026-10-14', mode, defaultPayer: 'a',
  members: ['a', 'b', 'c'].map(id => ({ id, name: id })), items
});
const item = (amount, participants = ['a', 'b', 'c'], payer = 'a', id = 'food') => ({ id, name: 'Food', amount, participants, payer });
const sum = values => values.reduce((a, b) => a + b, 0);

function assertConservation(bill) {
  const result = calculateBill(bill);
  assert.equal(sum(result.people.map(p => p.owed)), result.total);
  assert.equal(sum(result.people.map(p => p.paid)), result.total);
  assert.equal(sum(result.people.map(p => p.balance)), 0);
  const remaining = new Map(result.people.map(p => [p.id, p.balance]));
  for (const transfer of result.transfers) {
    assert.ok(Number.isSafeInteger(transfer.amount) && transfer.amount > 0);
    assert.notEqual(transfer.from, transfer.to);
    remaining.set(transfer.from, remaining.get(transfer.from) + transfer.amount);
    remaining.set(transfer.to, remaining.get(transfer.to) - transfer.amount);
  }
  assert.ok([...remaining.values()].every(v => v === 0));
  assert.ok(result.transfers.length <= Math.max(0, bill.members.length - 1));
}

test('450,000 kip sample correctly nets two payers', () => {
  const r = calculateBill(sampleBill());
  assert.equal(r.total, 450000);
  assert.deepEqual(r.people.map(p => [p.owed, p.paid]), [[90000, 360000], [120000, 90000], [120000, 0], [120000, 0]]);
  assert.deepEqual(r.transfers, [{ from: 'keo', to: 'joey', amount: 120000 }, { from: 'bee', to: 'joey', amount: 120000 }, { from: 'noy', to: 'joey', amount: 30000 }]);
});
test('equal split divides total once and retains item participation', () => {
  const b = makeBill([item(10, ['a']), item(10, ['b'], 'b', 'two')], 'equal');
  assert.deepEqual(calculateBill(b).people.map(p => p.owed), [7, 7, 6]);
  assert.deepEqual(b.items[0].participants, ['a']);
});
test('item split excludes non-consumers even if they paid', () => {
  const r = calculateBill(makeBill([item(60000, ['b', 'c'])]));
  assert.deepEqual(r.people.map(p => p.owed), [0, 30000, 30000]);
  assert.deepEqual(r.transfers, [{ from: 'b', to: 'a', amount: 30000 }, { from: 'c', to: 'a', amount: 30000 }]);
});
test('integer remainders remain exact including 1 kip among three people', () => {
  assert.deepEqual(allocate(100, ['a', 'b', 'c']), { a: 34, b: 33, c: 33 });
  assert.deepEqual(allocate(1, ['a', 'b', 'c']), { a: 1, b: 0, c: 0 });
  assertConservation(makeBill([item(100)]));
});
test('participant ordering does not change rounding order', () => {
  assert.deepEqual(calculateBill(makeBill([item(100, ['c', 'b', 'a'])])).people.map(p => p.owed), [34, 33, 33]);
});
test('single member pays only their own consumption', () => {
  const b = makeBill([item(50000, ['a'])]); b.members = [{ id: 'a', name: 'A' }];
  assert.equal(calculateBill(b).transfers.length, 0); assertConservation(b);
});
test('empty bill and zero members produce no transfers', () => {
  assert.equal(calculateBill(makeBill()).total, 0);
  const b = makeBill(); b.members = []; b.defaultPayer = '';
  assert.deepEqual(calculateBill(b), { total: 0, people: [], transfers: [] });
});
test('multiple payers who covered their own shares owe no transfer', () => {
  const b = makeBill([item(300, ['a', 'b', 'c'], 'a'), item(300, ['a', 'b', 'c'], 'b', 'two'), item(300, ['a', 'b', 'c'], 'c', 'three')]);
  assert.equal(calculateBill(b).transfers.length, 0);
});
test('invalid money and missing payer or participants are rejected', () => {
  for (const amount of [-1, 0, 0.5, NaN, Infinity, LIMITS.amount + 1]) assert.throws(() => calculateBill(makeBill([item(amount)])));
  for (const participants of [[], ['missing'], ['a', 'a']]) assert.throws(() => calculateBill(makeBill([item(100, participants)])));
  assert.throws(() => calculateBill(makeBill([item(100, ['a'], 'missing')])));
});
test('payer and sole consumer cannot be removed', () => {
  assert.equal(canRemoveMember(makeBill([item(60)]), 'a'), 'payer');
  assert.equal(canRemoveMember(makeBill([item(60, ['b'])]), 'b'), 'sole');
  assert.throws(() => removeMember(makeBill([item(60)]), 'a'));
});
test('removing a member updates participation without mutating the original', () => {
  const b = makeBill([item(60)]), next = removeMember(b, 'c');
  assert.deepEqual(next.items[0].participants, ['a', 'b']);
  assert.deepEqual(b.items[0].participants, ['a', 'b', 'c']);
  assertConservation(next);
});
test('deleting the last member of an empty bill is valid', () => {
  const b = makeBill(); b.members = [{ id: 'a', name: 'A' }];
  const next = removeMember(b, 'a');
  assert.equal(next.defaultPayer, ''); assert.equal(validateBill(next), true);
});
test('backup roundtrip preserves full calculation', () => {
  const b = sampleBill(), backup = { version: 1, bills: [b] };
  const parsed = validateStore(JSON.parse(JSON.stringify(backup)));
  assert.deepEqual(calculateBill(parsed.bills[0]), calculateBill(b));
  assert.throws(() => validateStore({ version: 99, bills: [] }));
  assert.throws(() => validateStore({ version: 1, bills: [b, b] }));
});
test('duplicate names, member IDs and item IDs are rejected', () => {
  const b = makeBill(); b.members[1].name = 'A'; assert.throws(() => validateBill(b));
  const c = makeBill(); c.members[1].id = 'a'; assert.throws(() => validateBill(c));
  assert.throws(() => validateBill(makeBill([item(50), item(60)])));
});
test('maximum-size bill stays within safe integer precision', () => {
  const b = makeBill(Array.from({ length: 300 }, (_, i) => item(LIMITS.amount, ['a', 'b', 'c'], ['a', 'b', 'c'][i % 3], String(i))));
  assert.equal(calculateBill(b).total, 300_000_000_000); assertConservation(b);
});
test('500 deterministic mixed bills conserve every kip and settle every balance', () => {
  let seed = 104729;
  const random = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
  for (let run = 0; run < 500; run++) {
    const members = Array.from({ length: 2 + random(12) }, (_, i) => ({ id: String(i), name: `Member ${i}` }));
    const b = { ...makeBill(), members, defaultPayer: '0', mode: run % 2 ? 'equal' : 'items', items: [] };
    for (let j = 0, n = random(30); j < n; j++) {
      const participants = members.filter(() => random(2)).map(p => p.id);
      if (!participants.length) participants.push(members[0].id);
      b.items.push(item(1 + random(10000000), participants, members[random(members.length)].id, String(j)));
    }
    assertConservation(b);
  }
});
