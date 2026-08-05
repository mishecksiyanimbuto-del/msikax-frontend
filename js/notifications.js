// ============================================================================
// NOTIFICATIONS.JS — polls the same way chat.js and checkout.js already do
// (see the note in server/services/notificationService.js for why this
// isn't a websocket). Every 20s while logged in, refresh the unread badge;
// the full list only loads when the bell is actually clicked.
// ============================================================================

let notifPollTimer = null;

function startNotifPolling(){
  if(notifPollTimer) return; // already running
  notifPollTimer = setInterval(refreshNotifBadge, 20000);
}
function stopNotifPolling(){
  if(notifPollTimer){ clearInterval(notifPollTimer); notifPollTimer = null; }
}

async function refreshNotifBadge(){
  startNotifPolling();
  try{
    const { unreadCount } = await api.get('/api/notifications');
    const badge = document.getElementById('notifBadge');
    badge.textContent = unreadCount;
    badge.classList.toggle('hidden', unreadCount === 0);
  }catch(e){ /* quiet — a missed badge refresh isn't worth a toast */ }
}

async function toggleNotifPanel(){
  const panel = document.getElementById('notifPanel');
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if(opening) await loadNotifPanel();
}
async function loadNotifPanel(){
  const panel = document.getElementById('notifPanel');
  panel.innerHTML = `<div class="notif-loading">Loading…</div>`;
  try{
    const { notifications } = await api.get('/api/notifications');
    panel.innerHTML = notificationListHTML(notifications);
  }catch(e){ panel.innerHTML = `<div class="notif-loading">Couldn't load notifications.</div>`; }
}

const NOTIF_ICONS = {
  order_paid: '✅', order_refunded: '↩', new_order: '🛍️',
  withdrawal_paid: '💰', withdrawal_failed: '⚠️',
  verification_approved: '✓', verification_rejected: '✕',
  refund_requested: '↩', refund_resolved: '↩', product_out_of_stock: '📦', new_review: '⭐', shop_new_listing: '🆕'
};

function notificationListHTML(notifications){
  if(!notifications.length) return `<div class="notif-loading">You're all caught up.</div>`;
  const hasUnread = notifications.some(n => !n.read);
  return `
    ${hasUnread ? `<button class="notif-mark-all" onclick="markAllNotifsRead()">Mark all as read</button>` : ''}
    ${notifications.map(n => `
      <div class="notif-row ${n.read?'':'unread'}" onclick="markNotifRead('${n._id}')">
        <span class="notif-icon">${NOTIF_ICONS[n.type]||'🔔'}</span>
        <div class="notif-text"><b>${escapeHTML(n.title)}</b><span>${escapeHTML(n.body)}</span><span class="notif-time">${timeAgo(n.createdAt)}</span></div>
      </div>`).join('')}
  `;
}

function timeAgo(iso){
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if(mins < 1) return 'just now';
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins/60);
  if(hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs/24)}d ago`;
}

async function markNotifRead(id){
  try{ await api.patch(`/api/notifications/${id}/read`); await loadNotifPanel(); refreshNotifBadge(); }
  catch(e){ /* quiet */ }
}
async function markAllNotifsRead(){
  try{ await api.patch('/api/notifications/read-all'); await loadNotifPanel(); refreshNotifBadge(); }
  catch(e){ /* quiet */ }
}

// Close the panel when clicking anywhere outside it.
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('notifWrap');
  const panel = document.getElementById('notifPanel');
  if(wrap && !wrap.contains(e.target) && panel && !panel.classList.contains('hidden')) panel.classList.add('hidden');
});
