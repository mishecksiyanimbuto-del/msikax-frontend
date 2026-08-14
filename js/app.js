// ============================================================================
// APP.JS — shared state, the view router, the modal/toast shell, and init.
// Every other module reads/writes `state` and calls go()/showModal()/toast()
// from here rather than keeping its own copies.
// ============================================================================

// Global API configuration pointing to your live Railway backend
const api = window.api || {
  base: "https://msikax-backend-production.up.railway.app"
};

const CATS = ['All','Fashion','Electronics','Food & Produce','Home & Living','Crafts','Beauty','Other'];
const EMOJIS = ['🛍️','👗','📱','🍅','🪑','🧺','💄','🥾','🧵','🐐','🍞','🧴','🎨','🚲','🧢'];

const state = {
  view:'home', shopId:null, user:null,
  authMode:'signup', paySelected:'airtel', payContext:'checkout',
  cart:[], myShop:null, myShopProducts:[], listingStatus:null,
  selectedPhotoFiles:[], selectedShopLogoFile:null, activeConversationId:null, chatPollTimer:null,
  walletBalance:0, ledgerPage:1
};

function fmtMWK(n){ return 'MK ' + Number(n).toLocaleString('en-US'); }

// Every product title/description, shop name/description, and message in
// this app is user-supplied. All of it goes into innerHTML somewhere, so
// ALL of it must pass through this first — otherwise a shop named
// `<img src=x onerror="steal(localStorage)">` runs in every buyer's
// browser who views it. Used everywhere user text is interpolated into a
// template string, not just in chat.
function escapeHTML(s){
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

// Cloudinary gives back a full absolute URL already; local-disk fallback
// only gives a relative path like /uploads/products/x.jpg that needs the
// backend's own origin prepended. Handle both without needing to know
// which backend is in use.
function imgUrl(path){ return path ? (/^https?:\/\//.test(path) ? path : api.base + path) : null; }
function thumbHTML(item){
  const raw = (item.images && item.images.length) ? item.images[0] : (item.logo || null);
  const src = imgUrl(raw);
  return src ? `<img src="${src}" alt="${escapeHTML(item.title||item.shopName||'')}">` : (item.emoji || '🛍️');
}
function cartCount(){ return state.cart.reduce((a,c)=>a+c.qty,0); }

function toast(msg){
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  const root = document.getElementById('toastRoot');
  if(root) root.appendChild(el);
  setTimeout(()=>el.remove(), 2800);
}

window.addEventListener('msikax:backend-unreachable', () => {
  const modalRoot = document.getElementById('modalRoot');
  if(modalRoot) modalRoot.innerHTML = '';
  toast("Can't reach the MsikaX backend — is the server running at " + api.base + "?");
});

/* ============ MODAL SHELL ============ */
function showModal(inner, opts={}){
  const modalRoot = document.getElementById('modalRoot');
  if(modalRoot){
    modalRoot.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
        <div class="modal ${opts.wide?'wide':''}">${inner}</div>
      </div>`;
  }
}

function closeModal(){ 
  const modalRoot = document.getElementById('modalRoot');
  if(modalRoot) modalRoot.innerHTML=''; 
}

document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

/* ============ ROUTER ============ */
async function go(view, opts={}){
  closeMobileNav();
  if((view==='myshop'||view==='cart'||view==='orders'||view==='chats'||view==='wallet'||view==='admin'||view==='shoprefunds'||view==='shopreviews'||view==='saved') && !state.user){
    if(typeof openAuth === 'function') openAuth('login'); 
    toast('Log in to continue'); 
    return;
  }
  if(view==='admin' && state.user?.role !== 'admin'){ toast('Admin access required'); return; }
  if(typeof stopChatPolling === 'function') stopChatPolling();
  
  state.view = view;
  if(opts.shopId) state.shopId = opts.shopId;
  
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  const targetView = document.getElementById('view-'+view);
  if(targetView) targetView.classList.remove('hidden');
  
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  window.scrollTo({top:0, behavior:'smooth'});
  
  renderNavRight();
  if(typeof renderTicker === 'function') renderTicker();
  
  try{
    if(view==='home' && typeof renderHome === 'function') await renderHome();
    if(view==='market') await (typeof marketTab !== 'undefined' && marketTab==='shops' ? (typeof renderShopBrowse === 'function' && renderShopBrowse()) : (typeof renderMarket === 'function' && renderMarket()));
    if(view==='shop' && typeof renderShopDetail === 'function') await renderShopDetail();
    if(view==='myshop' && typeof renderMyShop === 'function') await renderMyShop();
    if(view==='cart' && typeof renderCart === 'function') await renderCart();
    if(view==='orders' && typeof renderOrders === 'function') await renderOrders();
    if(view==='chats' && typeof renderChatList === 'function') await renderChatList();
    if(view==='wallet' && typeof renderWallet === 'function') await renderWallet();
    if(view==='shoprefunds' && typeof renderShopRefunds === 'function') await renderShopRefunds();
    if(view==='shopreviews' && typeof renderShopReviews === 'function') await renderShopReviews();
    if(view==='saved' && typeof renderSaved === 'function') await renderSaved();
    if(view==='admin' && typeof renderAdmin === 'function') await renderAdmin();
  }catch(e){ 
    console.error("Router error:", e); 
    /* api.js already surfaced a toast on network failure */ 
  }
}

/* ============ NAV RIGHT ============ */
function renderNavRight(){
  const el = document.getElementById('navRight');
  if(!el) return;
  const u = state.user;
  if(!u){
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" onclick="openAuth('login')">Log in</button>
      <button class="btn btn-gold btn-sm" onclick="openAuth('signup')">Open a shop</button>`;
  }else{
    el.innerHTML = `
      <div class="account-pill"><div class="avatar">${escapeHTML(u.name.charAt(0).toUpperCase())}</div>${escapeHTML(u.name.split(' ')[0])}</div>
      <button class="btn btn-ghost btn-sm" onclick="logout()">Log out</button>`;
  }
  
  const adminNavBtn = document.getElementById('adminNavBtn');
  if(adminNavBtn) adminNavBtn.classList.toggle('hidden', u?.role !== 'admin');
  
  const adminNavBtnMobile = document.getElementById('adminNavBtnMobile');
  if(adminNavBtnMobile) adminNavBtnMobile.classList.toggle('hidden', u?.role !== 'admin');
  
  const notifWrap = document.getElementById('notifWrap');
  if(notifWrap) notifWrap.classList.toggle('hidden', !u);
  
  if(u) {
    if(typeof refreshNotifBadge === 'function') refreshNotifBadge();
  } else {
    if(typeof stopNotifPolling === 'function') stopNotifPolling();
  }
  
  const n = cartCount();
  for(const id of ['cartCount','cartCountMobile']){
    const cc = document.getElementById(id);
    if(cc){
      cc.textContent = n;
      cc.classList.toggle('hidden', n===0);
    }
  }
}

/* ============ MOBILE NAV DRAWER ============ */
function toggleMobileNav(){
  const drawer = document.getElementById('mobileNavDrawer');
  if(drawer) drawer.classList.toggle('hidden');
}

function closeMobileNav(){
  const drawer = document.getElementById('mobileNavDrawer');
  if(drawer) drawer.classList.add('hidden');
}

/* ============ INIT ============ */
async function initApp(){
  if(typeof restoreSession === 'function') await restoreSession();
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  if(resetToken){ 
    go('home'); 
    if(typeof openResetPassword === 'function') openResetPassword(resetToken); 
    return; 
  }
  go('home');
}