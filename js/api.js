// ============================================================================
// API.JS — the ONE place that knows how to talk to the backend. Every other
// module calls api.get/post/patch/del/postForm instead of using fetch
// directly, so auth headers and error handling live in exactly one spot.
// ============================================================================
const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:4000'
  : 'https://msikax-backend.onrender.com'; // Live backend URL on Render

const TOKEN_KEY = 'msikax_token';

function getToken(){ return localStorage.getItem(TOKEN_KEY); }
function setToken(t){ localStorage.setItem(TOKEN_KEY, t); }
function clearToken(){ localStorage.removeItem(TOKEN_KEY); }

function authHeaders(){
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

async function request(path, { method='GET', body, isForm=false } = {}){
  let res;
  try{
    res = await fetch(API_BASE + path, {
      method,
      headers: isForm ? { ...authHeaders() } : { 'Content-Type':'application/json', ...authHeaders() },
      body: isForm ? body : (body !== undefined ? JSON.stringify(body) : undefined)
    });
  }catch(networkErr){
    window.dispatchEvent(new CustomEvent('msikax:backend-unreachable'));
    throw networkErr;
  }
  let data = {};
  try{ data = await res.json(); }catch{ /* empty body is fine */ }
  if(!res.ok){
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}

const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method:'POST', body }),
  patch: (path, body) => request(path, { method:'PATCH', body }),
  del: (path) => request(path, { method:'DELETE' }),
  postForm: (path, formData) => request(path, { method:'POST', body: formData, isForm: true }),
  patchForm: (path, formData) => request(path, { method:'PATCH', body: formData, isForm: true }),
  // For private files behind auth (verification documents) — a plain <img src>
  // can't send an Authorization header, so this fetches the bytes with one
  // and hands back a temporary local URL the browser can actually display.
  getBlobUrl: async (path) => {
    const res = await fetch(API_BASE + path, { headers: authHeaders() });
    if(!res.ok) throw new Error('Could not load that document.');
    return URL.createObjectURL(await res.blob());
  },
  base: API_BASE, getToken, setToken, clearToken
};