// ══════════════════════════════════════
//  DATE APPROVED — App Logic
// ══════════════════════════════════════

let currentUser = null;
let pendingRejectId = null;

function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, def) { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
function getUsers()     { return load('da_users', {}); }
function saveUsers(u)   { save('da_users', u); }
function getOutings()   { return load('da_outings', []); }
function saveOutings(o) { save('da_outings', o); }

document.addEventListener('DOMContentLoaded', () => {
  const saved = load('da_session', null);
  if (saved) { currentUser = saved; enterApp(); }
  setDatetimeDefaults();
});

function setDatetimeDefaults() {
  const now = new Date();
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const later = new Date(now.getTime() + 3*60*60*1000);
  const s = document.getElementById('req-start');
  const e = document.getElementById('req-end');
  if (s) s.value = fmt(now);
  if (e) e.value = fmt(later);
}

// ── AUTH ──
function switchAuthTab(tab) {
  document.getElementById('auth-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab === 'register' ? 'block' : 'none';
  document.querySelectorAll('.auth-tab').forEach((el, i) => {
    el.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
}

function generateCode() {
  const words = ['SUNSET','HONEY','STARLIGHT','CHERRY','MOONBEAM','PETAL','COZY','SPARK','BLOOM','VELVET'];
  const num   = Math.floor(Math.random() * 90) + 10;
  document.getElementById('reg-code').value = words[Math.floor(Math.random() * words.length)] + num;
}

function handlePhotoUpload(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById(previewId);
    preview.innerHTML = `<img src="${e.target.result}" alt="photo" />`;
    preview.dataset.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function handleRegister() {
  const name  = document.getElementById('reg-name').value.trim();
  const code  = document.getElementById('reg-code').value.trim().toUpperCase();
  const photo = document.getElementById('reg-photo-preview').dataset.src || null;
  if (!name) return showToast('Please enter your name 😊', 'error');
  if (!code) return showToast('Please enter or generate a couple code 💕', 'error');
  const users = getUsers();
  const uid   = name.toLowerCase().replace(/\s+/g,'_') + '_' + Date.now();
  users[uid]  = { id: uid, name, photo, coupleCode: code, trustScore: 50, stats: { ontime:0, checkins:0, missed:0, late:0, rejected:0 } };
  saveUsers(users);
  currentUser = users[uid];
  save('da_session', currentUser);
  showToast(`Welcome, ${name}! 🎉`, 'success');
  enterApp();
}

function handleLogin() {
  const name = document.getElementById('login-name').value.trim();
  const code = document.getElementById('login-code').value.trim().toUpperCase();
  if (!name || !code) return showToast('Please fill in both fields 😊', 'error');
  const match = Object.values(getUsers()).find(u => u.name.toLowerCase() === name.toLowerCase() && u.coupleCode === code);
  if (!match) return showToast('No account found — try signing up! 💕', 'error');
  currentUser = match;
  save('da_session', currentUser);
  showToast(`Welcome back, ${match.name}! 💕`, 'success');
  enterApp();
}

function handleLogout() {
  localStorage.removeItem('da_session');
  currentUser = null;
  document.getElementById('bottom-nav').style.display = 'none';
  showScreen('auth');
  showToast('Logged out. See you soon! 👋');
}

// ── NAVIGATION ──
function enterApp() {
  document.getElementById('bottom-nav').style.display = 'flex';
  navigate('home');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

function navigate(tab) {
  showScreen(tab);
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav-' + tab);
  if (navEl) navEl.classList.add('active');
  if (tab === 'home')    renderHome();
  if (tab === 'history') renderHistory('all');
  if (tab === 'profile') renderProfile();
  if (tab === 'request') setDatetimeDefaults();
}

// ── HOME ──
function renderHome() {
  refreshCurrentUser();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning ☀️' : hour < 17 ? 'Good afternoon 🌤️' : 'Good evening 🌙';
  document.getElementById('home-greeting').textContent = greeting;
  document.getElementById('home-name').textContent = `Hey, ${currentUser.name}!`;
  document.getElementById('home-date').textContent = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  renderCoupleBanner();
  renderTrustRow();
  renderPendingSection();
  renderTodayOutings();
  renderUpcomingOuting();
}

function getPartner() {
  return Object.values(getUsers()).find(u => u.coupleCode === currentUser.coupleCode && u.id !== currentUser.id) || null;
}

function renderCoupleBanner() {
  const partner = getPartner();
  const banner  = document.getElementById('couple-banner');
  if (!partner) { banner.style.display = 'none'; return; }
  banner.style.display = 'flex';
  document.getElementById('banner-names').textContent = `${currentUser.name} & ${partner.name}`;
  setAvatarEl(document.getElementById('banner-avatar-a'), currentUser);
  setAvatarEl(document.getElementById('banner-avatar-b'), partner);
}

function setAvatarEl(el, user) {
  el.innerHTML = user && user.photo
    ? `<img src="${user.photo}" alt="${user.name}" />`
    : `<span>${user ? user.name[0].toUpperCase() : '?'}</span>`;
}

function renderTrustRow() {
  const partner = getPartner();
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

function renderPendingSection() {
  const partner  = getPartner();
  const titleEl  = document.getElementById('pending-section-title');
  const listEl   = document.getElementById('pending-list');
  const pending  = getOutings().filter(o =>
    o.status === 'pending' && partner && o.requesterId === partner.id && o.coupleCode === currentUser.coupleCode
  );
  if (pending.length === 0) { titleEl.style.display = 'none'; listEl.innerHTML = ''; return; }
  titleEl.style.display = 'flex';
  listEl.innerHTML = pending.map(o => outingCardHTML(o, true)).join('');
}

function renderTodayOutings() {
  const today = new Date().toDateString();
  const list  = getOutings().filter(o =>
    o.coupleCode === currentUser.coupleCode && o.status === 'approved' && new Date(o.startTime).toDateString() === today
  );
  document.getElementById('today-list').innerHTML = list.length
    ? list.map(o => outingCardHTML(o, false)).join('')
    : `<div class="empty-state"><span class="empty-emoji">🛋️</span><p>No outings today — cozy day in!</p></div>`;
}

function renderUpcomingOuting() {
  const now    = new Date();
  const future = getOutings()
    .filter(o => o.coupleCode === currentUser.coupleCode && o.status === 'approved' && new Date(o.startTime) > now)
    .sort((a,b) => new Date(a.startTime) - new Date(b.startTime));
  document.getElementById('upcoming-list').innerHTML = future.length
    ? outingCardHTML(future[0], false)
    : `<div class="empty-state"><span class="empty-emoji">📭</span><p>Nothing planned yet — request an outing!</p></div>`;
}

// ── OUTING CARD ──
function outingCardHTML(o, showActions) {
  const users     = getUsers();
  const requester = users[o.requesterId];
  const isMe      = o.requesterId === currentUser.id;
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
        <span class="outing-meta-item">👤 ${isMe ? 'Your request' : (requester ? requester.name + "'s request" : 'Request')}</span>
        ${o.checkin ? `<span class="outing-meta-item">📲 Every ${o.checkinInterval}h</span>` : ''}
      </div>
      ${actionsHTML}
    </div>`;
}

// ── REQUEST FORM ──
let checkinEnabled = true;

function setCheckin(val) {
  checkinEnabled = val;
  document.getElementById('checkin-yes').classList.toggle('active', val);
  document.getElementById('checkin-no').classList.toggle('active', !val);
  document.getElementById('checkin-interval-wrap').classList.toggle('visible', val);
}

function submitRequest() {
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
  const partner = getPartner();
  if (!partner) return showToast('No partner linked yet — share your couple code! 💕', 'error');
  const outing = {
    id: 'o_' + Date.now(), coupleCode: currentUser.coupleCode, requesterId: currentUser.id,
    venue, location, startTime: start, endTime: end, withWho, reason,
    checkin: checkinEnabled, checkinInterval: checkinEnabled ? parseInt(interval) : null,
    status: 'pending', rejectNote: null, createdAt: new Date().toISOString()
  };
  const outings = getOutings();
  outings.push(outing);
  saveOutings(outings);
  ['req-venue','req-location','req-with','req-reason'].forEach(id => document.getElementById(id).value = '');
  setCheckin(true);
  setDatetimeDefaults();
  showToast('Request sent! Waiting for approval 💌', 'success');
  navigate('home');
}

// ── APPROVE / REJECT ──
function approveOuting(id) {
  const outings = getOutings();
  const idx     = outings.findIndex(o => o.id === id);
  if (idx === -1) return;
  outings[idx].status = 'approved';
  saveOutings(outings);
  adjustTrust(outings[idx].requesterId, +5);
  showToast('Outing approved! Have fun 🎉', 'success');
  renderHome();
}

function openRejectModal(id) {
  pendingRejectId = id;
  document.getElementById('reject-note-input').value = '';
  openModal('modal-reject');
}

function confirmReject() {
  if (!pendingRejectId) return;
  const note    = document.getElementById('reject-note-input').value.trim();
  const outings = getOutings();
  const idx     = outings.findIndex(o => o.id === pendingRejectId);
  if (idx === -1) return;
  outings[idx].status     = 'rejected';
  outings[idx].rejectNote = note || null;
  saveOutings(outings);
  adjustTrust(outings[idx].requesterId, -5);
  pendingRejectId = null;
  closeModal('modal-reject');
  showToast('Request rejected 💔', 'error');
  renderHome();
}

// ── TRUST SCORE ──
function adjustTrust(userId, delta) {
  const users = getUsers();
  if (!users[userId]) return;
  users[userId].trustScore = Math.min(100, Math.max(0, users[userId].trustScore + delta));
  saveUsers(users);
  if (userId === currentUser.id) { currentUser.trustScore = users[userId].trustScore; save('da_session', currentUser); }
}

function adjustStat(userId, stat, delta) {
  const users = getUsers();
  if (!users[userId]) return;
  if (!users[userId].stats) users[userId].stats = { ontime:0, checkins:0, missed:0, late:0, rejected:0 };
  users[userId].stats[stat] = (users[userId].stats[stat] || 0) + delta;
  saveUsers(users);
  if (userId === currentUser.id) { currentUser.stats = users[userId].stats; save('da_session', currentUser); }
}

function refreshCurrentUser() {
  const users = getUsers();
  if (users[currentUser.id]) { currentUser = users[currentUser.id]; save('da_session', currentUser); }
}

// ── DETAIL MODAL ──
function openDetail(id) {
  const o = getOutings().find(x => x.id === id);
  if (!o) return;
  const requester = getUsers()[o.requesterId];
  const isPartnerRequest = o.requesterId !== currentUser.id;
  document.getElementById('modal-detail-title').textContent = `📍 ${o.venue}`;
  const rows = [
    ['Location',     o.location],
    ['Start Time',   fmtDateTime(o.startTime)],
    ['Home Time',    fmtDateTime(o.endTime)],
    ['With',         o.withWho],
    ['Reason',       o.reason],
    ['Check-ins',    o.checkin ? `Every ${o.checkinInterval} hour(s)` : 'No check-ins'],
    ['Requested by', requester ? requester.name : 'Unknown'],
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
}

function simulateCheckin(id) {
  adjustTrust(currentUser.id, +5);
  adjustStat(currentUser.id, 'checkins', 1);
  showToast('Check-in recorded! +5 trust ✅', 'success');
  closeModal('modal-detail');
  renderHome();
}

function simulateReturn(id) {
  adjustTrust(currentUser.id, +5);
  adjustStat(currentUser.id, 'ontime', 1);
  showToast("Welcome home! +5 trust 🏠💕", 'success');
  closeModal('modal-detail');
  renderHome();
}

// ── HISTORY ──
function renderHistory(filter) {
  const outings = getOutings().filter(o => o.coupleCode === currentUser.coupleCode);
  let filtered  = outings;
  if (filter === 'approved') filtered = outings.filter(o => o.status === 'approved');
  if (filter === 'pending')  filtered = outings.filter(o => o.status === 'pending');
  if (filter === 'rejected') filtered = outings.filter(o => o.status === 'rejected');
  if (filter === 'mine')     filtered = outings.filter(o => o.requesterId === currentUser.id);
  filtered.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
  const el = document.getElementById('history-list');
  el.innerHTML = filtered.length
    ? filtered.map(o => outingCardHTML(o, false)).join('')
    : `<div class="empty-state"><span class="empty-emoji">🗂️</span><p>Nothing here yet — get out there!</p></div>`;
}

function filterHistory(filter, btn) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  renderHistory(filter);
}

// ── PROFILE ──
function renderProfile() {
  refreshCurrentUser();
  const score = currentUser.trustScore;
  const { label, color } = getTrustLabel(score);
  const stats = currentUser.stats || {};
  const avatarEl = document.getElementById('profile-avatar');
  avatarEl.innerHTML = currentUser.photo
    ? `<img src="${currentUser.photo}" alt="${currentUser.name}" />`
    : currentUser.name[0].toUpperCase();
  document.getElementById('profile-name').textContent = currentUser.name;
  document.getElementById('profile-code').textContent = `Couple Code: ${currentUser.coupleCode}`;
  document.getElementById('profile-score-num').textContent   = score;
  document.getElementById('profile-score-num').style.color   = color;
  document.getElementById('profile-score-bar').style.width   = score + '%';
  document.getElementById('profile-score-bar').style.background = color;
  document.getElementById('profile-score-label').textContent = label;
  document.getElementById('profile-score-label').style.background = color + '22';
  document.getElementById('profile-score-label').style.color = color;
  document.getElementById('stat-ontime').textContent   = stats.ontime   || 0;
  document.getElementById('stat-checkins').textContent = stats.checkins || 0;
  document.getElementById('stat-missed').textContent   = stats.missed   || 0;
  document.getElementById('stat-late').textContent     = stats.late     || 0;
  document.getElementById('stat-rejected').textContent = stats.rejected || 0;
}

// ── MODALS ──
function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ── TOAST ──
let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── UTILS ──
function fmtDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true });
}
