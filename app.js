// ══════════════════════════════════════
//  DATE APPROVED — Full Realtime App
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, getDocs, setDoc, updateDoc,
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
let currentUser      = null;
let pendingRejectId  = null;
let unsubOutings     = null;  // home listener
let unsubHistory     = null;  // history listener
let cachedPartner    = null;

// ── SESSION ──
const saveSession = u  => localStorage.setItem('da_session', JSON.stringify(u));
const loadSession = () => { const v = localStorage.getItem('da_session'); return v ? JSON.parse(v) : null; };

// ══════════════════════════════════════
//  BOOT
// ══════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  const saved = loadSession();
  if (saved) {
    const snap = await getDoc(doc(db, 'users', saved.id));
    if (snap.exists()) {
      currentUser = snap.data();
      saveSession(currentUser);
      enterApp();
      return;
    }
    localStorage.removeItem('da_session');
  }
  setDatetimeDefaults();
});

function setDatetimeDefaults() {
  const now  = new Date();
  const pad  = n => String(n).padStart(2, '0');
  const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const later = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const s = document.getElementById('req-start');
  const e = document.getElementById('req-end');
  if (s) s.value = fmt(now);
  if (e) e.value = fmt(later);
}

// ══════════════════════════════════════
//  AUTH
// ══════════════════════════════════════
window.switchAuthTab = (tab) => {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) =>
    el.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'))
  );
};

window.generateCode = () => {
  const words = ['SUNSET','HONEY','STARLIGHT','CHERRY','MOONBEAM','PETAL','COZY','SPARK','BLOOM','VELVET'];
  document.getElementById('reg-code').value =
    words[Math.floor(Math.random() * words.length)] + (Math.floor(Math.random() * 90) + 10);
};

window.handlePhotoUpload = (input, previewId) => {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const el = document.getElementById(previewId);
    el.innerHTML = `<img src="${e.target.result}" alt="photo" />`;
    el.dataset.src = e.target.result;
  };
  reader.readAsDataURL(file);
};

window.handleRegister = async () => {
  const name  = document.getElementById('reg-name').value.trim();
  const code  = document.getElementById('reg-code').value.trim().toUpperCase();
  const photo = document.getElementById('reg-photo-preview').dataset.src || null;
  if (!name) return showToast('Please enter your name 😊', 'error');
  if (!code) return showToast('Please enter or generate a couple code 💕', 'error');
  showToast('Creating account...', 'info');
  const uid  = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
  const user = {
    id: uid, name, photo, coupleCode: code,
    trustScore: 50,
    stats: { ontime: 0, checkins: 0, missed: 0, late: 0, rejected: 0 },
    createdAt: new Date().toISOString()
  };
  await setDoc(doc(db, 'users', uid), user);
  currentUser = user;
  saveSession(currentUser);
  showToast(`Welcome, ${name}! 🎉`, 'success');
  enterApp();
};

window.handleLogin = async () => {
  const name = document.getElementById('login-name').value.trim();
  const code = document.getElementById('login-code').value.trim().toUpperCase();
  if (!name || !code) return showToast('Please fill in both fields 😊', 'error');
  showToast('Logging in...', 'info');
  const snap  = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', code)));
  const match = snap.docs.map(d => d.data()).find(u => u.name.toLowerCase() === name.toLowerCase());
  if (!match) return showToast('No account found — try signing up! 💕', 'error');
  currentUser = match;
  saveSession(currentUser);
  showToast(`Welcome back, ${match.name}! 💕`, 'success');
  enterApp();
};

window.handleLogout = () => {
  stopListeners();
  localStorage.removeItem('da_session');
  currentUser   = null;
  cachedPartner = null;
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

window.navigate = (tab) => {
  // Stop history listener when leaving history tab
  if (tab !== 'history') stopHistoryListener();

  showScreen(tab);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');

  if (tab === 'home')    initHome();
  if (tab === 'history') initHistory('all');
  if (tab === 'profile') initProfile();
  if (tab === 'request') setDatetimeDefaults();
};

function stopListeners() {
  if (unsubOutings) { unsubOutings(); unsubOutings = null; }
  stopHistoryListener();
}

function stopHistoryListener() {
  if (unsubHistory) { unsubHistory(); unsubHistory = null; }
}

// ══════════════════════════════════════
//  PARTNER HELPER
// ══════════════════════════════════════
async function fetchPartner() {
  const snap = await getDocs(query(collection(db, 'users'), where('coupleCode', '==', currentUser.coupleCode)));
  cachedPartner = snap.docs.map(d => d.data()).find(u => u.id !== currentUser.id) || null;
  return cachedPartner;
}

// ══════════════════════════════════════
//  HOME — live listeners
// ══════════════════════════════════════
async function initHome() {
  // Refresh current user from Firestore
  const uSnap = await getDoc(doc(db, 'users', currentUser.id));
  if (uSnap.exists()) { currentUser = uSnap.data(); saveSession(currentUser); }

  // Greeting
  const hour = new Date().getHours();
  document.getElementById('home-greeting').textContent =
    hour < 12 ? 'Good morning ☀️' : hour < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
  document.getElementById('home-name').textContent = `Hey, ${currentUser.name}!`;
  document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric' });

  // Partner + trust (async, non-blocking)
  fetchPartner().then(partner => {
    renderCoupleBanner(partner);
    renderTrustRow(partner);
  });

  // Live outings listener
  if (unsubOutings) { unsubOutings(); unsubOutings = null; }

  const q = query(
    collection(db, 'outings'),
    where('coupleCode', '==', currentUser.coupleCode)
  );

  unsubOutings = onSnapshot(q, snap => {
    const outings = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderPendingSection(outings);
    renderTodayOutings(outings);
    renderUpcomingOuting(outings);

    // Also refresh trust scores on any outing change
    fetchPartner().then(partner => renderTrustRow(partner));
  }, err => {
    console.error('Outings listener error:', err.code, err.message);
    if (err.code === 'permission-denied') {
      showToast('Permission denied — fix Firestore rules 🔧', 'error');
    } else if (err.code === 'failed-precondition') {
      showToast('Firestore index needed — check console 🔧', 'error');
    } else {
      showToast(`Error: ${err.code || err.message}`, 'error');
    }
  });
}

function renderCoupleBanner(partner) {
  const banner = document.getElementById('couple-banner');
  if (!partner) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  document.getElementById('banner-names').textContent = `${currentUser.name} & ${partner.name}`;
  setAvatarEl(document.getElementById('banner-avatar-a'), currentUser);
  setAvatarEl(document.getElementById('banner-avatar-b'), partner);
}

function renderTrustRow(partner) {
  document.getElementById('trust-row').innerHTML =
    trustCardHTML(currentUser, true) + (partner ? trustCardHTML(partner, false) : '');
}

function setAvatarEl(el, user) {
  el.innerHTML = user?.photo
    ? `<img src="${user.photo}" alt="${user.name}" />`
    : `<span>${user ? user.name[0].toUpperCase() : '?'}</span>`;
}

function trustCardHTML(user, isMe) {
  const score = user.trustScore ?? 50;
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

function renderPendingSection(outings) {
  const titleEl = document.getElementById('pending-section-title');
  const listEl  = document.getElementById('pending-list');
  // Pending = submitted by partner, waiting for ME to respond
  const pending = outings.filter(o => o.status === 'pending' && o.requesterId !== currentUser.id);
  if (pending.length === 0) { titleEl.style.display = 'none'; listEl.innerHTML = ''; return; }
  titleEl.style.display = 'flex';
  listEl.innerHTML = pending.map(o => outingCardHTML(o, true)).join('');
}

function renderTodayOutings(outings) {
  const today = new Date().toDateString();
  const list  = outings.filter(o =>
    o.status === 'approved' && new Date(o.startTime).toDateString() === today
  );
  document.getElementById('today-list').innerHTML = list.length
    ? list.map(o => outingCardHTML(o, false)).join('')
    : `<div class="empty-state"><span class="empty-emoji">🛋️</span><p>No outings today — cozy day in!</p></div>`;
}

function renderUpcomingOuting(outings) {
  const now    = new Date();
  const future = outings
    .filter(o => o.status === 'approved' && new Date(o.startTime) > now)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  document.getElementById('upcoming-list').innerHTML = future.length
    ? outingCardHTML(future[0], false)
    : `<div class="empty-state"><span class="empty-emoji">📭</span><p>Nothing planned yet — request an outing!</p></div>`;
}

// ══════════════════════════════════════
//  OUTING CARD
// ══════════════════════════════════════
function outingCardHTML(o, showActions) {
  const isMe       = o.requesterId === currentUser.id;
  const badgeClass = { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[o.status];
  const badgeText  = { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' }[o.status];
  const actions    = showActions && o.status === 'pending' ? `
    <div class="outing-actions">
      <button class="btn btn-success btn-sm" onclick="event.stopPropagation();approveOuting('${o.id}')">✅ Approve</button>
      <button class="btn btn-danger  btn-sm" onclick="event.stopPropagation();openRejectModal('${o.id}')">❌ Reject</button>
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
      ${actions}
    </div>`;
}

// ══════════════════════════════════════
//  REQUEST FORM
// ══════════════════════════════════════
let checkinEnabled = true;

window.setCheckin = (val) => {
  checkinEnabled = val;
  document.getElementById('checkin-yes').classList.toggle('active', val);
  document.getElementById('checkin-no').classList.toggle('active', !val);
  document.getElementById('checkin-interval-wrap').classList.toggle('visible', val);
};

window.submitRequest = async () => {
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

  const partner = await fetchPartner();
  if (!partner) return showToast('No partner linked yet — share your couple code! 💕', 'error');

  showToast('Sending request... 💌', 'info');

  const id     = 'o_' + Date.now();
  const outing = {
    id,
    coupleCode:     currentUser.coupleCode,
    requesterId:    currentUser.id,
    requesterName:  currentUser.name,
    venue, location,
    startTime:      start,
    endTime:        end,
    withWho, reason,
    checkin:         checkinEnabled,
    checkinInterval: checkinEnabled ? parseInt(interval) : null,
    status:          'pending',
    rejectNote:      null,
    createdAt:       new Date().toISOString()
  };

  await setDoc(doc(db, 'outings', id), outing);

  // Clear form
  ['req-venue', 'req-location', 'req-with', 'req-reason'].forEach(i => document.getElementById(i).value = '');
  window.setCheckin(true);
  setDatetimeDefaults();

  showToast('Request sent! Waiting for approval 💌', 'success');
  navigate('home');
};

// ══════════════════════════════════════
//  APPROVE / REJECT
// ══════════════════════════════════════
window.approveOuting = async (id) => {
  try {
    const ref  = doc(db, 'outings', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showToast('Request not found 🤔', 'error');
    await updateDoc(ref, { status: 'approved' });
    await adjustTrust(snap.data().requesterId, +5);
    showToast('Outing approved! Have fun 🎉', 'success');
  } catch (e) {
    console.error('Approve error:', e);
    showToast('Could not approve — check Firestore rules 🔧', 'error');
  }
};

window.openRejectModal = (id) => {
  pendingRejectId = id;
  document.getElementById('reject-note-input').value = '';
  openModal('modal-reject');
};

window.confirmReject = async () => {
  if (!pendingRejectId) return;
  try {
    const note = document.getElementById('reject-note-input').value.trim();
    const ref  = doc(db, 'outings', pendingRejectId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return showToast('Request not found 🤔', 'error');
    await updateDoc(ref, { status: 'rejected', rejectNote: note || null });
    await adjustTrust(snap.data().requesterId, -5);
    pendingRejectId = null;
    closeModal('modal-reject');
    showToast('Request rejected 💔', 'error');
  } catch (e) {
    console.error('Reject error:', e);
    showToast('Could not reject — check Firestore rules 🔧', 'error');
  }
};

// ══════════════════════════════════════
//  TRUST SCORE
// ══════════════════════════════════════
async function adjustTrust(userId, delta) {
  const ref  = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const updated = Math.min(100, Math.max(0, (snap.data().trustScore ?? 50) + delta));
  await updateDoc(ref, { trustScore: updated });
  if (userId === currentUser.id) { currentUser.trustScore = updated; saveSession(currentUser); }
}

async function adjustStat(userId, stat) {
  const ref  = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const stats = snap.data().stats || { ontime: 0, checkins: 0, missed: 0, late: 0, rejected: 0 };
  stats[stat] = (stats[stat] || 0) + 1;
  await updateDoc(ref, { stats });
  if (userId === currentUser.id) { currentUser.stats = stats; saveSession(currentUser); }
}

// ══════════════════════════════════════
//  DETAIL MODAL
// ══════════════════════════════════════
window.openDetail = async (id) => {
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
    ['Status',       { pending: '⏳ Pending', approved: '✅ Approved', rejected: '❌ Rejected' }[o.status]],
  ];
  if (o.rejectNote) rows.push(['Rejection Note', `"${o.rejectNote}"`]);

  document.getElementById('modal-detail-body').innerHTML = rows.map(([k, v]) =>
    `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
  ).join('');

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
        <button class="btn btn-secondary btn-sm" onclick="doCheckin('${o.id}')">📲 Mark Check-in Done</button>
        <button class="btn btn-success   btn-sm" onclick="doReturn('${o.id}')">🏠 I'm Home!</button>
      </div>`;
  } else {
    actionsEl.innerHTML = '';
  }
  openModal('modal-detail');
};

window.doCheckin = async (id) => {
  await adjustTrust(currentUser.id, +5);
  await adjustStat(currentUser.id, 'checkins');
  showToast('Check-in recorded! +5 trust ✅', 'success');
  closeModal('modal-detail');
};

window.doReturn = async (id) => {
  await adjustTrust(currentUser.id, +5);
  await adjustStat(currentUser.id, 'ontime');
  showToast("Welcome home! +5 trust 🏠💕", 'success');
  closeModal('modal-detail');
};

// ══════════════════════════════════════
//  HISTORY — live listener
// ══════════════════════════════════════
window.filterHistory = (filter, btn) => {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  initHistory(filter);
};

function initHistory(filter) {
  stopHistoryListener();
  document.getElementById('history-list').innerHTML =
    `<div class="empty-state"><span class="empty-emoji">⏳</span><p>Loading...</p></div>`;

  const q = query(
    collection(db, 'outings'),
    where('coupleCode', '==', currentUser.coupleCode)
  );

  unsubHistory = onSnapshot(q, snap => {
    let outings = snap.docs.map(d => d.data())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filter === 'approved') outings = outings.filter(o => o.status === 'approved');
    if (filter === 'pending')  outings = outings.filter(o => o.status === 'pending');
    if (filter === 'rejected') outings = outings.filter(o => o.status === 'rejected');
    if (filter === 'mine')     outings = outings.filter(o => o.requesterId === currentUser.id);
    document.getElementById('history-list').innerHTML = outings.length
      ? outings.map(o => outingCardHTML(o, false)).join('')
      : `<div class="empty-state"><span class="empty-emoji">🗂️</span><p>Nothing here yet!</p></div>`;
  }, err => console.error('History listener error:', err));
}

// ══════════════════════════════════════
//  PROFILE
// ══════════════════════════════════════
async function initProfile() {
  const snap = await getDoc(doc(db, 'users', currentUser.id));
  if (snap.exists()) { currentUser = snap.data(); saveSession(currentUser); }

  const score = currentUser.trustScore ?? 50;
  const { label, color } = getTrustLabel(score);
  const stats = currentUser.stats || {};

  const avatarEl = document.getElementById('profile-avatar');
  avatarEl.innerHTML = currentUser.photo
    ? `<img src="${currentUser.photo}" alt="${currentUser.name}" />`
    : currentUser.name[0].toUpperCase();

  document.getElementById('profile-name').textContent              = currentUser.name;
  document.getElementById('profile-code').textContent              = `Couple Code: ${currentUser.coupleCode}`;
  document.getElementById('profile-score-num').textContent         = score;
  document.getElementById('profile-score-num').style.color         = color;
  document.getElementById('profile-score-bar').style.width         = score + '%';
  document.getElementById('profile-score-bar').style.background    = color;
  document.getElementById('profile-score-label').textContent       = label;
  document.getElementById('profile-score-label').style.background  = color + '22';
  document.getElementById('profile-score-label').style.color       = color;
  document.getElementById('stat-ontime').textContent               = stats.ontime   || 0;
  document.getElementById('stat-checkins').textContent             = stats.checkins || 0;
  document.getElementById('stat-missed').textContent               = stats.missed   || 0;
  document.getElementById('stat-late').textContent                 = stats.late     || 0;
  document.getElementById('stat-rejected').textContent             = stats.rejected || 0;
}

// ══════════════════════════════════════
//  MODALS
// ══════════════════════════════════════
window.openModal  = (id) => document.getElementById(id).classList.remove('hidden');
window.closeModal = (id) => document.getElementById(id).classList.add('hidden');

document.querySelectorAll('.modal-overlay').forEach(overlay =>
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); })
);

// ══════════════════════════════════════
//  TOAST
// ══════════════════════════════════════
let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ══════════════════════════════════════
//  UTILS
// ══════════════════════════════════════
function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US',
    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
