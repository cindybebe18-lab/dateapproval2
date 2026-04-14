// ══════════════════════════════════════
//  DATE APPROVED — Firebase Backend
//  Replace firebaseConfig below with
//  your own from Firebase Console
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, getDocs,
  collection, query, where, onSnapshot, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyD-rrUdd2ZE3Po7HQEYvuuve_u-rhPK1tI",
  authDomain:        "date-approval-app.firebaseapp.com",
  projectId:         "date-approval-app",
  storageBucket:     "date-approval-app.firebasestorage.app",
  messagingSenderId: "219402169316",
  appId:             "1:219402169316:web:3565d2963e13a18a7175f1"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── STATE ──
let currentUser     = null;
let pendingRejectId = null;
let outingsUnsub    = null;

// ── LOCAL SESSION ──
function saveSession(u) { localStorage.setItem('da_session', JSON.stringify(u)); }
function loadSession()  { const v = localStorage.getItem('da_session'); return v ? JSON.parse(v) : null; }

// ══════════════════════════════════════
//  BOOT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const saved = loadSession();
  if (saved) {
    // Re-fetch fresh user data from Firestore
    const snap = await getDoc(doc(db, 'users', saved.id));
    if (snap.exists()) {
      currentUser = snap.data();
      saveSession(currentUser);
      enterApp();
    } else {
      localStorage.removeItem('da_session');
    }
  }
  setDatetimeDefaults();
});

function setDatetimeDefaults() {
  const now  = new Date();
  const pad  = n => String(n).padStart(2,'0');
  const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const later = new Date(now.getTime() + 3*60*60*1000);
  const s = document.getElementById('req-start');
  const e = document.getElementById('req-end');
  if (s) s.value = fmt(now);
  if (e) e.value = fmt(later);
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════
window.switchAuthTab = function(tab) {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
};

window.generateCode = function() {
  const words = ['SUNSET','HONEY','STARLIGHT','CHERRY','MOONBEAM','PETAL','COZY','SPARK','BLOOM','VELVET'];
  const num   = Math.floor(Math.random() * 90) + 10;
  document.getElementById('reg-code').value = words[Math.floor(Math.random() * words.length)] + num;
};

window.handlePhotoUpload = function(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(previewId);
    preview.innerHTML = `<img src="${e.target.result}" alt="photo" />`;
    preview.dataset.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.handleRegister = async function() {
  const name  = document.getElementById('reg-name').value.trim();
  const code  = document.getElementById('reg-code').value.trim().toUpperCase();
  const photo = document.getElementById('reg-photo-preview').dataset.src || null;
  if (!name) return showToast('Please enter your name 😊', 'error');
  if (!code) return showToast('Please enter or generate a couple code 💕', 'error');

  showToast('Creating account...', 'info');
  const uid  = name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
  const user = {
    id: uid, name, photo, coupleCode: code,
    trustScore: 50,
    stats: { ontime:0, checkins:0, missed:0, late:0, rejected:0 },
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', uid), user);
  currentUser = user;
  saveSession(currentUser);
  showToast(`Welcome, ${name}! 🎉`, 'success');
  enterApp();
};

window.handleLogin = async function() {
  const name = document.getElementById('login-name').value.trim();
  const code = document.getElementById('login-code').value.trim().toUpperCase();
  if (!name || !code) return showToast('Please fill in both fields 😊', 'error');

  showToast('Logging in...', 'info');
  // Query Firestore for matching user
  const q    = query(collection(db, 'users'), where('coupleCode', '==', code));
  const snap = await getDocs(q);
  const match = snap.docs.map(d => d.data()).find(u => u.name.toLowerCase() === name.toLowerCase());

  if (!match) return showToast('No account found — try signing up! 💕', 'error');
  currentUser = match;
  saveSession(currentUser);
  showToast(`Welcome back, ${match.name}! 💕`, 'success');
  enterApp();
};

window.handleLogout = function() {
  if (outingsUnsub) { outingsUnsub(); outingsUnsub = null; }
  localStorage.removeItem('da_session');
  currentUser = null;
  document.getElementById('bottom-nav').style.display = 'none';
  showScreen('auth');
  showToast('Logged out. See you soon! 👋');
};

// ══════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════
function enterApp() {
  document.getElementById('bottom-nav').style.display = 'flex';
  navigate('home');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

window.navigate = function(tab) {
  showScreen(tab);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');
  if (tab === 'home')    renderHome();
  if (tab === 'history') renderHistory('all');
  if (tab === 'profile') renderProfile();
  if (tab === 'request') setDatetimeDefaults();
};

// ══════════════════════════════════════
//  HOME — live listener
// ══════════════════════════════════════
function renderHome() {
  refreshCurrentUser().then(() => {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning ☀️' : hour < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
    document.getElementById('home-greeting').textContent = greeting;
    document.getElementById('home-name').textContent = `Hey, ${currentUser.name}!`;
    document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
    renderCoupleBanner();
    renderTrustRow();
  });
  subscribeOutings();
}

async function getPartner() {
  const q    = query(collection(db, 'users'), where('coupleCode', '==', currentUser.coupleCode));
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data()).find(u => u.id !== currentUser.id) || null;
}

async function renderCoupleBanner() {
  const partner = await getPartner();
  const banner  = document.getElementById('couple-banner');
  if (!partner) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  document.getElementById('banner-names').textContent = `${currentUser.name} & ${partner.name}`;
  setAvatarEl(document.getElementById('banner-avatar-a'), currentUser);
  setAvatarEl(document.getElementById('banner-avatar-b'), partner);
}

async function renderTrustRow() {
  const partner = await getPartner();
  document.getElementById('trust-row').innerHTML =
    trustCardHTML(currentUser, true) + (partner ? trustCardHTML(partner, false) : '');
}

function trustCardHTML(user, isMe) {
  const score = user.trustScore;
  const { label, color } = getTrustLabel(score);
  return `
    <div class="trust-card">
      <div class="trust-avatar">
        ${user.photo ? `<img src="${user.photo}" alt="${user.name}" />` : `<span>${user.name[0].toUpperCase()}</span>`}
      </div>
      <div class="trust-name">${isMe ? 'You' : user.name}</div>
      <div class="trust-score-num" style="color:${color}">${score}</div>
      <div class="trust-bar-wrap">
        <div class="trust-bar-fill" style="width:${score}%;background:${color}"></div>
      </div>
      <div class="trust-label" style="color:${color}">${label}</div>
    </div>`;
}

function getTrustLabel(score) {
  if (score <= 30) return { label: '😬 Needs Work',         color: '#F87171' };
  if (score <= 60) return { label: '🌱 Getting There',      color: '#FBBF24' };
  if (score <= 85) return { label: '💪 Pretty Trustworthy', color: '#34D399' };
  return               { label: '🌟 Total Green Flag',     color: '#A78BFA' };
}

// Live Firestore listener for outings
function subscribeOutings() {
  if (outingsUnsub) outingsUnsub();
  const q = query(
    collection(db, 'outings'),
    where('coupleCode', '==', currentUser.coupleCode),
    orderBy('createdAt', 'desc')
  );
  outingsUnsub = onSnapshot(q, snap => {
    const outings = snap.docs.map(d => d.data());
    renderPendingSection(outings);
    renderTodayOutings(outings);
    renderUpcomingOuting(outings);
  });
}

function renderPendingSection(outings) {
  const titleEl = document.getElementById('pending-section-title');
  const listEl  = document.getElementById('pending-list');
  const pending = outings.filter(o => o.status === 'pending' && o.requesterId !== currentUser.id);
  if (pending.length === 0) { titleEl.style.display = 'none'; listEl.innerHTML = ''; return; }
  titleEl.style.display = 'flex';
  listEl.innerHTML = pending.map(o => outingCardHTML(o, true)).join('');
}

function renderTodayOutings(outings) {
  const today = new Date().toDateString();
  const list  = outings.filter(o => o.status === 'approved' && new Date(o.startTime).toDateString() === today);
  document.getElementById('today-list').innerHTML = list.length
    ? list.map(o => outingCardHTML(o, false)).join('')
    : `<div class="empty-state"><span class="empty-emoji">🛋️</span><p>No outings today — cozy day in!</p></div>`;
}

function renderUpcomingOuting(outings) {
  const now    = new Date();
  const future = outings
    .filter(o => o.status === 'approved' && new Date(o.startTime) > now)
    .sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
  document.getElementById('upcoming-list').innerHTML = future.length
    ? outingCardHTML(future[0], false)
    : `<div class="empty-state"><span class="empty-emoji">📭</span><p>Nothing planned yet — request an outing!</p></div>`;
}

// ══════════════════════════════════════
//  OUTING CARD HTML
// ══════════════════════════════════════
function outingCardHTML(o, showActions) {
  const isMe       = o.requesterId === currentUser.id;
  const badgeClass = { pending:'badge-pending', approved:'badge-approved', rejected:'badge-rejected' }[o.status];
  const badgeText  = { pending:'⏳ Pending', approved:'✅ Approved', rejected:'❌ Rejected' }[o.status];
  const actionsHTML = showActions && o.status === 'pending' ? `
    <div class="outing-actions">
      <button class="btn btn-success btn-sm" onclick="event.stopPropagation();approveOuting('${o.id}')">✅ Approve</button>
      <button class="btn btn-danger btn-sm"  onclick="event.stopPropagation();openRejectModal('${o.id}')">❌ Reject</button>
    </div>` : '';
  return `
    <div class="outing-card" onclick="openDetail('${o.id}')">
      <div class="outing-card-header">
        <div>
          <div class="outing-venue">📍 ${o.venue}</div>
          <div class="outing-location">${o.location}</div>
        </div>
        <span class="status-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="outing-meta">
        <span class="outing-meta-item">🕐 ${fmtDateTime(o.startTime)}</span>
        <span class="outing-meta-item">🏠 ${fmtDateTime(o.endTime)}</span>
        <span class="outing-meta-item">👤 ${isMe ? 'Your request' : o.requesterName + "'s request"}</span>
        ${o.checkin ? `<span class="outing-meta-item">📲 Every ${o.checkinInterval}h</span>` : ''}
      </div>
      ${actionsHTML}
    </div>`;
}

// ══════════════════════════════════════
//  REQUEST FORM
// ══════════════════════════════════════
let checkinEnabled = true;

window.setCheckin = function(val) {
  checkinEnabled = val;
  document.getElementById('checkin-yes').classList.toggle('active', val);
  document.getElementById('checkin-no').classList.toggle('active', !val);
  document.getElementById('checkin-interval-wrap').classList.toggle('visible', val);
};

window.submitRequest = async function() {
  const venue    = document.getElementById('req-venue').value.trim();
  const location = document.getElementById('req-location').value.trim();
  const start    = document.getElementById('req-start').value;
  const end      = document.getElementById('req-end').value;
  const withWho  = document.getElementById('req-with').value.trim();
  const reason   = document.getElementById('req-reason').value.trim();
  const interval = document.getElementById('req-interval').value;
  if (!venue)    return showToast('Please enter a venue name 📍', 'error');
  if (!location) return showToast('Please enter a location 🗺️', 'error');
  if (!start)    return showToast('Please set a start time 🕐', 'error');
  if (!end)      return showToast('Please set an expected home time 🏠', 'error');
  if (!withWho)  return showToast('Who are you going with? 👥', 'error');
  if (!reason)   return showToast('Give your partner a reason 💬', 'error');
  if (new Date(end) <= new Date(start)) return showToast('Home time must be after start time ⏰', 'error');

  const partner = await getPartner();
  if (!partner) return showToast('No partner linked yet — share your couple code! 💕', 'error');

  const id     = 'o_' + Date.now();
  const outing = {
    id, coupleCode: currentUser.coupleCode,
    requesterId: currentUser.id, requesterName: currentUser.name,
    venue, location, startTime: start, endTime: end, withWho, reason,
    checkin: checkinEnabled, checkinInterval: checkinEnabled ? parseInt(interval) : null,
    status: 'pending', rejectNote: null, createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'outings', id), outing);

  ['req-venue','req-location','req-with','req-reason'].forEach(id => document.getElementById(id).value = '');
  window.setCheckin(true);
  setDatetimeDefaults();
  showToast('Request sent! Waiting for approval 💌', 'success');
  navigate('home');
};

// ══════════════════════════════════════
//  APPROVE / REJECT
// ══════════════════════════════════════
window.approveOuting = async function(id) {
  const ref  = doc(db, 'outings', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { status: 'approved' });
  await adjustTrust(snap.data().requesterId, +5);
  showToast('Outing approved! Have fun 🎉', 'success');
};

window.openRejectModal = function(id) {
  pendingRejectId = id;
  document.getElementById('reject-note-input').value = '';
  openModal('modal-reject');
};

window.confirmReject = async function() {
  if (!pendingRejectId) return;
  const note = document.getElementById('reject-note-input').value.trim();
  const ref  = doc(db, 'outings', pendingRejectId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  await updateDoc(ref, { status: 'rejected', rejectNote: note || null });
  await adjustTrust(snap.data().requesterId, -5);
  pendingRejectId = null;
  closeModal('modal-reject');
  showToast('Request rejected 💔', 'error');
};

// ══════════════════════════════════════
//  TRUST SCORE
// ══════════════════════════════════════
async function adjustTrust(userId, delta) {
  const ref  = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const current = snap.data().trustScore || 50;
  const updated = Math.min(100, Math.max(0, current + delta));
  await updateDoc(ref, { trustScore: updated });
  if (userId === currentUser.id) {
    currentUser.trustScore = updated;
    saveSession(currentUser);
  }
}

async function adjustStat(userId, stat, delta) {
  const ref  = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const stats = snap.data().stats || { ontime:0, checkins:0, missed:0, late:0, rejected:0 };
  stats[stat] = (stats[stat] || 0) + delta;
  await updateDoc(ref, { stats });
  if (userId === currentUser.id) { currentUser.stats = stats; saveSession(currentUser); }
}

async function refreshCurrentUser() {
  const snap = await getDoc(doc(db, 'users', currentUser.id));
  if (snap.exists()) { currentUser = snap.data(); saveSession(currentUser); }
}

// ══════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════
window.openDetail = async function(id) {
  const snap = await getDoc(doc(db, 'outings', id));
  if (!snap.exists()) return;
  const o = snap.data();
  const isPartnerRequest = o.requesterId !== currentUser.id;
  document.getElementById('modal-detail-title').textContent = `📍 ${o.venue}`;
  const rows = [
    ['Location',     o.location],
    ['Start Time',   fmtDateTime(o.startTime)],
    ['Home Time',    fmtDateTime(o.endTime)],
    ['With',         o.withWho],
    ['Reason',       o.reason],
    ['Check-ins',    o.checkin ? `Every ${o.checkinInterval} hour(s)` : 'No check-ins'],
    ['Requested by', o.requesterName || 'Unknown'],
    ['Status',       { pending:'⏳ Pending', approved:'✅ Approved', rejected:'❌ Rejected' }[o.status]],
  ];
  if (o.rejectNote) rows.push(['Rejection Note', `"${o.rejectNote}"`]);
  document.getElementById('modal-detail-body').innerHTML = rows.map(([k,v]) => `
    <div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`).join('');
  const actionsEl = document.getElementById('modal-detail-actions');
  if (isPartnerRequest && o.status === 'pending') {
    actionsEl.innerHTML = `
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" onclick="approveOuting('${o.id}');closeModal('modal-detail')">✅ Approve</button>
        <button class="btn btn-danger"  onclick="closeModal('modal-detail');openRejectModal('${o.id}')">❌ Reject</button>
      </div>`;
  } else if (o.status === 'approved' && o.requesterId === currentUser.id) {
    actionsEl.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="simulateCheckin('${o.id}')">📲 Mark Check-in Done</button>
        <button class="btn btn-success btn-sm"   onclick="simulateReturn('${o.id}')">🏠 I'm Home!</button>
      </div>`;
  } else {
    actionsEl.innerHTML = '';
  }
  openModal('modal-detail');
};

window.simulateCheckin = async function(id) {
  await adjustTrust(currentUser.id, +5);
  await adjustStat(currentUser.id, 'checkins', 1);
  showToast('Check-in recorded! +5 trust ✅', 'success');
  closeModal('modal-detail');
};

window.simulateReturn = async function(id) {
  await adjustTrust(currentUser.id, +5);
  await adjustStat(currentUser.id, 'ontime', 1);
  showToast("Welcome home! +5 trust 🏠💕", 'success');
  closeModal('modal-detail');
};

// ══════════════════════════════════════
//  HISTORY
// ══════════════════════════════════════
window.filterHistory = function(filter, btn) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderHistory(filter);
};

async function renderHistory(filter) {
  document.getElementById('history-list').innerHTML = `<div class="empty-state"><span class="empty-emoji">⏳</span><p>Loading...</p></div>`;
  const q    = query(collection(db, 'outings'), where('coupleCode', '==', currentUser.coupleCode), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  let outings = snap.docs.map(d => d.data());
  if (filter === 'approved') outings = outings.filter(o => o.status === 'approved');
  if (filter === 'pending')  outings = outings.filter(o => o.status === 'pending');
  if (filter === 'rejected') outings = outings.filter(o => o.status === 'rejected');
  if (filter === 'mine')     outings = outings.filter(o => o.requesterId === currentUser.id);
  const el = document.getElementById('history-list');
  el.innerHTML = outings.length
    ? outings.map(o => outingCardHTML(o, false)).join('')
    : `<div class="empty-state"><span class="empty-emoji">🗂️</span><p>Nothing here yet!</p></div>`;
}

// ══════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════
async function renderProfile() {
  await refreshCurrentUser();
  const score = currentUser.trustScore;
  const { label, color } = getTrustLabel(score);
  const stats = currentUser.stats || {};
  const avatarEl = document.getElementById('profile-avatar');
  avatarEl.innerHTML = currentUser.photo
    ? `<img src="${currentUser.photo}" alt="${currentUser.name}" />`
    : currentUser.name[0].toUpperCase();
  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-code').textContent = `Couple Code: ${currentUser.coupleCode}`;
  document.getElementById('profile-score-num').textContent      = score;
  document.getElementById('profile-score-num').style.color      = color;
  document.getElementById('profile-score-bar').style.width      = score + '%';
  document.getElementById('profile-score-bar').style.background = color;
  document.getElementById('profile-score-label').textContent    = label;
  document.getElementById('profile-score-label').style.background = color + '22';
  document.getElementById('profile-score-label').style.color    = color;
  document.getElementById('stat-ontime').textContent   = stats.ontime   || 0;
  document.getElementById('stat-checkins').textContent = stats.checkins || 0;
  document.getElementById('stat-missed').textContent   = stats.missed   || 0;
  document.getElementById('stat-late').textContent     = stats.late     || 0;
  document.getElementById('stat-rejected').textContent = stats.rejected || 0;
}

// ══════════════════════════════════════
//  MODALS
// ══════════════════════════════════════
window.openModal  = function(id) { document.getElementById(id).classList.remove('hidden'); };
window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); };
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ══════════════════════════════════════
//  TOAST
// ══════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ══════════════════════════════════════
//  UTILS
// ══════════════════════════════════════
function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
}
