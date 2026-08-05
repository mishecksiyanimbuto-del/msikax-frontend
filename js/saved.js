// ============================================================================
// SAVED.JS — the "Saved" page (wishlist + following tabs), plus the
// toggleWishlist()/toggleFollow() functions called from marketplace.js's
// product modal and shop page so a buyer never has to leave what they're
// looking at just to save it.
// ============================================================================

let savedTab = 'wishlist';
function setSavedTab(tab){
  savedTab = tab;
  document.getElementById('savedTabWishlist').classList.toggle('active', tab==='wishlist');
  document.getElementById('savedTabFollowing').classList.toggle('active', tab==='following');
  renderSaved();
}

async function renderSaved(){
  const el = document.getElementById('savedContent');
  if(savedTab === 'wishlist'){
    const { products } = await api.get('/api/wishlist');
    el.innerHTML = products.length
      ? `<div class="grid">${products.map(productCard).join('')}</div>`
      : `<div class="empty-state"><div class="glyph">🤍</div><h3>Nothing saved yet</h3><p>Tap the heart on any item to add it here.</p></div>`;
  }else{
    const { shops } = await api.get('/api/follow');
    el.innerHTML = shops.length
      ? `<div class="grid">${shops.map(s => `
          <div class="card shop-card" onclick="go('shop',{shopId:'${s._id}'})">
            <div class="thumb">${thumbHTML(s)}</div>
            <span class="badge-cat">${s.category}</span>
            <h3>${escapeHTML(s.shopName)} ${s.verified?'<span class="verified-badge">✓</span>':''}</h3>
            <div class="meta">${s.rating>0?`★ ${s.rating} (${s.reviewCount})`:'No reviews yet'}</div>
          </div>`).join('')}</div>`
      : `<div class="empty-state"><div class="glyph">👥</div><h3>Not following any shops</h3><p>Follow a shop to hear about their new listings.</p></div>`;
  }
}

/** Called from the product detail modal (marketplace.js). */
async function toggleWishlist(productId, isSaved){
  try{
    if(isSaved){ await api.del(`/api/wishlist/${productId}`); state.user.wishlist = (state.user.wishlist||[]).filter(id => id !== productId); }
    else{ await api.post(`/api/wishlist/${productId}`); state.user.wishlist = [...(state.user.wishlist||[]), productId]; }
    toast(isSaved ? 'Removed from wishlist' : 'Added to wishlist');
    closeModal();
    openProduct(productId); // reopen to flip the button state
  }catch(e){ toast(e.message); }
}

/** Called from the shop detail page (marketplace.js). */
async function toggleFollow(shopId, isFollowing){
  try{
    if(isFollowing){ await api.del(`/api/follow/${shopId}`); state.user.following = (state.user.following||[]).filter(id => id !== shopId); }
    else{ await api.post(`/api/follow/${shopId}`); state.user.following = [...(state.user.following||[]), shopId]; }
    toast(isFollowing ? 'Unfollowed' : `Following — you'll hear about their new listings`);
    go('shop', { shopId });
  }catch(e){ toast(e.message); }
}
