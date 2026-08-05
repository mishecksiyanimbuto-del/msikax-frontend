// ============================================================================
// CHAT.JS (Phase 11.5) — buyer <-> seller messaging. A buyer can only ever
// start a conversation from a shop page (see startChatFromShop below,
// called from marketplace.js); this file just handles listing
// conversations and the message thread itself.
// ============================================================================

/** Called from the shop page's "💬 Message seller" button. */
async function startChatFromShop(shopId){
  try{
    const { conversation } = await api.post('/api/chats', { shopId });
    go('chats');
    openConversation(conversation._id, 'buyer');
  }catch(e){ toast(e.message); }
}

/** The inbox: buyer's own conversations, plus — if they also run a shop — their shop's inbox. */
async function renderChatList(){
  const el = document.getElementById('chatsContent');
  const [{ conversations: mine }, shopConvos] = await Promise.all([
    api.get('/api/chats'),
    state.myShop ? api.get('/api/chats/shop').then(r=>r.conversations).catch(()=>[]) : Promise.resolve(null)
  ]);

  el.innerHTML = `
    <div class="section-head"><h2>Messages I've sent</h2><p>Conversations you've started with sellers</p></div>
    <div class="chat-list">${conversationRowsHTML(mine, 'buyer')}</div>
    ${shopConvos !== null ? `
      <div class="section-head" style="margin-top:32px;"><h2>Messages to my shop</h2><p>Buyers asking about ${escapeHTML(state.myShop.shopName)}</p></div>
      <div class="chat-list">${conversationRowsHTML(shopConvos, 'seller')}</div>
    ` : ''}
    <div id="chatThreadWrap"></div>
  `;
}

function conversationRowsHTML(conversations, role){
  if(!conversations.length) return `<div class="empty-state"><div class="glyph">💬</div><h3>No conversations yet</h3><p>${role==='buyer' ? 'Message a seller from their shop page.' : 'Buyers will show up here once they message you.'}</p></div>`;
  return conversations.map(c => {
    const title = role==='buyer' ? (c.shop ? c.shop.shopName : 'Shop') : (c.buyer ? c.buyer.name : 'Buyer');
    const emoji = role==='buyer' && c.shop ? c.shop.emoji : '👤';
    return `
    <div class="chat-row" onclick="openConversation('${c._id}','${role}')">
      <div class="emoji">${emoji}</div>
      <div class="meta"><b>${escapeHTML(title)}</b><span>${escapeHTML(c.lastMessage || 'No messages yet')}</span></div>
    </div>`;
  }).join('');
}

/** Opens (or refreshes) the message thread for one conversation, and starts light polling for new messages. */
async function openConversation(id, role){
  state.activeConversationId = id;
  stopChatPolling();
  await refreshThread(id);
  state.chatPollTimer = setInterval(()=>refreshThread(id, true), 4000);
}
async function refreshThread(id, silent){
  let data;
  try{ data = await api.get(`/api/chats/${id}/messages`); }
  catch(e){ if(!silent) toast(e.message); return; }
  const wrap = document.getElementById('chatThreadWrap');
  if(!wrap) return; // navigated away
  const me = state.user._id;
  wrap.innerHTML = `
    <div class="form-panel wide" style="margin-top:20px;">
      <div class="chat-thread" id="chatThread">
        ${data.messages.map(m => `<div class="chat-bubble ${m.sender===me?'mine':'theirs'}">${escapeHTML(m.text)}</div>`).join('') || '<p class="field-note">Say hello 👋</p>'}
      </div>
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="Type a message…" onkeydown="if(event.key==='Enter')sendChatMessage('${id}')">
        <button class="btn btn-gold btn-sm" onclick="sendChatMessage('${id}')">Send</button>
      </div>
    </div>`;
  const thread = document.getElementById('chatThread');
  if(thread) thread.scrollTop = thread.scrollHeight;
}
async function sendChatMessage(id){
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if(!text) return;
  input.value = '';
  try{ await api.post(`/api/chats/${id}/messages`, { text }); await refreshThread(id); }
  catch(e){ toast(e.message); }
}
function stopChatPolling(){
  if(state.chatPollTimer){ clearInterval(state.chatPollTimer); state.chatPollTimer = null; }
}
// escapeHTML() lives in app.js — shared by every module that renders user text.
