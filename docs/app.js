import { lineTotal, validateGroup, LIMITS, calculateBill, canRemoveMember, removeMember, validateStore, money, localDate, uid, sampleBill } from './core.js';

const KEY = 'haan.bills.v1';
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M4 12h16M15 7l5 5-5 5"/>',
  back: '<path d="M20 12H4m5-5-5 5 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  trash: '<path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>',
  edit: '<path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5"/>',
  wallet: '<path d="M20 7V4H5a2 2 0 0 0 0 4h16v12H5a2 2 0 0 1-2-2V6"/><path d="M21 12h-6v4h6"/>',
  food: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M20 21V3c-5 2-5 10 0 10"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c-.5 1.2-2.9 1.5-2.9 3M12 17h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',
  equal: '<path d="M5 8h14M5 16h14"/>',
  split: '<path d="M12 21V12M12 12 5 5m7 7 7-7M3 10V3h7M14 3h7v7"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  leaf: '<path d="M20 4C8 1 1 10 7 17S23 17 20 4ZM4 21l12-12"/>'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.receipt}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const app = document.querySelector('#app');
const dialog = document.querySelector('#dialog');
let storageIssue = '';
let store;
try {
  const raw = localStorage.getItem(KEY);
  store = raw ? validateStore(JSON.parse(raw)) : { version: 2, groups: [], bills: [] };
} catch {
  store = { version: 2, groups: [], bills: [] };
  storageIssue = 'ບໍ່ສາມາດອ່ານຂໍ້ມູນເກົ່າໄດ້. ກະລຸນາສຳຮອງຂໍ້ມູນ ຫຼືນຳເຂົ້າໄຟລ໌ສຳຮອງ.';
}
let currentId = store.bills[0]?.id;
let view = 'bill';
let navOpen = false;
let toastTimer;
let pendingImport = null;
let lastFocus = null;
const current = () => store.bills.find(b => b.id === currentId);
const avatar = (member, index = 0, small = false) => `<span class="avatar color-${index % 6} ${small ? 'small' : ''}" title="${esc(member.name)}">${esc([...member.name][0])}</span>`;
const formatDate = date => { const [y, m, d] = date.split('-'); return `${Number(d)} / ${Number(m)} / ${y}`; };

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); storageIssue = ''; return true; }
  catch { storageIssue = 'ບັນທຶກບໍ່ສຳເລັດ. ກະລຸນາດາວໂຫຼດໄຟລ໌ສຳຮອງກ່ອນປິດໜ້ານີ້.'; toast(storageIssue); return false; }
}

function commit() { const saved = persist(); render(); return saved; }
function toast(message) {
  const el = document.querySelector('#toast');
  el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4500);
}

function render() {
  const bill = current();
  const recent = store.bills.slice(0, 6);
  app.innerHTML = `
    <div class="shell ${navOpen ? 'nav-open' : ''}">
      <button class="nav-scrim" data-action="menu" aria-label="ປິດເມນູ"></button>
      <aside class="sidebar" aria-label="ເມນູຫຼັກ">
        <a href="#" class="brand" data-action="home" aria-label="Haan ໜ້າຫຼັກ"><span class="brand-mark"><span></span><b></b><span></span></span><span>haan<span class="brand-period">.</span></span></a>
        <div class="brand-subtitle">ມື້ດີໆ, ຫານກັນໄດ້.</div>
        <button class="btn btn-primary sidebar-create" data-action="new">${icon('plus')} ສ້າງບິນໃໝ່</button>
        <nav class="nav-links"><button class="nav-link" data-action="groups">${icon("people")} ກຸ່ມໝູ່</button>
          <button class="nav-link ${view === 'bill' ? 'active' : ''}" data-action="home">${icon('grid')} ບິນປັດຈຸບັນ</button>
          <button class="nav-link ${view === 'history' ? 'active' : ''}" data-action="history">${icon('clock')} ບິນທັງໝົດ <span class="nav-count">${store.bills.length}</span></button>
        </nav>
        <div class="recent-label">ບິນຫຼ້າສຸດ</div>
        <div class="recent-list">${recent.map(b => `<button class="recent-bill ${b.id === currentId && view === 'bill' ? 'selected' : ''}" data-action="select-bill" data-id="${esc(b.id)}"><span class="recent-dot"></span><span class="truncate">${esc(b.name)}</span></button>`).join('') || '<p class="sidebar-empty">ບິນໃໝ່ຈະສະແດງຢູ່ນີ້</p>'}</div>
        <div class="sidebar-bottom">
          <div class="local-note">${icon('shield')}<div><strong>ບັນທຶກໄວ້ໃນເຄື່ອງນີ້</strong><span>ກັບມາເປີດເບິ່ງໄດ້ທຸກເວລາ</span></div></div>
          <button class="nav-link help-link" data-action="help">${icon('help')} ວິທີໃຊ້ & ຂໍ້ມູນ <span class="version">v2.0</span></button>
        </div>
      </aside>
      <div class="workspace">
        <header class="topbar"><div class="breadcrumb"><button class="icon-button mobile-menu" data-action="menu" aria-label="ເປີດເມນູ" aria-expanded="${navOpen}">${icon('menu')}</button><span class="breadcrumb-home">ພື້ນທີ່ຂອງເຈົ້າ</span>${icon('chevron')}<strong>${view === 'groups' ? 'ກຸ່ມໝູ່' : view === 'history' ? 'ບິນທັງໝົດ' : 'ຫານຄ່າອາຫານ'}</strong></div><span class="currency-label">LAK <span>₭</span></span></header>
        <main id="main" tabindex="-1">${storageIssue ? `<div class="storage-warning" role="alert">${esc(storageIssue)} <button data-action="export">ດາວໂຫຼດສຳຮອງ</button></div>` : ''}${view === 'groups' ? groupsPage() : view === 'history' ? historyPage() : bill ? billPage(bill) : emptyPage()}</main>
        <footer class="page-footer"><span>ໃຫ້ເວລາກັບໝູ່. ເລື່ອງບິນໃຫ້ Haan ຊ່ວຍ.</span><span>ຄິດໄລ່ເປັນກີບ · ບໍ່ມີຄ່າໃຊ້ຈ່າຍ</span></footer>
      </div>
    </div>`;
}

function emptyPage() {
  return `<section class="welcome"><div class="empty-art">${icon('receipt')}</div><p class="eyebrow">LESS MATH. MORE MOMENTS.</p><h1>ມື້ດີໆ ເລີ່ມຈາກການແບ່ງປັນ.</h1><p>ເພີ່ມໝູ່, ໃສ່ລາຍການອາຫານ ແລ້ວໃຫ້ເຮົາຊ່ວຍຫານບິນ.</p><button class="btn btn-primary" data-action="new">${icon('plus')} ສ້າງບິນທຳອິດ</button><button class="btn btn-quiet" data-action="sample">ລອງເບິ່ງບິນຕົວຢ່າງ ${icon('arrow')}</button></section>`;
}

function billPage(bill) {
  const result = calculateBill(bill);
  const names = Object.fromEntries(bill.members.map(p => [p.id, p.name]));
  return `<section class="page-heading"><div><p class="eyebrow">GOOD FOOD. FAIR SHARE.</p><h1>ຫານກັນ ໃຫ້ລົງຕົວ<span class="heading-dot">.</span></h1><p>ກິນໃຫ້ມ່ວນ ແລ້ວໃຫ້ເຮົາຊ່ວຍຄິດໄລ່.</p></div><button class="btn btn-white heading-new" data-action="new">${icon('plus')} ບິນໃໝ່</button></section>
    <section class="bill-bar"><div class="bill-title-icon">${icon('receipt')}</div><div class="bill-title"><div><h2>${esc(bill.name)}</h2>${bill.demo ? '<span class="badge demo-badge">ບິນຕົວຢ່າງ</span>' : ''}</div><p>${icon('calendar')} ${formatDate(bill.date)} <span class="meta-dot"></span> ${bill.members.length} ຄົນ</p></div><button class="icon-button" data-action="edit-bill" aria-label="ແກ້ໄຂຊື່ບິນ">${icon('edit')}</button><span class="save-indicator">${icon('check')} ${storageIssue ? 'ລໍຖ້າບັນທຶກ' : 'ບັນທຶກແລ້ວ'}</span></section>
    <div class="content-grid"><div class="bill-editor">
      <section class="card members-card"><div class="section-heading"><h2><span class="step">01</span> ໃຜມາກິນນຳກັນ?</h2><button class="text-button" data-action="members">ຈັດການ ${icon('edit')}</button></div><button class="text-button" data-action="save-group">${icon("people")} ບັນທຶກເປັນກຸ່ມໝູ່</button><div class="member-chips">${bill.members.map((p, i) => `<span class="member-chip">${avatar(p, i, true)}<span>${esc(p.name)}</span>${p.id === bill.defaultPayer ? '<span class="you-tag">ຄົນຈ່າຍຫຼັກ</span>' : ''}</span>`).join('')}<button class="member-add" data-action="members" aria-label="ເພີ່ມສະມາຊິກ">${icon('plus')}</button></div></section>
      <section class="card food-card"><div class="section-heading"><h2><span class="step">02</span> ມື້ນີ້ກິນຫຍັງ?</h2><span class="muted small-text">${bill.items.length} ລາຍການ</span></div><div class="food-table"><div class="table-labels"><span>ລາຍການອາຫານ</span><span>ຄົນທີ່ກິນ</span><span>ລາຄາ (₭)</span><span></span></div>${bill.items.map((item, i) => `<div class="food-row"><div class="food-name"><span class="food-symbol">${icon(item.name.includes('ດື່ມ') ? 'leaf' : 'food')}</span><div><button class="food-name-button" data-action="edit-item" data-id="${esc(item.id)}">${esc(item.name)}</button><span class="payer-caption">${item.quantity ?? 1} × ${money(item.amount)} ₭ · ${esc(names[item.payer])} ອອກເງິນ</span></div></div><button class="participants" data-action="edit-item" data-id="${esc(item.id)}" aria-label="ເລືອກຄົນກິນ ${esc(item.name)}"><span class="avatar-stack">${bill.members.filter(p => bill.mode === 'equal' || item.participants.includes(p.id)).slice(0, 3).map(p => avatar(p, bill.members.indexOf(p), true)).join('')}</span><span class="participant-count">${bill.mode === 'equal' ? bill.members.length : item.participants.length} ຄົນ</span></button><span class="food-amount">${money(lineTotal(item))}</span><button class="icon-button row-delete" data-action="delete-item" data-id="${esc(item.id)}" aria-label="ລຶບ ${esc(item.name)}">${icon('close')}</button></div>`).join('') || `<div class="empty-items">${icon('food')}<strong>ເພີ່ມອາຫານຈານທຳອິດ</strong><span>ອາຫານ, ເຄື່ອງດື່ມ ຫຼືຄ່າໃຊ້ຈ່າຍອື່ນໆ</span></div>`}</div><button class="add-item" data-action="add-item">${icon('plus')} ເພີ່ມລາຍການອາຫານ</button><div class="food-total"><span>ລວມຄ່າອາຫານ</span><strong>${money(result.total)} <span>₭</span></strong></div></section>
      <section class="card split-card"><div class="section-heading"><h2><span class="step">03</span> ຫານແບບໃດດີ?</h2></div><div class="split-options" role="group" aria-label="ວິທີຫານ"><button class="split-option ${bill.mode === 'items' ? 'chosen' : ''}" data-action="mode" data-mode="items" aria-pressed="${bill.mode === 'items'}">${icon('split')}<div><strong>ຕາມລາຍການ</strong><span>ໃຜກິນຫຍັງ ຈ່າຍອັນນັ້ນ</span></div><span class="radio-dot"></span></button><button class="split-option ${bill.mode === 'equal' ? 'chosen' : ''}" data-action="mode" data-mode="equal" aria-pressed="${bill.mode === 'equal'}">${icon('equal')}<div><strong>ຫານເທົ່າກັນ</strong><span>ແບ່ງຍອດລວມໃຫ້ທຸກຄົນ</span></div><span class="radio-dot"></span></button></div>${bill.members.length ? `<div class="payer-setting"><span class="payer-setting-icon">${icon('wallet')}</span><div><label for="main-payer">ຄົນອອກເງິນຫຼັກ</label><p>ປ່ຽນເພື່ອໃຊ້ກັບທຸກລາຍການ</p></div><select id="main-payer" aria-label="ຄົນອອກເງິນຫຼັກ">${bill.members.map(p => `<option value="${esc(p.id)}" ${bill.defaultPayer === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>` : ''}</section>
    </div><aside class="summary-column" aria-label="ສະຫຼຸບບິນ"><section class="summary-card"><div class="summary-top"><span class="summary-label">ບິນຂອງພວກເຮົາ</span>${icon('receipt')}<div class="grand-total">${money(result.total)}<span>₭</span></div><span class="summary-meta">${bill.items.length} ລາຍການ <span>·</span> ${bill.members.length} ຄົນ</span></div><div class="summary-body"><div class="summary-section-label">ສ່ວນແບ່ງຂອງແຕ່ລະຄົນ</div>${result.people.map((person, i) => `<div class="share-row">${avatar(person, i)}<div class="share-name"><strong>${esc(person.name)}</strong><span>${person.paid ? `ອອກເງິນ ${money(person.paid)} ₭` : 'ຍັງບໍ່ໄດ້ອອກເງິນ'}</span></div><strong class="share-amount">${money(person.owed)} <span>₭</span></strong></div>`).join('') || '<p class="muted">ເພີ່ມໝູ່ເພື່ອເລີ່ມຫານບິນ</p>'}<div class="settlement-heading"><span>${icon('arrow')} ສະຫຼຸບການໂອນ</span><span class="transfer-count">${result.transfers.length} ລາຍການ</span></div><div class="transfers">${result.transfers.map(t => `<div class="transfer-row"><div><strong>${esc(names[t.from])}</strong>${icon('arrow')}<span>${esc(names[t.to])}</span></div><strong>${money(t.amount)} <span>₭</span></strong></div>`).join('') || `<div class="settled-message">${icon(result.total ? 'check' : 'clock')} ${result.total ? 'ທຸກຄົນຈ່າຍພໍດີ ບໍ່ຕ້ອງໂອນເພີ່ມ' : 'ເພີ່ມລາຍການເພື່ອເບິ່ງຍອດໂອນ'}</div>`}</div><button class="btn btn-primary copy-button" data-action="copy" ${result.total ? '' : 'disabled'}>${icon('copy')} ຄັດລອກສະຫຼຸບບິນ</button><p class="copy-caption">ພ້ອມສົ່ງໃຫ້ໝູ່ໃນແຊັດ</p></div></section><div class="fair-note">${icon('shield')}<p>ຄິດໄລ່ກົງທຸກກີບ<span>ເສດຈາກການຫານຈະແບ່ງຕາມລຳດັບສະມາຊິກ ເພື່ອໃຫ້ຍອດລວມກົງກັນ.</span></p></div></aside></div>`;
}

function historyPage() {
  return `<section class="page-heading"><div><p class="eyebrow">EVERY MEAL, TOGETHER.</p><h1>ບິນທັງໝົດ<span class="heading-dot">.</span></h1><p>ກັບມາເບິ່ງມື້ດີໆ ທີ່ໄດ້ກິນນຳກັນ.</p></div><button class="btn btn-primary" data-action="new">${icon('plus')} ສ້າງບິນໃໝ່</button></section><div class="history-tools"><span>${store.bills.length} ບິນ · ບັນທຶກໃນ browser ນີ້</span><div><button class="btn btn-white" data-action="import">${icon('upload')} ນຳເຂົ້າ</button><button class="btn btn-white" data-action="export">${icon('download')} ສຳຮອງຂໍ້ມູນ</button></div></div><div class="history-grid">${store.bills.map(b => `<article class="card history-card"><div class="history-card-top"><span class="bill-title-icon">${icon('receipt')}</span><button class="icon-button" data-action="delete-bill" data-id="${esc(b.id)}" aria-label="ລຶບບິນ ${esc(b.name)}">${icon('trash')}</button></div><h2>${esc(b.name)}</h2><p>${formatDate(b.date)} <span>·</span> ${b.members.length} ຄົນ ${b.demo ? '<span class="badge demo-badge">ຕົວຢ່າງ</span>' : ''}</p><div class="history-bottom"><strong>${money(calculateBill(b).total)} <span>₭</span></strong><button class="icon-button open-bill" data-action="select-bill" data-id="${esc(b.id)}" aria-label="ເປີດບິນ ${esc(b.name)}">${icon('arrow')}</button></div></article>`).join('') || `<div class="card history-empty"><h2>ຍັງບໍ່ມີບິນ</h2><p>ສ້າງບິນໃໝ່ ຫຼືນຳເຂົ້າໄຟລ໌ສຳຮອງ.</p></div>`}</div>`;
}

function openDialog(title, body, wide = false) {
  if (!dialog.open) lastFocus = document.activeElement;
  dialog.className = wide ? 'wide-dialog' : '';
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button class="icon-button" data-action="close" aria-label="ປິດ">${icon('close')}</button></div>${body}`;
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => (dialog.querySelector('input:not([type="checkbox"]), textarea, select') || dialog.querySelector('button'))?.focus());
}
function closeDialog() { dialog.close(); }
dialog.addEventListener('close', () => { if (lastFocus?.isConnected) lastFocus.focus(); else document.querySelector('#main')?.focus({preventScroll:true}); });
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog(); } });
const errorArea = '<p class="form-error" id="form-error" role="alert"></p>';
const actions = (text = 'ບັນທຶກ', danger = false) => `<div class="dialog-actions"><button type="button" class="btn btn-white" data-action="close">ຍົກເລີກ</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit">${text}</button></div>`;
const showError = message => { const el = dialog.querySelector('#form-error'); if (el) el.textContent = message; else toast(message); };

function billDialog(edit = false) {
  if (!edit && store.bills.length >= LIMITS.bills) return toast('ຮອງຮັບສູງສຸດ 100 ບິນ. ສຳຮອງ ແລະລຶບບິນເກົ່າກ່ອນ.');
  const bill = edit ? current() : null;
  openDialog(edit ? 'ແກ້ໄຂບິນ' : 'ມາສ້າງບິນໃໝ່ກັນ', `<p class="dialog-description">${edit ? 'ປ່ຽນຊື່ບິນ ຫຼືວັນທີໄດ້ທີ່ນີ້.' : 'ເລີ່ມຈາກຊື່ມື້ອາຫານ ແລະໝູ່ທີ່ມານຳກັນ.'}</p><form data-form="${edit ? 'edit-bill' : 'new-bill'}"><label class="field">ຊື່ບິນ / ຊື່ກຸ່ມ<input name="name" maxlength="100" required placeholder="ເຊັ່ນ ມື້ແລງວັນສຸກ" value="${esc(bill?.name || '')}"></label><label class="field">ວັນທີ<input name="date" type="date" required value="${bill?.date || localDate()}"></label>${!edit ? `<label class="field">ເລືອກກຸ່ມທີ່ບັນທຶກ<select id="saved-group"><option value="">ໃສ່ລາຍຊື່ເອງ</option>${store.groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)} (${g.members.length})</option>`).join('')}</select></label><label class="field">ໃຜມານຳແດ່?<textarea name="members" rows="6" required placeholder="ໃສ່ຊື່ໝູ່ ໜຶ່ງຄົນຕໍ່ແຖວ" maxlength="1640"></textarea><span class="field-hint">ໜຶ່ງຄົນຕໍ່ແຖວ. ລຶບຊື່ຄົນທີ່ບໍ່ມາມື້ນີ້ໄດ້; ກຸ່ມເດີມຍັງຄົງຢູ່.</span></label>` : ''}${errorArea}${actions(edit ? 'ບັນທຶກ' : 'ສ້າງບິນ')}</form>`);
}

function memberDialog() {
  const bill = current();
  openDialog('ສະມາຊິກໃນບິນ', `<p class="dialog-description">ເພີ່ມໝູ່ ຫຼືແກ້ໄຂລາຍຊື່. ສະມາຊິກໃໝ່ສາມາດເລືອກໃຫ້ກິນແຕ່ລະລາຍການໄດ້.</p><div class="manage-members">${bill.members.map((p, i) => `<div class="manage-member">${avatar(p, i)}<span>${esc(p.name)}</span><button class="icon-button" data-action="rename-member" data-id="${esc(p.id)}" aria-label="ແກ້ໄຂຊື່ ${esc(p.name)}">${icon('edit')}</button><button class="icon-button" data-action="remove-member" data-id="${esc(p.id)}" aria-label="ລຶບສະມາຊິກ ${esc(p.name)}">${icon('trash')}</button></div>`).join('')}</div><form data-form="add-member"><label class="field">ຊື່ສະມາຊິກໃໝ່<div class="inline-input"><input name="name" maxlength="40" required placeholder="ໃສ່ຊື່ໝູ່"><button class="btn btn-primary" type="submit">${icon('plus')} ເພີ່ມ</button></div></label>${errorArea}</form><div class="dialog-actions"><button class="btn btn-white" data-action="close">ສຳເລັດ</button></div>`);
}

function itemDialog(id) {
  const bill = current();
  if (!bill.members.length) { toast('ເພີ່ມສະມາຊິກກ່ອນເພີ່ມອາຫານ'); memberDialog(); return; }
  if (!id && bill.items.length >= LIMITS.items) return toast('ໜຶ່ງບິນຮອງຮັບສູງສຸດ 300 ລາຍການ');
  const item = bill.items.find(i => i.id === id);
  openDialog(item ? 'ແກ້ໄຂລາຍການອາຫານ' : 'ເພີ່ມຄວາມແຊບໃສ່ບິນ', `<form data-form="item" data-id="${esc(id || '')}"><label class="field">ຊື່ລາຍການ<input name="name" required maxlength="100" placeholder="ເຊັ່ນ ປີ້ງໄກ່" value="${esc(item?.name || '')}"></label><label class="field">ລາຄາຕໍ່ໜ່ວຍ (₭)<input name="amount" type="number" inputmode="numeric" required min="1" max="${LIMITS.amount}" step="1" placeholder="0" value="${item?.amount ?? ''}"><span class="field-hint">ໃສ່ລາຄາຕໍ່ຈານ ຫຼືຕໍ່ໜ່ວຍ</span></label><label class="field">ຈຳນວນ<input name="quantity" type="number" inputmode="numeric" min="1" max="999" step="1" required value="${item?.quantity ?? 1}"></label><p class="info-box">ລວມ: <output id="line-total">${money(item ? lineTotal(item) : 0)}</output> ₭</p><fieldset class="participant-field"><legend>ໃຜກິນລາຍການນີ້ແດ່?</legend><div class="participant-tools"><button type="button" class="text-button" data-action="select-all">ເລືອກທັງໝົດ</button><button type="button" class="text-button muted" data-action="select-none">ລ້າງການເລືອກ</button></div><div class="participant-choices">${bill.members.map((p, i) => `<label class="participant-choice"><input name="participants" type="checkbox" value="${esc(p.id)}" ${!item || item.participants.includes(p.id) ? 'checked' : ''}>${avatar(p, i, true)}<span>${esc(p.name)}</span></label>`).join('')}</div>${bill.mode === 'equal' ? '<p class="field-hint">ຕອນນີ້ໃຊ້ໂໝດຫານເທົ່າກັນ. ການເລືອກນີ້ຈະໃຊ້ເມື່ອປ່ຽນເປັນຫານຕາມລາຍການ.</p>' : ''}</fieldset><label class="field">ຄົນອອກເງິນໃຫ້ຮ້ານ<select name="payer">${bill.members.map(p => `<option value="${esc(p.id)}" ${(item?.payer || bill.defaultPayer) === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>${errorArea}${actions(item ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມລາຍການ')}</form>`);
}

function confirmDialog(title, description, action, id) {
  openDialog(title, `<p class="dialog-description">${description}</p><form data-form="${action}" data-id="${esc(id)}">${actions('ຢືນຢັນ', true)}</form>`);
}

function helpDialog() {
  openDialog('ຫານບິນງ່າຍໆ ກັບ Haan', `<div class="help-content"><h3>1. ສ້າງບິນ ແລະເພີ່ມໝູ່</h3><p>ໃສ່ຊື່ມື້ອາຫານ, ວັນທີ ແລະຊື່ສະມາຊິກ.</p><h3>2. ເພີ່ມອາຫານ ແລະຄົນຈ່າຍ</h3><p>ແຕ່ລະລາຍການເລືອກຄົນກິນ ແລະຄົນອອກເງິນໄດ້. ຖ້າຫຼາຍຄົນອອກເງິນໃນລາຍການດຽວ ໃຫ້ແຍກເປັນຫຼາຍລາຍການຕາມຍອດທີ່ຈ່າຍ.</p><h3>3. ເລືອກວິທີຫານ ແລະຄັດລອກສະຫຼຸບ</h3><p>ຫານຕາມຄົນກິນ ຫຼືຫານເທົ່າກັນທຸກຄົນ. ຍອດໂອນຈະຫັກເງິນທີ່ແຕ່ລະຄົນອອກໄປແລ້ວ.</p><div class="info-box">ຂໍ້ມູນບັນທຶກໃນ browser ນີ້ເທົ່ານັ້ນ ບໍ່ຊິງຂ້າມເຄື່ອງ. ການລ້າງຂໍ້ມູນ browser ອາດເຮັດໃຫ້ບິນຫາຍ. ດາວໂຫຼດໄຟລ໌ສຳຮອງເພື່ອເກັບໄວ້.<br><br>ສະຫຼຸບການໂອນເປັນຄຳແນະນຳການຊຳລະ ບໍ່ແມ່ນການໂອນເງິນຜ່ານທະນາຄານ.</div></div><div class="dialog-actions"><button class="btn btn-white" data-action="export">${icon('download')} ສຳຮອງຂໍ້ມູນ</button><button class="btn btn-primary" data-action="close">ເຂົ້າໃຈແລ້ວ</button></div>`);
}

function summaryText() {
  const bill = current(), result = calculateBill(bill);
  const name = id => bill.members.find(p => p.id === id).name;
  return [`${bill.name}${bill.demo ? ' (ຕົວຢ່າງ)' : ''}`, formatDate(bill.date), `ລວມ ${money(result.total)} ₭ · ${bill.members.length} ຄົນ`, `ວິທີຫານ: ${bill.mode === 'equal' ? 'ຫານເທົ່າກັນ' : 'ຕາມລາຍການ'}`, '', 'ລາຍການອາຫານ', ...bill.items.map(i => `${i.name} (${i.quantity ?? 1} × ${money(i.amount)} ₭): ${money(lineTotal(i))} ₭ (${name(i.payer)} ອອກເງິນ)`), '', 'ສ່ວນແບ່ງ / ອອກເງິນແລ້ວ', ...result.people.map(p => `${p.name}: ${money(p.owed)} ₭ / ${money(p.paid)} ₭`), '', 'ສະຫຼຸບການໂອນ', ...result.transfers.map(t => `${name(t.from)} → ${name(t.to)}: ${money(t.amount)} ₭`), ...(!result.transfers.length ? ['ບໍ່ຕ້ອງໂອນເພີ່ມ'] : []), '', 'ຄິດໄລ່ດ້ວຍ Haan'].join('\n');
}

async function copySummary() {
  const text = summaryText();
  try { await navigator.clipboard.writeText(text); toast('ຄັດລອກສະຫຼຸບບິນແລ້ວ'); }
  catch { openDialog('ສະຫຼຸບບິນ', `<p class="dialog-description">ເລືອກຂໍ້ຄວາມລຸ່ມນີ້ ແລ້ວຄັດລອກໄປສົ່ງໃຫ້ໝູ່.</p><textarea class="copy-area" readonly aria-label="ສະຫຼຸບບິນ">${esc(text)}</textarea><div class="dialog-actions"><button class="btn btn-primary" data-action="close">ສຳເລັດ</button></div>`); dialog.querySelector('textarea').select(); }
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `haan-backup-${localDate()}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('ດາວໂຫຼດໄຟລ໌ສຳຮອງແລ້ວ');
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const { action, id } = button.dataset;
  if (button.tagName === 'A') event.preventDefault();
  const bill = current();
  switch (action) {
    case 'groups': view = 'groups'; navOpen = false; render(); break;
    case 'new-group': groupDialog(); break;
    case 'edit-group': groupDialog(id); break;
    case 'save-group': groupDialog(null, bill); break;
    case 'delete-group': confirmDialog('ລຶບກຸ່ມນີ້?', 'ລາຍຊື່ໃນບິນເກົ່າຈະຍັງຄົງຢູ່.', 'delete-group', id); break;
    case 'menu': navOpen = !navOpen; render(); break;
    case 'home': view = 'bill'; navOpen = false; render(); break;
    case 'history': view = 'history'; navOpen = false; render(); break;
    case 'select-bill': currentId = id; view = 'bill'; navOpen = false; render(); break;
    case 'new': navOpen = false; render(); billDialog(); break;
    case 'edit-bill': billDialog(true); break;
    case 'close': closeDialog(); break;
    case 'members': memberDialog(); break;
    case 'add-item': itemDialog(); break;
    case 'edit-item': itemDialog(id); break;
    case 'delete-item': {
      const item = bill.items.find(i => i.id === id);
      confirmDialog('ລຶບລາຍການນີ້?', `ລຶບ “${esc(item.name)}” ຈຳນວນ ${money(lineTotal(item))} ₭ ອອກຈາກບິນ. ຍອດຈະຄຳນວນໃໝ່.`, 'delete-item', id); break;
    }
    case 'delete-bill': {
      const target = store.bills.find(b => b.id === id);
      confirmDialog('ລຶບບິນນີ້?', `ບິນ “${esc(target.name)}” ແລະລາຍການທັງໝົດຈະຖືກລຶບ. ສາມາດສຳຮອງຂໍ້ມູນກ່ອນລຶບໄດ້.`, 'delete-bill', id); break;
    }
    case 'mode': bill.mode = button.dataset.mode; commit(); break;
    case 'select-all': dialog.querySelectorAll('[name="participants"]').forEach(el => el.checked = true); break;
    case 'select-none': dialog.querySelectorAll('[name="participants"]').forEach(el => el.checked = false); break;
    case 'remove-member': {
      const reason = canRemoveMember(bill, id);
      if (reason) return showError(reason === 'payer' ? 'ຄົນນີ້ມີລາຍການທີ່ອອກເງິນ. ປ່ຽນຄົນຈ່າຍ ຫຼືລຶບລາຍການນັ້ນກ່ອນ.' : 'ຄົນນີ້ກິນບາງລາຍການຄົນດຽວ. ແກ້ໄຂຄົນກິນ ຫຼືລຶບລາຍການນັ້ນກ່ອນ.');
      store.bills[store.bills.indexOf(bill)] = removeMember(bill, id); commit(); memberDialog(); break;
    }
    case 'rename-member': {
      const person = bill.members.find(p => p.id === id);
      openDialog('ແກ້ໄຂຊື່ສະມາຊິກ', `<form data-form="rename-member" data-id="${esc(id)}"><label class="field">ຊື່<input name="name" value="${esc(person.name)}" required maxlength="40"></label>${errorArea}${actions()}</form>`); break;
    }
    case 'copy': copySummary(); break;
    case 'export': exportBackup(); break;
    case 'import': document.querySelector('#import-file').click(); break;
    case 'help': helpDialog(); break;
    case 'sample': { const sample = sampleBill(); store.bills.unshift(sample); currentId = sample.id; view = 'bill'; commit(); break; }
  }
});

document.addEventListener('submit', event => {
  const form = event.target;
  if (!form.dataset.form) return;
  event.preventDefault();
  const data = new FormData(form), type = form.dataset.form, id = form.dataset.id;
  const bill = current(), name = String(data.get('name') || '').trim();
  if (['new-bill', 'edit-bill', 'item', 'add-member', 'rename-member'].includes(type) && !name) return showError('ກະລຸນາໃສ່ຊື່');
  if (type === 'group') {
    const names = String(data.get('members')).split(/[,，\n]+/).map(s=>s.trim()).filter(Boolean);
    const group = {id:id || uid(),name,members:names.map(name=>({id:uid(),name}))};
    try { validateGroup(group); } catch { return showError('ໃສ່ຊື່ກຸ່ມ ແລະສະມາຊິກ 1–40 ຄົນ; ຊື່ບໍ່ຊ້ຳ ແລະບໍ່ເກີນ 40 ຕົວອັກສອນ'); }
    const index = store.groups.findIndex(g=>g.id===id);
    if(index >= 0) store.groups[index]=group; else { if(store.groups.length >= 100) return showError('ຮອງຮັບ 100 ກຸ່ມ'); store.groups.push(group); }
    view='groups';
  } else if(type === 'delete-group') { store.groups=store.groups.filter(g=>g.id!==id); }
  else if (type === 'new-bill') {
    const names = String(data.get('members')).split(/[,，\n]+/).map(s => s.trim()).filter(Boolean);
    if (!names.length || names.length > LIMITS.members) return showError('ກະລຸນາໃສ່ສະມາຊິກ 1–40 ຄົນ');
    if (names.some(n => n.length > 40)) return showError('ຊື່ສະມາຊິກຍາວໄດ້ສູງສຸດ 40 ຕົວອັກສອນ');
    if (new Set(names.map(n => n.toLocaleLowerCase())).size !== names.length) return showError('ຊື່ຊ້ຳກັນ. ເພີ່ມຊື່ຫຼິ້ນເພື່ອແຍກແຕ່ລະຄົນ.');
    const members = names.map(name => ({ id: uid(), name }));
    const next = { id: uid(), name, date: data.get('date'), mode: 'items', members, items: [], defaultPayer: members[0].id };
    store.bills.unshift(next); currentId = next.id; view = 'bill';
  } else if (type === 'edit-bill') {
    bill.name = name; bill.date = data.get('date');
  } else if (type === 'add-member' || type === 'rename-member') {
    if (bill.members.some(p => p.id !== id && p.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return showError('ຊື່ນີ້ມີແລ້ວ. ກະລຸນາໃຊ້ຊື່ອື່ນ.');
    if (type === 'add-member') {
      if (bill.members.length >= LIMITS.members) return showError('ຮອງຮັບສະມາຊິກສູງສຸດ 40 ຄົນ');
      const member = { id: uid(), name }; bill.members.push(member); if (!bill.defaultPayer) bill.defaultPayer = member.id;
    } else bill.members.find(p => p.id === id).name = name;
    commit(); memberDialog(); return;
  } else if (type === 'item') {
    const quantity = Number(data.get('quantity'));
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 || quantity * Number(data.get('amount')) > LIMITS.amount) return showError('ຈຳນວນ 1–999; ຍອດລວມບໍ່ເກີນ 1,000,000,000 ₭');
    const amount = Number(data.get('amount')), participants = data.getAll('participants');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > LIMITS.amount) return showError('ໃສ່ລາຄາເປັນກີບເຕັມ ລະຫວ່າງ 1–1,000,000,000');
    if (!participants.length) return showError('ເລືອກຄົນກິນຢ່າງໜ້ອຍ 1 ຄົນ');
    const item = { id: id || uid(), name, amount, quantity, participants, payer: data.get('payer') };
    const index = bill.items.findIndex(i => i.id === id);
    if (index >= 0) bill.items[index] = item; else bill.items.push(item);
  } else if (type === 'delete-item') bill.items = bill.items.filter(i => i.id !== id);
  else if (type === 'delete-bill') {
    store.bills = store.bills.filter(b => b.id !== id);
    if (currentId === id) currentId = store.bills[0]?.id;
  } else if (type === 'import-backup' && pendingImport) {
    store = pendingImport; pendingImport = null; currentId = store.bills[0]?.id; view = 'history';
  }
  closeDialog(); const saved = commit();
  if (saved && ['item', 'new-bill', 'edit-bill', 'import-backup'].includes(type)) toast('ບັນທຶກແລ້ວ');
});

document.addEventListener('change', async event => {
  if(event.target.id === 'saved-group') {
    const group=store.groups.find(g=>g.id===event.target.value);
    if(group) dialog.querySelector('[name="members"]').value=group.members.map(p=>p.name).join('\n');
  }
  if (event.target.id === 'main-payer') {
    const bill = current(); bill.defaultPayer = event.target.value;
    bill.items.forEach(item => item.payer = bill.defaultPayer); commit(); toast('ປ່ຽນຄົນອອກເງິນທຸກລາຍການແລ້ວ');
  }
  if (event.target.id === 'import-file') {
    const file = event.target.files[0]; event.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) return toast('ໄຟລ໌ໃຫຍ່ເກີນ 5 MB');
    try {
      pendingImport = validateStore(JSON.parse(await file.text()));
      confirmDialog('ນຳເຂົ້າໄຟລ໌ສຳຮອງ?', `ມີ ${pendingImport.bills.length} ບິນໃນໄຟລ໌ນີ້. ມີ ${pendingImport.groups.length} ກຸ່ມ. ການນຳເຂົ້າຈະແທນທີ່ກຸ່ມ ແລະບິນທັງໝົດໃນ browser ນີ້. ກະລຸນາສຳຮອງບິນປັດຈຸບັນກ່ອນ.`, 'import-backup', '');
    } catch { pendingImport = null; toast('ໄຟລ໌ບໍ່ຖືກຕ້ອງ. ເລືອກໄຟລ໌ສຳຮອງຈາກ Haan.'); }
  }
});

window.addEventListener('storage', event => {
  if (event.key !== KEY) return;
  try {
    store = event.newValue ? validateStore(JSON.parse(event.newValue)) : { version: 2, groups: [], bills: [] };
    if (!current()) currentId = store.bills[0]?.id;
    closeDialog(); render(); toast('ອັບເດດບິນຈາກແທັບອື່ນແລ້ວ');
  } catch { toast('ຂໍ້ມູນຈາກແທັບອື່ນບໍ່ຖືກຕ້ອງ'); }
});

if (!storageIssue) persist();
render();

function groupsPage() {
 return `<section class="page-heading"><div><p class="eyebrow">YOUR PEOPLE.</p><h1>ກຸ່ມໝູ່</h1><p>ບັນທຶກຊື່ເທື່ອດຽວ. ກິນນຳກັນໄດ້ອີກຫຼາຍມື້.</p></div><button class="btn btn-primary" data-action="new-group">${icon('plus')} ສ້າງກຸ່ມ</button></section><div class="history-tools"><span>ບັນທຶກໃນ browser ນີ້ · ບໍ່ຊິງຂ້າມເຄື່ອງ</span><div><button class="btn" data-action="export">${icon('download')} ສຳຮອງ</button><button class="btn" data-action="import">${icon('upload')} ນຳເຂົ້າ</button></div></div><div class="history-grid">${store.groups.map(g=>`<article class="card"><h2>${esc(g.name)}</h2><p>${g.members.length} ຄົນ</p><p>${g.members.map(p=>esc(p.name)).join(' · ')}</p><div class="dialog-actions"><button class="btn" data-action="edit-group" data-id="${esc(g.id)}">ແກ້ໄຂ</button><button class="icon-button" data-action="delete-group" data-id="${esc(g.id)}" aria-label="ລຶບກຸ່ມ ${esc(g.name)}">${icon('trash')}</button></div></article>`).join('') || '<section class="card"><h2>ເລີ່ມຈາກກຸ່ມປະຈຳຂອງເຈົ້າ</h2><p>ເພີ່ມລາຍຊື່ໝູ່ ແລ້ວເລືອກກຸ່ມນີ້ເມື່ອສ້າງບິນໃໝ່.</p></section>'}</div>`;
}
function groupDialog(id, bill) {
 const group=store.groups.find(g=>g.id===id);
 openDialog(group ? 'ແກ້ໄຂກຸ່ມໝູ່' : 'ສ້າງກຸ່ມໝູ່', `<form data-form="group" data-id="${esc(id || '')}"><label class="field">ຊື່ກຸ່ມ<input name="name" maxlength="100" required value="${esc(group?.name || bill?.name || '')}"></label><label class="field">ລາຍຊື່ໝູ່<textarea name="members" rows="10" maxlength="1640" required>${esc((group?.members || bill?.members || []).map(p=>p.name).join('\n'))}</textarea><span class="field-hint">ໜຶ່ງຄົນຕໍ່ແຖວ · ສູງສຸດ 40 ຄົນ</span></label>${errorArea}${actions()}</form>`);
}
document.addEventListener('input',event=>{
 if (!['amount','quantity'].includes(event.target.name)) return;
 const form=event.target.closest('form'); const output=form?.querySelector('#line-total');
 if(output) output.textContent=money(Number(form.elements.amount.value)*Number(form.elements.quantity.value));
});
