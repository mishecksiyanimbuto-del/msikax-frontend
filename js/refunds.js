// ============================================================================
// REFUNDS.JS — the seller's side of a refund request. Sellers can only add
// context (see or dispute the buyer's reason); they never approve or deny
// it themselves — that's an admin-only action (adminController.js), so
// there's deliberately no "approve" button anywhere in this file.
// ============================================================================

async function renderShopRefunds(){
  const el = document.getElementById('shopRefundsContent');
  let refunds;
  try{ ({ refunds } = await api.get('/api/refunds/shop')); }
  catch(e){ el.innerHTML = `<div class="empty-state"><div class="glyph">🏪</div><h3>Open a shop first</h3><p>${escapeHTML(e.message)}</p></div>`; return; }

  if(!refunds.length){
    el.innerHTML = `<div class="empty-state"><div class="glyph">↩</div><h3>No refund requests</h3><p>Nothing pending against your shop right now.</p></div>`;
    return;
  }

  const statusLabel = { requested: 'Awaiting your response', seller_responded: 'Under admin review', approved: 'Approved — refunded', rejected: 'Rejected' };
  el.innerHTML = refunds.map(r => `
    <div class="order-card">
      <div class="order-top">
        <span class="order-ref">${escapeHTML(r.order.chargeId)}</span>
        <span class="status-pill ${r.status==='approved'?'paid':r.status==='rejected'?'failed':'pending'}">${statusLabel[r.status]||r.status}</span>
      </div>
      <p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;"><b>Buyer's reason:</b> ${escapeHTML(r.reason)}</p>
      ${r.sellerResponse ? `<p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;"><b>Your response:</b> ${escapeHTML(r.sellerResponse)}</p>` : ''}
      ${r.status==='rejected' && r.adminNote ? `<p style="color:var(--text-faint);font-size:12.5px;margin:6px 0;"><b>Admin note:</b> ${escapeHTML(r.adminNote)}</p>` : ''}
      <div class="order-foot"><span>${new Date(r.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})}</span><span class="mono">${fmtMWK(r.order.total)}</span></div>
      ${r.status==='requested' ? `<button class="btn btn-gold btn-sm" style="margin-top:10px;" onclick="openRefundResponse('${r._id}')">Respond</button>` : ''}
    </div>`).join('');
}

function openRefundResponse(refundId){
  showModal(`
    <div class="modal-head"><h2>Respond to this request</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">This goes to a MsikaX admin, who makes the final call — not a decision you make here.</p>
    <label>Your response</label>
    <textarea id="sellerRefundResponse" placeholder="e.g. I shipped it on time, here's the tracking number… or, I agree, the item was faulty."></textarea>
    <div class="err-text" id="refundRespondErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitRefundResponse('${refundId}')">Send response</button>
  `);
}
async function submitRefundResponse(refundId){
  const response = document.getElementById('sellerRefundResponse').value.trim();
  const err = document.getElementById('refundRespondErr');
  if(!response){ err.textContent = 'Add a response before sending.'; err.style.display = 'block'; return; }
  try{
    await api.post(`/api/refunds/${refundId}/respond`, { response });
    toast('Response sent — an admin will review it');
    closeModal();
    go('shoprefunds');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
