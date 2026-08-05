// ============================================================================
// SELLER.JS — "My Shop" dashboard: open a shop (with payout details), list
// items (with real photo upload + live 9% commission preview), listing
// quota / subscription banner, and payout settings.
//
// This is the ONLY place MsikaX's commission is shown to a person — the
// seller, viewing their own private dashboard. Nothing here is rendered on
// any buyer-facing page.
// ============================================================================

async function renderMyShop(){
  const el = document.getElementById('myshopContent');
  const { shop, products, listingStatus } = await api.get('/api/shops/mine');
  state.myShop = shop; state.myShopProducts = products; state.listingStatus = listingStatus;

  if(!shop){
    el.innerHTML = `
    <div class="section-head"><h2>Open your shop</h2><p>Give it a name, tell us where to pay you, and start listing.</p></div>
    <div class="form-panel wide">
      <label>Shop name</label><input type="text" id="newShopName" placeholder="e.g. Grace's Kitchen Corner">
      <div class="form-row2">
        <div><label>Category</label><select id="newShopCat">${CATS.filter(c=>c!=='All').map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div><label>District</label><input type="text" id="newShopDistrict" placeholder="e.g. Zomba"></div>
      </div>
      <label>Short description</label><textarea id="newShopDesc" placeholder="What do you sell? Who is it for?"></textarea>
      <label>Shop profile picture</label>
      <div class="photo-upload">
        <div class="photo-preview" id="shopLogoPreview">📷</div>
        <label class="file-btn" for="shopLogoInput">Choose photo</label>
        <input type="file" id="shopLogoInput" accept="image/*" class="hidden" onchange="handleShopLogoSelect(event)">
      </div>
      <p class="field-note">Optional — shops without a photo show the icon you pick below instead.</p>
      <label style="margin-top:16px;">Or pick an icon</label><div class="emoji-picker" id="shopEmojiPicker"></div>
      <label>Where should we pay you? (your 91% share, after MsikaX's 9% fee)</label>
      <div class="form-row2">
        <div><select id="newShopOperator"><option value="airtel">Airtel Money</option><option value="mpamba">TNM Mpamba</option></select></div>
        <div><input type="tel" id="newShopMobile" placeholder="+265 9XX XXX XXX"></div>
      </div>
      <p class="field-note">You can also add or change this later from your shop dashboard.</p>
      <button class="btn btn-gold btn-block" style="margin-top:20px;" onclick="createShop()">Open my shop</button>
      <div class="err-text" id="shopErr"></div>
    </div>`;
    renderEmojiPicker('shopEmojiPicker','🛍️');
    state.selectedShopLogoFile = null;
    return;
  }

  el.innerHTML = `
    <div class="shop-banner">
      <div class="emoji-big">${thumbHTML(shop)}</div>
      <div style="flex:1;">
        <h2>${escapeHTML(shop.shopName)} ${shop.verified ? '<span class="verified-badge" title="Identity verified by MsikaX">✓ Verified</span>' : ''}</h2>
        <p>${escapeHTML(shop.description)}</p>
        <p style="margin-top:6px;font-size:12px;color:var(--text-faint);">Payouts go to ${shop.payoutOperator?(shop.payoutOperator==='airtel'?'Airtel Money':'TNM Mpamba'):'— not set yet —'} ${shop.payoutMobile||''} · <button class="foot-link" style="font-size:12px;" onclick="openPayoutSettings()">edit</button> · <button class="foot-link" style="font-size:12px;" onclick="openShopLogoModal()">change photo</button></p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" onclick="go('shop',{shopId:'${shop._id}'})">View public page</button>
        <button class="btn btn-gold btn-sm" onclick="go('wallet')">💰 Wallet</button>
        <button class="btn btn-ghost btn-sm" onclick="go('shoprefunds')">↩ Refunds</button>
        <button class="btn btn-ghost btn-sm" onclick="go('shopreviews')">⭐ Reviews</button>
        <button class="btn btn-teal btn-sm" onclick="go('chats')">💬 Messages</button>
      </div>
    </div>

    ${verificationBannerHTML(shop)}
    ${listingQuotaBannerHTML(listingStatus)}

    <div class="section-head"><h2>List a new item</h2><p>Add products for buyers to find</p></div>
    <div class="form-panel wide" style="margin-bottom:36px;">
      <div class="form-row2">
        <div><label>Item name</label><input type="text" id="pName" placeholder="e.g. Ankara Handbag"></div>
        <div><label>Price (MWK)</label><input type="number" id="pPrice" placeholder="15000" oninput="updateCommissionNote()"></div>
      </div>
      <p class="commission-note" id="commissionNote">MsikaX keeps a 9% service fee on every sale — the rest is credited to your wallet, ready to withdraw.</p>
      <label>Description</label><textarea id="pDesc" placeholder="Size, condition, delivery notes…"></textarea>
      <div class="form-row2">
        <div><label>Category</label><select id="pCat">${CATS.filter(c=>c!=='All').map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div><label>Stock quantity</label><input type="number" id="pStock" placeholder="10"></div>
      </div>
      <label>Photo of the item</label>
      <div class="photo-upload">
        <div class="photo-preview" id="photoPreview">📷</div>
        <label class="file-btn" for="pPhotoInput">Choose photo</label>
        <input type="file" id="pPhotoInput" accept="image/*" class="hidden" onchange="handlePhotoSelect(event)">
      </div>
      <p class="field-note">Optional — items without a photo show a plain icon instead.</p>
      <label style="margin-top:16px;">Or pick an icon</label><div class="emoji-picker" id="prodEmojiPicker"></div>
      <button class="btn btn-teal btn-block" style="margin-top:20px;" onclick="createProduct()" ${listingStatus.allowed?'':'disabled'}>${listingStatus.allowed?'Publish item':'Subscribe to publish more'}</button>
      <div class="err-text" id="prodErr"></div>
    </div>

    <div class="section-head"><h2>Your listings (${products.length})</h2></div>
    <div class="grid">${products.map(p => `
      <div class="card prod-card" style="cursor:default;">
        <div class="thumb">${thumbHTML(p)}</div>
        <span class="badge-cat">${p.category}</span>
        <h3>${escapeHTML(p.title)}</h3>
        <div class="price">${fmtMWK(p.price)}</div>
        <div class="stock-tag">${p.stock} in stock · ${fmtMWK(Math.round(p.price*0.91))}/sale to your wallet</div>
        <button class="btn btn-danger btn-sm" style="margin-top:12px;" onclick="deleteProduct('${p._id}')">Remove listing</button>
      </div>`).join('') || `<div class="empty-state"><div class="glyph">📦</div><h3>Nothing listed yet</h3><p>Add your first item above.</p></div>`}
    </div>`;
  renderEmojiPicker('prodEmojiPicker','🛍️');
  state.selectedPhotoFiles = [];
}

function listingQuotaBannerHTML(ls){
  if(!ls) return '';
  if(ls.subscriptionActive){
    const until = new Date(ls.subscriptionExpiresAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'});
    return `<div class="quota-banner"><div class="qtext"><b>Unlimited listings active</b><span>Your subscription runs until ${until}.</span></div></div>`;
  }
  const pct = ls.freeAllowance>0 ? Math.min(100, Math.round((ls.freeUsed/ls.freeAllowance)*100)) : 100;
  const warn = !ls.allowed;
  return `
    <div class="quota-banner ${warn?'warn':''}">
      <div class="qtext">
        <b>${ls.freeAllowance>0 ? `${Math.min(ls.freeUsed,ls.freeAllowance)} of ${ls.freeAllowance} free listings used` : 'Free listing period ended'}</b>
        <span>${warn ? ls.reason : 'Free listings reset lower next month, then a subscription keeps you listing.'}</span>
        ${ls.freeAllowance>0?`<div class="quota-bar"><div class="quota-bar-fill" style="width:${pct}%;"></div></div>`:''}
      </div>
      <button class="btn ${warn?'btn-gold':'btn-ghost'} btn-sm" onclick="openSubscribeModal()">Subscribe — ${fmtMWK(ls.monthlyPrice)}/mo</button>
    </div>`;
}

/* ---- Seller verification (Phase 13): National ID (+ optional business registration), reviewed by an admin ---- */
function verificationBannerHTML(shop){
  const v = shop.verification || { status: 'unsubmitted' };
  if(v.status === 'verified') return ''; // badge already shown next to the shop name — nothing more to say here
  if(v.status === 'pending'){
    return `<div class="quota-banner"><div class="qtext"><b>Verification pending</b><span>Submitted ${new Date(v.submittedAt).toLocaleDateString()} — an admin will review it shortly.</span></div></div>`;
  }
  const rejected = v.status === 'rejected';
  return `
    <div class="quota-banner ${rejected?'warn':''}">
      <div class="qtext">
        <b>${rejected ? 'Verification rejected' : 'Get verified'}</b>
        <span>${rejected ? escapeHTML(v.rejectionReason||'Please resubmit with clearer documents.') : 'Verified shops get a badge buyers can trust — submit your National ID to apply.'}</span>
      </div>
      <button class="btn btn-gold btn-sm" onclick="openVerificationModal()">${rejected?'Resubmit':'Submit ID'}</button>
    </div>`;
}
function openVerificationModal(){
  showModal(`
    <div class="modal-head"><h2>Seller verification</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">A photo of your National ID, reviewed by a MsikaX admin. Business registration is optional but strengthens your application.</p>
    <label>National ID photo</label>
    <div class="photo-upload">
      <div class="photo-preview" id="idDocPreview">🪪</div>
      <label class="file-btn" for="idDocInput">Choose photo</label>
      <input type="file" id="idDocInput" accept="image/*" class="hidden" onchange="handleVerificationFileSelect(event,'idDocument')">
    </div>
    <label style="margin-top:16px;">Business registration (optional)</label>
    <div class="photo-upload">
      <div class="photo-preview" id="bizDocPreview">📄</div>
      <label class="file-btn" for="bizDocInput">Choose photo</label>
      <input type="file" id="bizDocInput" accept="image/*" class="hidden" onchange="handleVerificationFileSelect(event,'businessDocument')">
    </div>
    <div class="err-text" id="verifyErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:18px;" onclick="submitVerificationDocs()">Submit for review</button>
    <p class="field-note" style="margin-top:10px;">These documents are private — only you and MsikaX admins can ever view them.</p>
  `);
  state.verificationFiles = {};
}
function handleVerificationFileSelect(evt, field){
  const file = evt.target.files[0];
  if(!file) return;
  state.verificationFiles = state.verificationFiles || {};
  state.verificationFiles[field] = file;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById(field==='idDocument'?'idDocPreview':'bizDocPreview').innerHTML = `<img src="${reader.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);
}
async function submitVerificationDocs(){
  const err = document.getElementById('verifyErr');
  if(!state.verificationFiles?.idDocument){ err.textContent = 'A photo of your National ID is required.'; err.style.display = 'block'; return; }
  try{
    const form = new FormData();
    form.append('idDocument', state.verificationFiles.idDocument);
    if(state.verificationFiles.businessDocument) form.append('businessDocument', state.verificationFiles.businessDocument);
    await api.postForm('/api/shops/mine/verification', form);
    toast('Submitted — an admin will review it shortly');
    state.verificationFiles = {};
    closeModal();
    go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
function updateCommissionNote(){
  const price = Number(document.getElementById('pPrice').value) || 0;
  const note = document.getElementById('commissionNote');
  note.textContent = price > 0
    ? `MsikaX keeps 9% (${fmtMWK(Math.round(price*0.09))}) as a service fee — ${fmtMWK(Math.round(price*0.91))} is credited to your wallet per sale.`
    : "MsikaX keeps a 9% service fee on every sale — the rest is credited to your wallet, ready to withdraw.";
}
function renderEmojiPicker(containerId, selected){
  const c = document.getElementById(containerId);
  c.innerHTML = EMOJIS.map(e => `<div class="emoji-opt ${e===selected?'sel':''}" data-e="${e}" onclick="pickEmoji('${containerId}','${e}')">${e}</div>`).join('');
  c.dataset.selected = selected;
}
function pickEmoji(containerId, e){
  const c = document.getElementById(containerId);
  c.dataset.selected = e;
  [...c.children].forEach(ch => ch.classList.toggle('sel', ch.dataset.e===e));
}
function handlePhotoSelect(evt){
  const file = evt.target.files[0];
  if(!file) return;
  state.selectedPhotoFiles = [file];
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('photoPreview').innerHTML = `<img src="${reader.result}" alt="preview">`; };
  reader.readAsDataURL(file);
}
function handleShopLogoSelect(evt){
  const file = evt.target.files[0];
  if(!file) return;
  state.selectedShopLogoFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    const preview = document.getElementById('shopLogoPreview');
    if(preview) preview.innerHTML = `<img src="${reader.result}" alt="preview">`;
    const modalPreview = document.getElementById('shopLogoModalPreview');
    if(modalPreview) modalPreview.innerHTML = `<img src="${reader.result}" alt="preview">`;
  };
  reader.readAsDataURL(file);
}

async function createShop(){
  const name = document.getElementById('newShopName').value.trim();
  const desc = document.getElementById('newShopDesc').value.trim();
  const cat = document.getElementById('newShopCat').value;
  const district = document.getElementById('newShopDistrict').value.trim();
  const emoji = document.getElementById('shopEmojiPicker').dataset.selected || '🛍️';
  const payoutOperator = document.getElementById('newShopOperator').value;
  const payoutMobile = document.getElementById('newShopMobile').value.trim();
  const err = document.getElementById('shopErr');
  if(!name){ err.textContent='Give your shop a name.'; err.style.display='block'; return; }
  try{
    const form = new FormData();
    form.append('name', name); form.append('description', desc); form.append('category', cat);
    form.append('district', district); form.append('emoji', emoji);
    form.append('payoutOperator', payoutOperator); form.append('payoutMobile', payoutMobile);
    if(state.selectedShopLogoFile) form.append('logo', state.selectedShopLogoFile);
    await api.postForm('/api/shops', form);
    toast('Shop opened — start listing items');
    go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

function openShopLogoModal(){
  showModal(`
    <div class="modal-head"><h2>Shop photo</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">This is what buyers see on your shop page and in the marketplace.</p>
    <div class="photo-upload">
      <div class="photo-preview" id="shopLogoModalPreview">${state.myShop.logo?`<img src="${imgUrl(state.myShop.logo)}" alt="current photo">`:'📷'}</div>
      <label class="file-btn" for="shopLogoModalInput">Choose new photo</label>
      <input type="file" id="shopLogoModalInput" accept="image/*" class="hidden" onchange="handleShopLogoSelect(event)">
    </div>
    <div class="err-text" id="shopLogoErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:18px;" onclick="submitShopLogo()">Save photo</button>
  `);
}
async function submitShopLogo(){
  const err = document.getElementById('shopLogoErr');
  if(!state.selectedShopLogoFile){ err.textContent='Choose a photo first.'; err.style.display='block'; return; }
  try{
    const form = new FormData();
    form.append('logo', state.selectedShopLogoFile);
    await api.patchForm('/api/shops/mine/logo', form);
    toast('Shop photo updated');
    state.selectedShopLogoFile = null;
    closeModal();
    go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

async function createProduct(){
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const desc = document.getElementById('pDesc').value.trim();
  const cat = document.getElementById('pCat').value;
  const stock = parseInt(document.getElementById('pStock').value || '0');
  const emoji = document.getElementById('prodEmojiPicker').dataset.selected || '🛍️';
  const err = document.getElementById('prodErr');
  if(!name || !price || price<=0){ err.textContent='Add a name and a valid price.'; err.style.display='block'; return; }
  try{
    const form = new FormData();
    form.append('name', name); form.append('price', price); form.append('description', desc);
    form.append('category', cat); form.append('emoji', emoji); form.append('stock', stock);
    state.selectedPhotoFiles.forEach(f => form.append('photos', f));
    await api.postForm('/api/products', form);
    toast('Item published to the marketplace');
    go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
async function deleteProduct(id){
  try{ await api.del('/api/products/'+id); toast('Listing removed'); go('myshop'); }
  catch(e){ toast(e.message); }
}

function openPayoutSettings(){
  const shop = state.myShop;
  showModal(`
    <div class="modal-head"><h2>Payout details</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">Where your 91% share lands after every sale.</p>
    <label>Mobile money provider</label>
    <select id="payoutOperatorInput">
      <option value="airtel" ${shop.payoutOperator==='airtel'?'selected':''}>Airtel Money</option>
      <option value="mpamba" ${shop.payoutOperator==='mpamba'?'selected':''}>TNM Mpamba</option>
    </select>
    <label>Mobile number</label><input type="tel" id="payoutMobileInput" value="${shop.payoutMobile||''}" placeholder="+265 9XX XXX XXX">
    <div class="err-text" id="payoutErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:18px;" onclick="savePayoutSettings()">Save</button>
  `);
}
async function savePayoutSettings(){
  const payoutOperator = document.getElementById('payoutOperatorInput').value;
  const payoutMobile = document.getElementById('payoutMobileInput').value.trim();
  const err = document.getElementById('payoutErr');
  try{
    await api.patch('/api/shops/mine/payout', { payoutOperator, payoutMobile });
    toast('Payout details saved'); closeModal(); go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

function openSubscribeModal(){
  state.payContext = 'subscribe';
  state.paySelected = 'airtel';
  showModal(checkoutHTML(state.listingStatus.monthlyPrice, 'Subscribe for unlimited listings'));
}
