// ============================================================================
// MARKETPLACE.JS — home page, search/filter marketplace, a single shop's
// public page, the "just listed" ticker, and the product detail modal.
// Buyer-facing only: no commission/fee figures appear anywhere in this file
// (see dashboard.css comment + seller.js for where that lives instead).
// ============================================================================

function productCard(p){
  return `
  <div class="card prod-card" onclick="openProduct('${p._id}')">
    <div class="thumb">${thumbHTML(p)}</div>
    <span class="badge-cat">${p.category}</span>
    <h3>${escapeHTML(p.title)}</h3>
    <div class="meta">${escapeHTML(p.shopName || 'MsikaX Shop')}${p.shopRating>0?` · ★${p.shopRating}`:''}${p.shopVerified?' · ✓':''}</div>
    <div class="price">${fmtMWK(p.price)}</div>
    <div class="stock-tag">${p.stock>0 ? p.stock+' in stock' : 'Out of stock'}</div>
  </div>`;
}
function shopCard(s){
  return `
  <div class="card shop-card" onclick="go('shop',{shopId:'${s._id}'})">
    <div class="thumb">${thumbHTML(s)}</div>
    <span class="badge-cat">${s.category}</span>
    <h3>${escapeHTML(s.shopName)} ${s.verified ? '<span class="verified-badge" title="Identity verified by MsikaX">✓</span>' : ''}</h3>
    <div class="meta">${s.productCount} item${s.productCount===1?'':'s'} · by ${escapeHTML(s.ownerName)}${s.rating>0?` · ★${s.rating} (${s.reviewCount})`:''}</div>
    <div class="price">Visit shop →</div>
  </div>`;
}

async function renderHome(){
  const [{shops}, {products}] = await Promise.all([api.get('/api/shops'), api.get('/api/products')]);
  document.getElementById('statShops').textContent = shops.length;
  document.getElementById('statProducts').textContent = products.length;
  const latest = [...products].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,8);
  document.getElementById('homeGrid').innerHTML = latest.map(productCard).join('') ||
    `<div class="empty-state"><div class="glyph">🗂️</div><h3>No listings yet</h3><p>Be the first to open a shop.</p></div>`;
}

let marketCat = 'All';
let marketDebounce = null;
let marketTab = 'products';
let shopBrowseCat = 'All';

function setMarketTab(tab){
  marketTab = tab;
  document.getElementById('marketTabProducts').classList.toggle('active', tab==='products');
  document.getElementById('marketTabShops').classList.toggle('active', tab==='shops');
  document.getElementById('productSearchPanel').classList.toggle('hidden', tab!=='products');
  document.getElementById('shopBrowsePanel').classList.toggle('hidden', tab!=='shops');
  if(tab==='shops') renderShopBrowse(); else renderMarket();
}
function renderShopBrowseChips(){
  document.getElementById('shopBrowseChips').innerHTML = CATS.map(c =>
    `<button class="chip ${c===shopBrowseCat?'active':''}" onclick="setShopBrowseCat('${c}')">${c}</button>`).join('');
}
function setShopBrowseCat(c){ shopBrowseCat = c; renderShopBrowse(); }
async function renderShopBrowse(){
  renderShopBrowseChips();
  const params = new URLSearchParams();
  if(shopBrowseCat !== 'All') params.set('category', shopBrowseCat);
  if(document.getElementById('shopBrowseVerifiedOnly').checked) params.set('verifiedOnly', 'true');
  const { shops } = await api.get('/api/shops?' + params.toString());
  document.getElementById('marketCount').textContent = `${shops.length} shop${shops.length===1?'':'s'} trading`;
  document.getElementById('shopBrowseGrid').innerHTML = shops.map(shopCard).join('') ||
    `<div class="empty-state"><div class="glyph">🏪</div><h3>No shops match</h3><p>Try a different category.</p></div>`;
}

function debouncedMarketSearch(){ clearTimeout(marketDebounce); marketDebounce = setTimeout(renderMarket, 250); }
function renderMarketChips(){
  document.getElementById('marketChips').innerHTML = CATS.map(c =>
    `<button class="chip ${c===marketCat?'active':''}" onclick="setMarketCat('${c}')">${c}</button>`).join('');
}
function setMarketCat(c){ marketCat = c; renderMarket(); }
async function renderMarket(){
  renderMarketChips();
  const q = document.getElementById('marketSearch').value || '';
  const district = document.getElementById('marketDistrict').value.trim();
  const minPrice = document.getElementById('marketMinPrice').value;
  const maxPrice = document.getElementById('marketMaxPrice').value;
  const minRating = document.getElementById('marketMinRating').value;
  const sort = document.getElementById('marketSort').value;
  const verifiedOnly = document.getElementById('marketVerifiedOnly').checked;
  const params = new URLSearchParams();
  if(q) params.set('search', q);
  if(marketCat !== 'All') params.set('category', marketCat);
  if(district) params.set('district', district);
  if(minPrice) params.set('minPrice', minPrice);
  if(maxPrice) params.set('maxPrice', maxPrice);
  if(minRating) params.set('minRating', minRating);
  if(sort && sort !== 'newest') params.set('sort', sort);
  if(verifiedOnly) params.set('verifiedOnly', 'true');
  const { products } = await api.get('/api/products?' + params.toString());
  document.getElementById('marketCount').textContent = `${products.length} item${products.length===1?'':'s'} in the marketplace`;
  document.getElementById('marketGrid').innerHTML = products.map(productCard).join('') ||
    `<div class="empty-state"><div class="glyph">🔍</div><h3>Nothing matches</h3><p>Try a different search or category.</p></div>`;
}

async function renderShopDetail(){
  const { shop, products } = await api.get('/api/shops/' + state.shopId);
  document.getElementById('shopBanner').innerHTML = `
    <div class="emoji-big">${thumbHTML(shop)}</div>
    <div style="flex:1;">
      <h2>${escapeHTML(shop.shopName)} ${shop.verified ? '<span class="verified-badge" title="Identity verified by MsikaX">✓ Verified</span>' : ''}</h2>
      <p>${escapeHTML(shop.description)}</p>
      <p style="margin-top:6px;font-size:12.5px;color:var(--text-faint);">Run by ${escapeHTML(shop.ownerName)} · ${shop.category}${shop.district?(' · '+escapeHTML(shop.district)):''}${shop.rating>0?` · ★${shop.rating} (${shop.reviewCount} review${shop.reviewCount===1?'':'s'})`:''}</p>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${state.user ? (() => { const following = (state.user.following||[]).includes(shop._id); return `<button class="btn ${following?'btn-ghost':'btn-gold'} btn-sm" onclick="toggleFollow('${shop._id}',${following})">${following?'✓ Following':'+ Follow'}</button>`; })() : ''}
      ${state.user ? `<button class="btn btn-teal btn-sm" onclick="startChatFromShop('${shop._id}')">💬 Message seller</button>` : ''}
    </div>
  `;
  document.getElementById('shopProducts').innerHTML = products.map(productCard).join('') ||
    `<div class="empty-state"><div class="glyph">📦</div><h3>No items yet</h3><p>This shop hasn't listed anything.</p></div>`;
}

async function renderTicker(){
  try{
    const { products } = await api.get('/api/products');
    const latest = [...products].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,14);
    const list = latest.length ? latest : products;
    const build = list.map(p => `
      <div class="tick"><span>${p.images&&p.images.length?'🖼️':p.emoji}</span><span class="lbl">${escapeHTML(p.shopName)}</span><span class="name">${escapeHTML(p.title)}</span><span class="price">${fmtMWK(p.price)}</span></div>`).join('');
    document.getElementById('tickerTrack').innerHTML = build + build;
  }catch(e){ /* ticker is decorative — fail quietly */ }
}

/* ---- product detail modal ---- */
let lastProductList = [];
async function openProduct(id){
  let p = lastProductList.find(x=>x._id===id);
  if(!p){ const { products } = await api.get('/api/products'); lastProductList = products; p = products.find(x=>x._id===id); }
  if(!p && state.shopId){ const { products } = await api.get('/api/shops/'+state.shopId); p = products.find(x=>x._id===id); if(p) p.shopId = state.shopId; }
  if(!p){ toast('Item not found'); return; }

  showModal(`
    <div class="modal-head"><h2>${escapeHTML(p.title)}</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">${escapeHTML(p.shopName||'')}</p>
    <div class="thumb" style="aspect-ratio:2/1;font-size:56px;margin:16px 0;">${thumbHTML(p)}</div>
    <p style="color:var(--text-dim);font-size:14.5px;line-height:1.6;">${escapeHTML(p.description)}</p>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0;">
      <span class="price mono" style="font-size:20px;">${fmtMWK(p.price)}</span>
      <span class="stock-tag">${p.stock} in stock</span>
    </div>
    <button class="btn btn-gold btn-block" ${p.stock<=0?'disabled':''} onclick="addToCart('${p._id}')">${p.stock<=0?'Out of stock':'Add to cart'}</button>
    ${state.user ? (() => { const saved = (state.user.wishlist||[]).includes(p._id); return `<button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="toggleWishlist('${p._id}',${saved})">${saved?'💔 Remove from wishlist':'🤍 Save to wishlist'}</button>`; })() : ''}
    ${(p.shopId||p.seller) ? `<button class="btn btn-ghost btn-block" style="margin-top:10px;" onclick="closeModal();go('shop',{shopId:'${p.shopId||p.seller}'})">Visit shop</button>` : ''}
    <div id="productReviews" style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px;"><p class="field-note">Loading reviews…</p></div>
  `);
  loadProductReviews(id);
}
async function loadProductReviews(productId){
  const el = document.getElementById('productReviews');
  if(!el) return; // modal was closed before this resolved
  try{
    const { reviews } = await api.get(`/api/reviews/product/${productId}`);
    if(!reviews.length){ el.innerHTML = `<p class="field-note">No reviews yet — be the first to buy and review this.</p>`; return; }
    const avg = (reviews.reduce((a,r)=>a+r.rating,0) / reviews.length).toFixed(1);
    el.innerHTML = `
      <p style="font-size:13px;font-weight:600;margin:0 0 10px;">★ ${avg} · ${reviews.length} review${reviews.length===1?'':'s'}</p>
      ${reviews.slice(0,5).map(r => `
        <div style="margin-bottom:12px;">
          <div style="font-size:12.5px;"><b>${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</b> <span style="color:var(--text-faint);">${escapeHTML(r.buyer?.name||'Buyer')}</span></div>
          ${r.comment ? `<p style="font-size:13px;color:var(--text-dim);margin:4px 0 0;">${escapeHTML(r.comment)}</p>` : ''}
          ${r.sellerReply ? `<p style="font-size:12.5px;color:var(--text-faint);margin:4px 0 0;padding-left:10px;border-left:2px solid var(--border);">Seller reply: ${escapeHTML(r.sellerReply)}</p>` : ''}
        </div>`).join('')}
    `;
  }catch(e){ el.innerHTML = `<p class="field-note">Couldn't load reviews.</p>`; }
}
