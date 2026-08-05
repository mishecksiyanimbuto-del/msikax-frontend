// ============================================================================
// APP.JS — shared state, the view router, the modal/toast shell, and init.
// Every other module reads/writes `state` and calls go()/showModal()/toast()
// from here rather than keeping its own copies.
// ============================================================================
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
function imgUrl(path){ return path ? api.base + path : null; }
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
  document.getElementById('toastRoot').appendChild(el);
  setTimeout(()=>el.remove(), 2800);
}
window.addEventListener('msikax:backend-unreachable', () => {
  document.getElementById('modalRoot').innerHTML = '';
  toast("Can't reach the MsikaX backend — is the server running at " + api.base + "?");
});

/* ============ MODAL SHELL ============ */
function showModal(inner, opts={}){
  document.getElementById('modalRoot').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal ${opts.wide?'wide':''}">${inner}</div>
    </div>`;
}
function closeModal(){ document.getElementById('modalRoot').innerHTML=''; }
document.addEventListener('keydown', e => { if(e.key==='Escape') closeModal(); });

/* ============ ROUTER ============ */
async function go(view, opts={}){
  if((view==='myshop'||view==='cart'||view==='orders'||view==='chats'||view==='wallet'||view==='admin'||view==='shoprefunds'||view==='shopreviews'||view==='saved') && !state.user){
    openAuth('login'); toast('Log in to continue'); return;
  }
  if(view==='admin' && state.user?.role !== 'admin'){ toast('Admin access required'); return; }
  stopChatPolling();
  state.view = view;
  if(opts.shopId) state.shopId = opts.shopId;
  document.querySelectorAll('.view').forEach(v=>v.classList.add('hidden'));
  document.getElementById('view-'+view).classList.remove('hidden');
  document.querySelectorAll('.navbtn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  window.scrollTo({top:0, behavior:'smooth'});
  renderNavRight();
  renderTicker();
  try{
    if(view==='home') await renderHome();
    if(view==='market') await (marketTab==='shops' ? renderShopBrowse() : renderMarket());
    if(view==='shop') await renderShopDetail();
    if(view==='myshop') await renderMyShop();
    if(view==='cart') await renderCart();
    if(view==='orders') await renderOrders();
    if(view==='chats') await renderChatList();
    if(view==='wallet') await renderWallet();
    if(view==='shoprefunds') await renderShopRefunds();
    if(view==='shopreviews') await renderShopReviews();
    if(view==='saved') await renderSaved();
    if(view==='admin') await renderAdmin();
  }catch(e){ /* api.js already surfaced a toast on network failure */ }
}

/* ============ NAV RIGHT ============ */
function renderNavRight(){
  const el = document.getElementById('navRight');
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
  document.getElementById('adminNavBtn').classList.toggle('hidden', u?.role !== 'admin');
  document.getElementById('notifWrap').classList.toggle('hidden', !u);
  if(u) refreshNotifBadge(); else stopNotifPolling();
  const cc = document.getElementById('cartCount');
  const n = cartCount();
  cc.textContent = n;
  cc.classList.toggle('hidden', n===0);
}

/* ============ INIT ============ */
// Deliberately NOT auto-run here: this file loads before auth.js/marketplace.js/
// etc. define restoreSession()/renderHome()/etc., so index.html calls
// initApp() itself in a script tag placed after every module has loaded.
async function initApp(){
  await restoreSession();
  const resetToken = new URLSearchParams(window.location.search).get('resetToken');
  if(resetToken){ go('home'); openResetPassword(resetToken); return; }
  go('home');
}
