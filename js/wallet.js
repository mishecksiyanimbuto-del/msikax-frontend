// ============================================================================
// WALLET.JS (Phase 8/9) — the seller's private wallet: current balance
// (always server-computed, never edited here), the ledger of how it got
// there, and a withdraw button. Reached from the "My Shop" dashboard.
// ============================================================================

async function renderWallet(){
  const el = document.getElementById('walletContent');
  const { balance, recentEntries, payoutOperator, payoutMobile } = await api.get('/api/wallet');
  state.walletBalance = balance;

  const canWithdraw = payoutOperator && payoutMobile;

  el.innerHTML = `
    ${unverifiedBannerHTML()}
    <div class="wallet-hero">
      <div>
        <span class="wallet-label">Available balance</span>
        <div class="wallet-balance mono">${fmtMWK(balance)}</div>
        <span class="field-note">${canWithdraw ? `Withdraws to ${payoutOperator==='airtel'?'Airtel Money':'TNM Mpamba'} ${payoutMobile}` : 'Add a payout number in shop settings to withdraw.'}</span>
      </div>
      <button class="btn btn-gold" ${canWithdraw && balance>0 && state.user.verified ? '' : 'disabled'} onclick="openWithdrawModal(${balance})">Withdraw</button>
    </div>

    <div class="section-head" style="margin-top:32px;"><h2>Ledger</h2><p>Every sale, fee, and withdrawal — nothing here is ever edited by hand, only added to.</p></div>
    <div class="ledger-list" id="ledgerList">${ledgerRowsHTML(recentEntries)}</div>
    <button class="btn btn-ghost btn-sm" style="margin-top:14px;" onclick="loadMoreLedger()">Show full history</button>
  `;
  state.ledgerPage = 1;
}

function ledgerRowsHTML(entries){
  if(!entries.length) return `<div class="empty-state"><div class="glyph">🧾</div><h3>No activity yet</h3><p>Ledger entries appear here as soon as you make a sale.</p></div>`;
  return entries.map(e => {
    const positive = e.amount >= 0;
    const labels = { sale:'Sale', commission:'MsikaX service fee', withdrawal:'Withdrawal', refund_adjustment:'Refund adjustment' };
    return `
    <div class="ledger-row">
      <div class="ledger-type">
        <b>${labels[e.type]||e.type}</b>
        <span>${new Date(e.createdAt).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'})} · ${e.description||''}</span>
      </div>
      <div class="ledger-amounts">
        <span class="mono ${positive?'credit':'debit'}">${positive?'+':''}${fmtMWK(e.amount)}</span>
        <span class="mono ledger-balance-after">bal ${fmtMWK(e.balanceAfter)}</span>
      </div>
    </div>`;
  }).join('');
}

async function loadMoreLedger(){
  state.ledgerPage = (state.ledgerPage||1) + 1;
  const { entries } = await api.get('/api/wallet/ledger?page='+state.ledgerPage);
  if(!entries.length){ toast('No more history'); return; }
  document.getElementById('ledgerList').insertAdjacentHTML('beforeend', ledgerRowsHTML(entries));
}

function openWithdrawModal(balance){
  showModal(`
    <div class="modal-head"><h2>Withdraw</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">Available: ${fmtMWK(balance)}</p>
    <label>Amount to withdraw (MWK)</label>
    <input type="number" id="withdrawAmount" placeholder="${balance}" max="${balance}">
    <div class="err-text" id="withdrawErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitWithdrawal()">Withdraw</button>
  `);
}
async function submitWithdrawal(){
  const amount = Number(document.getElementById('withdrawAmount').value);
  const err = document.getElementById('withdrawErr');
  if(!amount || amount<=0){ err.textContent='Enter a valid amount.'; err.style.display='block'; return; }
  showModal(`<div class="pay-processing"><div class="spinner"></div><h3 style="margin:0 0 8px;">Sending your withdrawal…</h3></div>`);
  try{
    await api.post('/api/wallet/withdraw', { amount });
    showModal(`
      <div class="pay-success" style="text-align:center;">
        <div class="check">✓</div>
        <h2 style="margin:0 0 8px;">Withdrawal sent</h2>
        <p style="color:var(--text-dim);font-size:14px;">${fmtMWK(amount)} is on its way to your mobile money account.</p>
        <button class="btn btn-gold btn-block" style="margin-top:22px;" onclick="closeModal();go('wallet')">Back to wallet</button>
      </div>`);
  }catch(e){
    showModal(`<div class="pay-processing"><h3 style="margin:0 0 8px;color:var(--coral);">Withdrawal failed</h3><p style="color:var(--text-dim);font-size:14px;">${escapeHTML(e.message)}</p><button class="btn btn-ghost btn-block" style="margin-top:18px;" onclick="closeModal();go('wallet')">Close</button></div>`);
  }
}
