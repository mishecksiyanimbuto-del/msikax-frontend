// ============================================================================
// CART.JS — server-side cart: fetch, add, change quantity, remove.
// Buyer only ever sees Subtotal / Delivery / Total here — no fee breakdown
// (that stays private to the seller's own dashboard, see seller.js).
// ============================================================================

async function renderCart(){
  const { items } = await api.get('/api/cart');
  state.cart = items;
  renderNavRight();
  const el = document.getElementById('cartContent');
  if(items.length === 0){
    el.innerHTML = `<div class="empty-state"><div class="glyph">🛒</div><h3>Your cart is empty</h3><p>Browse the marketplace to find something.</p><button class="btn btn-gold" style="margin-top:16px;" onclick="go('market')">Go to marketplace</button></div>`;
    return;
  }
  let total = 0;
  const lines = items.map(c => {
    const p = c.product;
    total += p.price * c.qty;
    return `<div class="cart-line">
      <div class="thumb-sm">${thumbHTML(p)}</div>
      <div class="info"><b>${escapeHTML(p.title)}</b><div class="shopname">${escapeHTML(p.shopName)}</div></div>
      <div class="qty-ctrl">
        <button onclick="changeQty('${p._id}',-1)">−</button><span>${c.qty}</span><button onclick="changeQty('${p._id}',1)">+</button>
      </div>
      <div class="mono" style="min-width:90px;text-align:right;">${fmtMWK(p.price*c.qty)}</div>
      <button class="x-close" onclick="removeFromCart('${p._id}')">✕</button>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="cart-layout">
      <div>${lines}</div>
      <div class="cart-summary">
        <div class="summary-row"><span>Items</span><span class="mono">${items.reduce((a,c)=>a+c.qty,0)}</span></div>
        <div class="summary-row"><span>Delivery</span><span>Arranged with shop</span></div>
        <div class="summary-row total"><span>Total</span><span class="mono">${fmtMWK(total)}</span></div>
        <button class="btn btn-gold btn-block" style="margin-top:8px;" onclick="openCheckout()">Checkout</button>
      </div>
    </div>`;
}

async function changeQty(pid, delta){
  const line = state.cart.find(c=>c.productId===pid);
  const nextQty = (line?line.qty:0) + delta;
  try{ await api.patch('/api/cart/'+pid, { qty: nextQty }); renderCart(); }
  catch(e){ toast(e.message); }
}
async function removeFromCart(pid){ await api.del('/api/cart/'+pid); renderCart(); }

async function addToCart(id){
  if(!state.user){ closeModal(); openAuth('login'); toast('Log in to add items to your cart'); return; }
  try{
    await api.post('/api/cart', { productId:id, qty:1 });
    toast('Added to cart');
    closeModal();
    renderNavRight();
    if(state.view==='cart') renderCart();
  }catch(e){ toast(e.message); }
}
