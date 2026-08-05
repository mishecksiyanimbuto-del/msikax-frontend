// ============================================================================
// ADMIN.JS — the admin dashboard: platform-wide stats plus tabbed tables for
// Users, Shops, Products, Orders, Transactions, Withdrawals, and
// Suggestions. Only reachable for state.user.role === 'admin' (both the
// nav link and go('admin') itself check this — see app.js) — but every
// real permission check happens server-side in requireAdmin regardless,
// this is just about not showing buyers a dead end.
// ============================================================================

let adminTab = 'overview';
const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'shops', label: 'Shops' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'verifications', label: 'Verifications' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'suggestions', label: 'Suggestions' }
];

async function renderAdmin(){
  const el = document.getElementById('adminContent');
  el.innerHTML = `
    <div class="toolbar" style="margin-bottom:24px;">
      ${ADMIN_TABS.map(t => `<button class="chip ${adminTab===t.id?'active':''}" onclick="setAdminTab('${t.id}')">${t.label}</button>`).join('')}
    </div>
    <div id="adminTabContent"><div class="empty-state"><div class="glyph">⏳</div><h3>Loading…</h3></div></div>
  `;
  await renderAdminTab();
}
function setAdminTab(tab){ adminTab = tab; renderAdminTab(); }

async function renderAdminTab(){
  const el = document.getElementById('adminTabContent');
  try{
    if(adminTab==='overview') return el.innerHTML = await adminOverviewHTML();
    if(adminTab==='users') return el.innerHTML = await adminUsersHTML();
    if(adminTab==='shops') return el.innerHTML = await adminShopsHTML();
    if(adminTab==='products') return el.innerHTML = await adminProductsHTML();
    if(adminTab==='orders') return el.innerHTML = await adminOrdersHTML();
    if(adminTab==='transactions') return el.innerHTML = await adminTransactionsHTML();
    if(adminTab==='withdrawals') return el.innerHTML = await adminWithdrawalsHTML();
    if(adminTab==='verifications') return el.innerHTML = await adminVerificationsHTML();
    if(adminTab==='refunds') return el.innerHTML = await adminRefundsHTML();
    if(adminTab==='suggestions') return el.innerHTML = await adminSuggestionsHTML();
  }catch(e){ el.innerHTML = `<div class="empty-state"><div class="glyph">⚠️</div><h3>Couldn't load this</h3><p>${escapeHTML(e.message)}</p></div>`; }
}

/* ---- Overview ---- */
async function adminOverviewHTML(){
  const s = await api.get('/api/admin/stats');
  const card = (label, value) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
  return `<div class="stat-row" style="flex-wrap:wrap;gap:32px;">
    ${card('Users', s.userCount)}
    ${card('Shops', s.shopCount)}
    ${card('Listings', s.productCount)}
    ${card('Paid orders', s.orderCount)}
    ${card('Pending withdrawals', s.pendingWithdrawals)}
    ${card('Suggestions', s.openSuggestions)}
    ${card('Total revenue (9% fee)', fmtMWK(s.totalRevenue))}
  </div>`;
}

/* ---- Users ---- */
async function adminUsersHTML(){
  const { users } = await api.get('/api/admin/users');
  if(!users.length) return emptyAdminState('No users yet');
  return adminTable(['Name','Email','Phone','Verified','Status',''], users.map(u => [
    escapeHTML(u.name), escapeHTML(u.email), escapeHTML(u.phone||'—'),
    u.verified ? '✓' : '—',
    u.banned ? '<span class="status-pill failed">banned</span>' : '<span class="status-pill paid">active</span>',
    u.role==='admin' ? '' : `<button class="btn btn-sm ${u.banned?'btn-teal':'btn-danger'}" onclick="adminToggleBan('${u._id}')">${u.banned?'Unban':'Ban'}</button>`
  ]));
}
async function adminToggleBan(id){
  try{ await api.patch(`/api/admin/users/${id}/ban`); toast('Updated'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- Shops ---- */
async function adminShopsHTML(){
  const { shops } = await api.get('/api/admin/shops');
  if(!shops.length) return emptyAdminState('No shops yet');
  return adminTable(['Shop','Owner','Category','Status',''], shops.map(s => [
    escapeHTML(s.shopName), escapeHTML(s.owner?.name||'—'), escapeHTML(s.category),
    s.suspended ? '<span class="status-pill failed">suspended</span>' : '<span class="status-pill paid">live</span>',
    `<button class="btn btn-sm ${s.suspended?'btn-teal':'btn-danger'}" onclick="adminToggleSuspend('${s._id}')">${s.suspended?'Unsuspend':'Suspend'}</button>`
  ]));
}
async function adminToggleSuspend(id){
  try{ await api.patch(`/api/admin/shops/${id}/suspend`); toast('Updated'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- Products ---- */
async function adminProductsHTML(){
  const { products } = await api.get('/api/admin/products');
  if(!products.length) return emptyAdminState('No listings yet');
  return adminTable(['Item','Shop','Price','Stock',''], products.map(p => [
    escapeHTML(p.title), escapeHTML(p.seller?.shopName||'—'), fmtMWK(p.price), p.stock,
    `<button class="btn btn-sm btn-danger" onclick="adminRemoveProduct('${p._id}')">Remove</button>`
  ]));
}
async function adminRemoveProduct(id){
  if(!confirm('Remove this listing? This cannot be undone.')) return;
  try{ await api.del(`/api/admin/products/${id}`); toast('Listing removed'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- Orders ---- */
async function adminOrdersHTML(){
  const { orders } = await api.get('/api/admin/orders');
  if(!orders.length) return emptyAdminState('No orders yet');
  return adminTable(['Ref','Buyer','Total','Method','Status'], orders.map(o => [
    o.chargeId, escapeHTML(o.buyer?.name||'—'), fmtMWK(o.total), o.method,
    `<span class="status-pill ${o.paymentStatus}">${o.paymentStatus}</span>`
  ]));
}

/* ---- Transactions ---- */
async function adminTransactionsHTML(){
  const { transactions } = await api.get('/api/admin/transactions');
  if(!transactions.length) return emptyAdminState('No transactions yet');
  return adminTable(['Reference','Type','Amount','Status','Date'], transactions.map(t => [
    t.reference, t.type, fmtMWK(t.amount),
    `<span class="status-pill ${t.status==='success'?'paid':t.status==='failed'?'failed':'pending'}">${t.status}</span>`,
    new Date(t.createdAt).toLocaleDateString()
  ]));
}

/* ---- Withdrawals ---- */
async function adminWithdrawalsHTML(){
  const { withdrawals } = await api.get('/api/admin/withdrawals');
  if(!withdrawals.length) return emptyAdminState('No withdrawal requests yet');
  return adminTable(['Shop','Amount','Operator','Status','Requested'], withdrawals.map(w => [
    escapeHTML(w.shop?.shopName||'—'), fmtMWK(w.amount), w.operator,
    `<span class="status-pill ${w.status==='paid'?'paid':w.status==='failed'?'failed':'pending'}">${w.status}</span>`,
    new Date(w.createdAt).toLocaleDateString()
  ]));
}

/* ---- Verifications (Phase 13) ---- */
async function adminVerificationsHTML(){
  const { shops } = await api.get('/api/admin/verifications?status=pending');
  if(!shops.length) return emptyAdminState('No pending verification requests');
  return shops.map(s => `
    <div class="order-card">
      <div class="order-top">
        <b>${escapeHTML(s.shopName)}</b>
        <span class="field-note">Submitted ${new Date(s.verification.submittedAt).toLocaleDateString()}</span>
      </div>
      <p style="color:var(--text-dim);font-size:13.5px;margin:6px 0 12px;">Owner: ${escapeHTML(s.owner?.name||'—')} · ${escapeHTML(s.owner?.email||'')} · ${escapeHTML(s.owner?.phone||'')}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn btn-ghost btn-sm" onclick="adminViewDocument('${s._id}','id')">View National ID</button>
        ${s.verification.businessDocument ? `<button class="btn btn-ghost btn-sm" onclick="adminViewDocument('${s._id}','business')">View business registration</button>` : ''}
      </div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-teal btn-sm" onclick="adminApproveVerification('${s._id}')">Approve</button>
        <button class="btn btn-danger btn-sm" onclick="adminRejectVerification('${s._id}')">Reject</button>
      </div>
    </div>`).join('');
}
async function adminViewDocument(shopId, type){
  try{
    const url = await api.getBlobUrl(`/api/admin/verifications/${shopId}/document/${type}`);
    window.open(url, '_blank');
  }catch(e){ toast(e.message); }
}
async function adminApproveVerification(shopId){
  try{ await api.post(`/api/admin/verifications/${shopId}/approve`); toast('Shop verified'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}
async function adminRejectVerification(shopId){
  const reason = prompt('Reason for rejecting (shown to the seller):');
  if(reason === null) return;
  try{ await api.post(`/api/admin/verifications/${shopId}/reject`, { reason }); toast('Rejected'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- Refunds ---- */
async function adminRefundsHTML(){
  const { refunds } = await api.get('/api/admin/refunds?status=seller_responded');
  const pendingSellerReply = await api.get('/api/admin/refunds?status=requested');
  const combined = [...refunds, ...pendingSellerReply.refunds];
  if(!combined.length) return emptyAdminState('No refunds awaiting a decision');

  const statusLabel = { requested: 'Awaiting seller response', seller_responded: 'Ready for your decision' };
  return combined.map(r => `
    <div class="order-card">
      <div class="order-top">
        <b>${escapeHTML(r.order.chargeId)}</b>
        <span class="status-pill pending">${statusLabel[r.status]||r.status}</span>
      </div>
      <p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;">Buyer: ${escapeHTML(r.buyer?.name||'—')} (${escapeHTML(r.buyer?.email||'')})</p>
      <p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;"><b>Reason:</b> ${escapeHTML(r.reason)}</p>
      ${r.sellerResponse ? `<p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;"><b>Seller's response:</b> ${escapeHTML(r.sellerResponse)}</p>` : `<p class="field-note">Seller hasn't responded yet — you can still decide without waiting.</p>`}
      <div class="order-foot" style="margin-bottom:12px;"><span>${new Date(r.createdAt).toLocaleDateString()}</span><span class="mono">${fmtMWK(r.order.total)}</span></div>
      <div style="display:flex;gap:10px;">
        <button class="btn btn-teal btn-sm" onclick="adminApproveRefund('${r._id}')">Approve refund</button>
        <button class="btn btn-danger btn-sm" onclick="adminRejectRefund('${r._id}')">Reject</button>
      </div>
    </div>`).join('');
}
async function adminApproveRefund(id){
  if(!confirm('Approve this refund? This debits the seller\'s wallet and attempts to repay the buyer.')) return;
  try{
    const { negativeShops } = await api.post(`/api/admin/refunds/${id}/approve`);
    toast(negativeShops?.length ? 'Approved — one or more shops now has a negative balance, needs manual recovery' : 'Refund approved');
    renderAdminTab();
  }catch(e){ toast(e.message); }
}
async function adminRejectRefund(id){
  const adminNote = prompt('Reason for rejecting (shown to the buyer):');
  if(adminNote === null) return;
  try{ await api.post(`/api/admin/refunds/${id}/reject`, { adminNote }); toast('Rejected'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- Suggestions ---- */
async function adminSuggestionsHTML(){
  const { suggestions } = await api.get('/api/admin/suggestions');
  if(!suggestions.length) return emptyAdminState('No suggestions yet');
  return suggestions.map(s => `
    <div class="order-card">
      <div class="order-top"><b>${escapeHTML(s.name||'Anonymous')}</b><button class="btn btn-ghost btn-sm" onclick="adminDismissSuggestion('${s._id}')">Dismiss</button></div>
      <p style="color:var(--text-dim);font-size:14px;margin:8px 0 0;">${escapeHTML(s.message)}</p>
      <div class="field-note">${new Date(s.createdAt).toLocaleDateString()}</div>
    </div>`).join('');
}
async function adminDismissSuggestion(id){
  try{ await api.del(`/api/admin/suggestions/${id}`); toast('Dismissed'); renderAdminTab(); }
  catch(e){ toast(e.message); }
}

/* ---- shared table helper ---- */
function adminTable(headers, rows){
  return `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}
function emptyAdminState(msg){
  return `<div class="empty-state"><div class="glyph">📭</div><h3>${msg}</h3></div>`;
}
