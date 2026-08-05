// ============================================================================
// REVIEWS.JS — the seller's side of reviews: read what buyers said about
// their products, reply for context. Reuses the same public
// GET /api/reviews/shop/:shopId endpoint a buyer's shop-page view would use
// (via /api/shops/mine first, to resolve this seller's own shop id) rather
// than adding a second, near-duplicate "my shop's reviews" endpoint.
// ============================================================================

async function renderShopReviews(){
  const el = document.getElementById('shopReviewsContent');
  let shop;
  try{ ({ shop } = await api.get('/api/shops/mine')); }
  catch(e){ el.innerHTML = `<div class="empty-state"><div class="glyph">🏪</div><h3>Open a shop first</h3></div>`; return; }
  if(!shop){ el.innerHTML = `<div class="empty-state"><div class="glyph">🏪</div><h3>Open a shop first</h3></div>`; return; }

  const { reviews } = await api.get(`/api/reviews/shop/${shop._id}`);
  if(!reviews.length){
    el.innerHTML = `<div class="empty-state"><div class="glyph">⭐</div><h3>No reviews yet</h3><p>They'll show up here once buyers start reviewing your items.</p></div>`;
    return;
  }
  el.innerHTML = reviews.map(r => `
    <div class="order-card">
      <div class="order-top">
        <b>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} <span style="font-weight:400;color:var(--text-faint);font-size:12.5px;">on ${escapeHTML(r.product?.title||'a product')}</span></b>
        <span class="field-note">${new Date(r.createdAt).toLocaleDateString()}</span>
      </div>
      <p style="color:var(--text-dim);font-size:13.5px;margin:6px 0;">${escapeHTML(r.buyer?.name||'Buyer')}${r.comment ? ': '+escapeHTML(r.comment) : ' left no comment.'}</p>
      ${r.sellerReply
        ? `<p style="font-size:12.5px;color:var(--text-faint);margin-top:8px;padding-left:10px;border-left:2px solid var(--border);">Your reply: ${escapeHTML(r.sellerReply)}</p>`
        : `<button class="btn btn-ghost btn-sm" style="margin-top:8px;" onclick="openReviewReply('${r._id}')">Reply</button>`}
    </div>`).join('');
}

function openReviewReply(reviewId){
  showModal(`
    <div class="modal-head"><h2>Reply to this review</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <label>Your reply</label>
    <textarea id="reviewReplyText" placeholder="Thanks for the feedback — or, here's some context…"></textarea>
    <div class="err-text" id="reviewReplyErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitReviewReply('${reviewId}')">Send reply</button>
  `);
}
async function submitReviewReply(reviewId){
  const reply = document.getElementById('reviewReplyText').value.trim();
  const err = document.getElementById('reviewReplyErr');
  if(!reply){ err.textContent = 'Write a reply before sending.'; err.style.display = 'block'; return; }
  try{
    await api.post(`/api/reviews/${reviewId}/reply`, { reply });
    toast('Reply sent');
    closeModal();
    go('shopreviews');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
