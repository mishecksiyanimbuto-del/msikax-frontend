// ============================================================================
// AUTH.JS — signup / login / logout / session restore.
// ============================================================================
function openAuth(mode){ state.authMode = mode; showModal(authHTML()); }

function authHTML(){
  const isLogin = state.authMode === 'login';
  return `
    <div class="modal-head"><h2>${isLogin?'Welcome back':'Open your shop'}</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <div class="tabs">
      <button class="tab-btn ${isLogin?'active':''}" onclick="switchAuth('login')">Log in</button>
      <button class="tab-btn ${!isLogin?'active':''}" onclick="switchAuth('signup')">Sign up</button>
    </div>
    ${isLogin ? `
      <label>Email</label><input type="email" id="loginEmail" placeholder="you@example.com">
      <label>Password</label><input type="password" id="loginPass" placeholder="••••••••">
      <div class="field-note">Try the demo: chisomo@demo.mw / demo1234 · <button class="foot-link" style="font-size:12px;" onclick="openForgotPassword()">Forgot password?</button></div>
    ` : `
      <label>Full name</label><input type="text" id="suName" placeholder="Your name">
      <label>Email</label><input type="email" id="suEmail" placeholder="you@example.com">
      <label>Phone number</label><input type="tel" id="suPhone" placeholder="+265 9XX XXX XXX">
      <label>Password</label><input type="password" id="suPass" placeholder="At least 6 characters">
    `}
    <div class="err-text" id="authErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:20px;" onclick="${isLogin?'doLogin()':'doSignup()'}">${isLogin?'Log in':'Create account'}</button>
  `;
}
function switchAuth(mode){ state.authMode = mode; showModal(authHTML()); }

async function doSignup(){
  const name = document.getElementById('suName').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const phone = document.getElementById('suPhone').value.trim();
  const password = document.getElementById('suPass').value;
  const err = document.getElementById('authErr');
  try{
    const { token, user } = await api.post('/api/auth/signup', { name, email, phone, password });
    api.setToken(token);
    state.user = user;
    closeModal();
    toast(`Welcome, ${name.split(' ')[0]} — check your email to verify your account`);
    go('myshop');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  const err = document.getElementById('authErr');
  try{
    const { token, user } = await api.post('/api/auth/login', { email, password });
    api.setToken(token);
    state.user = user;
    closeModal();
    toast(`Welcome back, ${user.name.split(' ')[0]}`);
    go('market');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

function logout(){
  api.clearToken();
  state.user = null;
  toast('Logged out');
  go('home');
}

async function restoreSession(){
  if(!api.getToken()) return;
  try{ const { user } = await api.get('/api/auth/me'); state.user = user; }
  catch{ api.clearToken(); }
}

/** A small reminder banner for pages where an unverified user might hit a wall (currently: withdrawals). */
function unverifiedBannerHTML(){
  if(!state.user || state.user.verified) return '';
  return `
    <div class="quota-banner warn" style="margin-bottom:22px;">
      <div class="qtext">
        <b>Verify your email</b>
        <span>Check your inbox for a link from MsikaX — you'll need this before you can withdraw from your wallet.</span>
      </div>
      <button class="btn btn-gold btn-sm" onclick="resendVerificationEmail()">Resend email</button>
    </div>`;
}
async function resendVerificationEmail(){
  try{
    const res = await api.post('/api/auth/resend-verification');
    toast(res.alreadyVerified ? 'Your email is already verified' : 'Verification email sent — check your inbox');
  }catch(e){ toast(e.message); }
}

/* ---- Password reset: request a link, then (from the emailed link) set a new password ---- */
function openForgotPassword(){
  showModal(`
    <div class="modal-head"><h2>Reset your password</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <p class="modal-sub">We'll email you a link to set a new password.</p>
    <label>Email</label><input type="email" id="forgotEmail" placeholder="you@example.com">
    <div class="err-text" id="forgotErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitForgotPassword()">Send reset link</button>
  `);
}
async function submitForgotPassword(){
  const email = document.getElementById('forgotEmail').value.trim();
  const err = document.getElementById('forgotErr');
  try{
    await api.post('/api/auth/forgot-password', { email });
    showModal(`
      <div class="pay-success" style="text-align:center;">
        <div class="check">✓</div>
        <h2 style="margin:0 0 8px;">Check your email</h2>
        <p style="color:var(--text-dim);font-size:14px;">If an account exists for ${escapeHTML(email)}, a reset link is on its way.</p>
        <button class="btn btn-ghost btn-block" style="margin-top:22px;" onclick="closeModal()">Close</button>
      </div>`);
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}

/** Opened automatically on load if the URL carries ?resetToken= (see initApp() call in index.html). */
function openResetPassword(token){
  showModal(`
    <div class="modal-head"><h2>Choose a new password</h2><button class="x-close" onclick="closeModal()">✕</button></div>
    <label>New password</label><input type="password" id="resetPass" placeholder="At least 6 characters">
    <div class="err-text" id="resetErr"></div>
    <button class="btn btn-gold btn-block" style="margin-top:16px;" onclick="submitResetPassword('${token}')">Set new password</button>
  `);
}
async function submitResetPassword(token){
  const password = document.getElementById('resetPass').value;
  const err = document.getElementById('resetErr');
  try{
    const { token: sessionToken, user } = await api.post(`/api/auth/reset-password/${token}`, { password });
    api.setToken(sessionToken);
    state.user = user;
    closeModal();
    toast('Password updated — you\'re logged in');
    // Drop the token from the URL so refreshing/sharing the link can't replay it.
    window.history.replaceState({}, '', window.location.pathname);
    go('market');
  }catch(e){ err.textContent = e.message; err.style.display = 'block'; }
}
