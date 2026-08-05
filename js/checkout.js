// ============================================================================
// CHECKOUT.JS — payment method selection + the pay/poll/confirm flow.
// Four rails: Airtel Money, TNM Mpamba, Mo626 (via Instant Bank Transfer —
// Mo626 is NBM's banking app, not a telecom wallet), and PayChangu's own
// hosted checkout for anyone without those. The 9% MsikaX fee is applied
// automatically server-side; it is deliberately NOT surfaced to the buyer
// here (see PHASE note: fee visibility lives only in the seller dashboard).
// ============================================================================
const PAY_METHODS = [
  {id:'airtel', label:'Airtel Money', sub:'Pay via USSD prompt to your Airtel line', mark:'mark-airtel', markText:'AM'},
  {id:'mpamba', label:'TNM Mpamba', sub:'Pay via USSD prompt to your TNM line', mark:'mark-mpamba', markText:'MP'},
  {id:'mo626', label:'Mo626', sub:'Instant bank transfer from your Mo626 (NBM) app', mark:'mark-mo626', markText:'626'},
  {id:'paychangu', label:'PayChangu', sub:"Card or any method — you don't need an account with the others", mark:'mark-paychangu', markText:'PC'}
];

function openCheckout(){
  state.payContext = 'checkout';
  state.paySelected = 'airtel';
  const total = state.cart.reduce((a,c)=>a + c.product.price*c.qty, 0);
  showModal(checkoutHTML(total, 'Checkout'));
}
function checkoutHTML(total, heading){
  return `
    <div class="modal-head"><h2>${heading}</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">Choose how you'd like to pay</p>
    <div class="pay-options" id="payOptions">
      ${PAY_METHODS.map(m => `
        <label class="pay-opt ${state.paySelected===m.id?'sel':''}" data-id="${m.id}" onclick="selectPay('${m.id}')">
          <div class="pmark ${m.mark}">${m.markText}</div>
          <div class="ptext"><b>${m.label}</b><span>${m.sub}</span></div>
          <input type="radio" name="pay" ${state.paySelected===m.id?'checked':''}>
        </label>`).join('')}
    </div>
    <div id="payPhoneWrap"><label>Mobile money number</label><input type="tel" id="payPhone" placeholder="+265 9XX XXX XXX"></div>
    <div class="err-text" id="payErr"></div>
    <div class="summary-row total" style="margin-top:16px;"><span>Total due</span><span class="mono">${fmtMWK(total)}</span></div>
    <button class="btn btn-gold btn-block" style="margin-top:14px;" onclick="submitPayment(${total})">Pay ${fmtMWK(total)}</button>
    <p class="field-note" style="margin-top:12px;text-align:center;">Approve the prompt on your phone, or complete the page that opens.</p>
  `;
}
function selectPay(id){
  state.paySelected = id;
  document.querySelectorAll('.pay-opt').forEach(el => {
    const sel = el.dataset.id===id;
    el.classList.toggle('sel', sel);
    el.querySelector('input').checked = sel;
  });
  document.getElementById('payPhoneWrap').style.display = (id==='paychangu') ? 'none' : 'block';
}

async function submitPayment(total){
  const method = state.paySelected;
  const phone = document.getElementById('payPhone') ? document.getElementById('payPhone').value.trim() : '';
  const err = document.getElementById('payErr');
  if(method !== 'paychangu' && (!phone || phone.length < 7)){
    err.textContent = 'Enter the mobile number linked to your payment account.'; err.style.display = 'block'; return;
  }
  const path = state.payContext === 'subscribe' ? '/api/subscriptions' : '/api/checkout';
  showModal(`<div class="pay-processing"><div class="spinner"></div><h3 style="margin:0 0 8px;">Starting payment…</h3><p style="color:var(--text-dim);font-size:14px;">Contacting PayChangu.</p></div>`);
  try{
    const data = await api.post(path, { method, phone });
    if(data.checkoutUrl) window.open(data.checkoutUrl, '_blank');
    showModal(`
      <div class="pay-processing">
        <div class="spinner"></div>
        <h3 style="margin:0 0 8px;">${method==='mo626'?'Complete the transfer':method==='paychangu'?'Finish on the PayChangu page':'Confirm on your phone'}</h3>
        <p style="color:var(--text-dim);font-size:14px;">${data.instructions||''}</p>
        <p class="mono" style="color:var(--text-faint);font-size:12px;margin-top:14px;">Ref ${data.chargeId}</p>
      </div>`);
    pollPaymentStatus(data.chargeId, 0);
  }catch(e){
    showModal(`<div class="pay-processing"><h3 style="margin:0 0 8px;color:var(--coral);">Payment failed to start</h3><p style="color:var(--text-dim);font-size:14px;">${escapeHTML(e.message)}</p><button class="btn btn-ghost btn-block" style="margin-top:18px;" onclick="closeModal()">Close</button></div>`);
  }
}
async function pollPaymentStatus(chargeId, attempt){
  if(attempt >= 20){
    showModal(`<div class="pay-processing"><h3 style="margin:0 0 8px;">Still waiting</h3><p style="color:var(--text-dim);font-size:14px;">We haven't received confirmation yet — check your phone, or look again shortly.</p><button class="btn btn-ghost btn-block" style="margin-top:18px;" onclick="closeModal()">Close</button></div>`);
    return;
  }
  try{
    if(state.payContext === 'subscribe'){
      const { status, listingStatus } = await api.get(`/api/subscriptions/${chargeId}/status`);
      if(status==='success'||status==='successful'){ state.listingStatus = listingStatus; showSubscribeSuccess(); return; }
      if(status==='failed'){ showPaymentFailed(); return; }
    }else{
      const { order } = await api.get(`/api/checkout/${chargeId}/status`);
      if(order.paymentStatus==='paid'){ showPaymentSuccess(order); return; }
      if(order.paymentStatus==='failed'){ showPaymentFailed(); return; }
    }
  }catch(e){ /* keep polling through transient errors */ }
  setTimeout(()=>pollPaymentStatus(chargeId, attempt+1), 3000);
}
function showPaymentFailed(){
  showModal(`<div class="pay-processing"><h3 style="margin:0 0 8px;color:var(--coral);">Payment failed</h3><p style="color:var(--text-dim);font-size:14px;">The transaction wasn't completed. You can try again.</p><button class="btn btn-ghost btn-block" style="margin-top:18px;" onclick="closeModal()">Close</button></div>`);
}
function showPaymentSuccess(order){
  showModal(`
    <div class="pay-success" style="text-align:center;">
      <div class="check">✓</div>
      <h2 style="margin:0 0 8px;">Payment confirmed</h2>
      <p style="color:var(--text-dim);font-size:14px;">Paid ${fmtMWK(order.total)}</p>
      <p class="mono" style="color:var(--text-faint);font-size:12.5px;margin-top:6px;">Ref ${order.chargeId}</p>
      <button class="btn btn-gold btn-block" style="margin-top:22px;" onclick="closeModal();go('orders')">View my orders</button>
      <button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="closeModal();go('market')">Keep browsing</button>
    </div>`);
}
function showSubscribeSuccess(){
  showModal(`
    <div class="pay-success" style="text-align:center;">
      <div class="check">✓</div>
      <h2 style="margin:0 0 8px;">Subscription active</h2>
      <p style="color:var(--text-dim);font-size:14px;">You can now list without the free-tier limit for the next 30 days.</p>
      <button class="btn btn-gold btn-block" style="margin-top:22px;" onclick="closeModal();go('myshop')">Back to my shop</button>
    </div>`);
}

/* ---- order history: buyer-facing, no fee breakdown shown (Subtotal/Total only) ---- */
async function renderOrders(){
  const [{ orders }, { refunds }, { reviewed }] = await Promise.all([api.get('/api/orders'), api.get('/api/refunds/mine'), api.get('/api/reviews/mine')]);
  const refundByOrder = Object.fromEntries(refunds.map(r => [r.order._id || r.order, r]));
  const reviewedSet = new Set(reviewed.map(r => `${r.order}:${r.product}`));
  const el = document.getElementById('ordersContent');
  if(orders.length === 0){
    el.innerHTML = `<div class="empty-state"><div class="glyph">🧾</div><h3>No orders yet</h3><p>Your purchase history will show up here.</p></div>`;
    return;
  }
  el.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-top">
        <span class="order-ref">${o.chargeId}</span>
        <span class="status-pill ${o.paymentStatus}">${o.orderStatus === 'refunded' ? 'refunded' : o.paymentStatus}</span>
      </div>
      <div class="order-items">${o.items.map(i=>`${i.emoji||'🛍️'} ${i.qty}× ${escapeHTML(i.name)}`).join(' · ')}</div>
      <div class="order-foot">
        <span>${new Date(o.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})} · paid via ${o.method}</span>
        <span class="mono">${fmtMWK(o.total)}</span>
      </div>
      ${refundActionHTML(o, refundByOrder[o._id])}
      ${reviewActionsHTML(o, reviewedSet)}
    </div>`).join('');
}
function reviewActionsHTML(order, reviewedSet){
  if(order.paymentStatus !== 'paid') return '';
  const unreviewed = order.items.filter(i => !reviewedSet.has(`${order._id}:${i.product}`));
  if(!unreviewed.length) return '';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
    ${unreviewed.map(i => `<button class="btn btn-ghost btn-sm" onclick="openReviewModal('${order._id}','${i.product}','${escapeHTML(i.name).replace(/'/g,"\\'")}')">Review "${escapeHTML(i.name)}"</button>`).join('')}
  </div>`;
}
function openReviewModal(orderId, productId, productName){
  state.selectedReviewRating = 5;
  showModal(`
    <div class="modal-head"><h2>Review ${productName}</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <label>Rating</label>
    <div id="reviewStars" style="font-size:26px;letter-spacing:4px;cursor:pointer;">${'★★★★★'}</div>
    <label style="margin-top:14px;">Comment (optional)</label>
    <textarea id="reviewComment" placeholder="How was it?"></textarea>
    <div class="err-text" id="reviewErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitReview('${orderId}','${productId}')">Submit review</button>
  `);
  const starsEl = document.getElementById('reviewStars');
  starsEl.onclick = (e) => {
    const rect = starsEl.getBoundingClientRect();
    const starWidth = rect.width / 5;
    const n = Math.min(5, Math.max(1, Math.ceil((e.clientX - rect.left) / starWidth)));
    state.selectedReviewRating = n;
    starsEl.textContent = '★'.repeat(n) + '☆'.repeat(5-n);
  };
}
async function submitReview(orderId, productId){
  const comment = document.getElementById('reviewComment').value.trim();
  const err = document.getElementById('reviewErr');
  try{
    await api.post('/api/reviews', { orderId, productId, rating: state.selectedReviewRating, comment });
    toast('Review submitted — thanks!');
    closeModal();
    go('orders');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
function refundActionHTML(order, refund){
  if(order.paymentStatus !== 'paid' || order.orderStatus === 'refunded') return '';
  if(!refund) return `<button class="btn btn-ghost btn-sm" style="margin-top:10px;" onclick="openRefundRequest('${order._id}')">Request refund</button>`;
  const labels = { requested: 'Refund requested — awaiting seller', seller_responded: 'Refund under admin review', approved: 'Refund approved', rejected: 'Refund rejected' };
  return `<p class="field-note" style="margin-top:10px;">${labels[refund.status] || refund.status}${refund.status==='rejected'&&refund.adminNote ? ': '+escapeHTML(refund.adminNote) : ''}</p>`;
}
function openRefundRequest(orderId){
  showModal(`
    <div class="modal-head"><h2>Request a refund</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">The seller will see this, then a MsikaX admin reviews and decides.</p>
    <label>Why are you requesting a refund?</label>
    <textarea id="refundReason" placeholder="e.g. Item never arrived, wrong item, damaged on arrival…"></textarea>
    <div class="err-text" id="refundErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitRefundRequest('${orderId}')">Submit request</button>
  `);
}
async function submitRefundRequest(orderId){
  const reason = document.getElementById('refundReason').value.trim();
  const err = document.getElementById('refundErr');
  if(!reason){ err.textContent = 'Tell us what happened.'; err.style.display = 'block'; return; }
  try{
    await api.post(`/api/refunds/orders/${orderId}`, { reason });
    toast('Refund requested');
    closeModal();
    go('orders');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
