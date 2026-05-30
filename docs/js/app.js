// ══════════════════════════════════════════════════════════════
//  SMG BADMINTON CLUB — Frontend App
//  Replace SCRIPT_URL below with your Google Apps Script URL
//  after you deploy the Code.gs as a Web App.
// ══════════════════════════════════════════════════════════════

const SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';

// ── STATE ──────────────────────────────────────────────────────
let currentUser  = null;
let currentPage  = 'dashboard';
let pageHistory  = [];
let allMembers   = [];
let allSessions  = [];
let courtCount   = 2;

const PAGE_TITLES = {
  dashboard: 'SMG Badminton', members: 'Members', schedule: 'Game Schedule',
  games: 'Tournament Games', attendance: 'My Attendance', booking: 'ActiveSG Booking',
  payments: 'Payments', reports: 'Reports', 'report-attendance': 'Attendance Report',
  'report-bookings': 'Bookings Report', 'report-results': 'Game Results',
  'report-players': 'Player Stats', 'report-teams': 'Team History',
  'report-payments': 'Payment Report',
};

// ── API — Google Apps Script calls ────────────────────────────
async function scriptGet(action, params = {}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('token', currentUser.token);
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') url.searchParams.set(k, v); });
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function scriptPost(action, payload = {}) {
  const res = await fetch(SCRIPT_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'text/plain' },
    body:    JSON.stringify({ action, token: currentUser.token, ...payload }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── TOAST ──────────────────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.className = ''), 2800);
}

// ── MODAL ──────────────────────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) e.target.classList.add('hidden');
});

// ── NAV ────────────────────────────────────────────────────────
const SUB_PAGES = ['report-attendance','report-bookings','report-results','report-players','report-teams','report-payments'];

function navigateTo(page, push = true) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  document.getElementById('back-btn').classList.toggle('hidden', !SUB_PAGES.includes(page));
  if (push && SUB_PAGES.includes(page)) pageHistory.push(currentPage);
  currentPage = page;
  document.querySelectorAll('.nav-item').forEach(item =>
    item.classList.toggle('active', item.dataset.page === page));
  loadPage(page);
}

document.getElementById('back-btn').addEventListener('click', () => {
  navigateTo(pageHistory.pop() || 'reports', false);
});
document.querySelectorAll('.nav-item').forEach(item =>
  item.addEventListener('click', () => navigateTo(item.dataset.page)));

// ── AUTH ────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (u === 'admin' && p === 'smg123456') {
    currentUser = { role: 'admin', token: p };
    localStorage.setItem('smg_user', JSON.stringify(currentUser));
    initApp();
  } else if (u === 'smg' && p === 'smg12345') {
    currentUser = { role: 'member', token: p };
    localStorage.setItem('smg_user', JSON.stringify(currentUser));
    initApp();
  } else {
    document.getElementById('login-error').textContent = 'Invalid username or password';
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('smg_user');
  location.reload();
});

function checkSession() {
  const saved = localStorage.getItem('smg_user');
  if (saved) { currentUser = JSON.parse(saved); initApp(); }
}

function initApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  preloadData();
  navigateTo('dashboard', false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── PRELOAD ────────────────────────────────────────────────────
async function preloadData() {
  try {
    [allMembers, allSessions] = await Promise.all([scriptGet('getMembers'), scriptGet('getSessions')]);
    populateSessionSelects();
    populateMemberSelects();
  } catch (e) { console.error('Preload:', e.message); }
}

function formatSessionLabel(s) {
  const d   = new Date(s.date + 'T00:00:00');
  const day = d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${s.startTime}–${s.endTime} · ${s.location}`;
}

function populateSessionSelects() {
  const sorted  = [...allSessions].sort((a, b) => a.date < b.date ? 1 : -1);
  const ids     = ['att-session','book-session','pay-session','games-session-filter',
                   'ratt-session','rbook-session','rres-session','rpay-session'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = '<option value="">Select session…</option>' +
      sorted.map(s => `<option value="${s.id}">${formatSessionLabel(s)}</option>`).join('');
    if (cur) el.value = cur;
  });
}

function populateMemberSelects() {
  const sorted = [...allMembers].sort((a, b) => a.name.localeCompare(b.name));
  const ids    = ['att-member','book-member','g-a1','g-a2','g-b1','g-b2','rteam-p1','rteam-p2'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const optional = id === 'rteam-p2';
    el.innerHTML = `<option value="">${optional ? 'Any player' : 'Select member…'}</option>` +
      sorted.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  });
}

// ── PAGE LOADER ────────────────────────────────────────────────
function loadPage(page) {
  const map = {
    dashboard: loadDashboard, members: loadMembers, schedule: loadSessions,
    games: loadGames, attendance: loadAttendancePage, booking: loadBookingPage,
    payments: loadPaymentPage, 'report-attendance': loadReportAttendance,
    'report-bookings': loadReportBookings, 'report-results': loadReportResults,
    'report-players': loadReportPlayers,
  };
  if (map[page]) map[page]();
}

// ── DASHBOARD ──────────────────────────────────────────────────
async function loadDashboard() {
  const today = new Date();
  document.getElementById('hero-date').textContent =
    today.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  try {
    const [sessions, members, attendance] = await Promise.all([
      scriptGet('getSessions'), scriptGet('getMembers'), scriptGet('getAttendance'),
    ]);
    allSessions = sessions; allMembers = members;
    populateSessionSelects(); populateMemberSelects();

    const todayStr  = today.toISOString().slice(0, 10);
    const upcoming  = sessions.filter(s => s.date >= todayStr)
                              .sort((a, b) => a.date > b.date ? 1 : -1).slice(0, 5);
    const container = document.getElementById('dashboard-sessions');

    container.innerHTML = upcoming.length ? upcoming.map(s => {
      const d       = new Date(s.date + 'T00:00:00');
      const attCount = attendance.filter(a => a.sessionId === s.id).length;
      const courts  = parseCourts(s.courts);
      return `
        <div class="session-card">
          <div class="session-card-header">
            <div>
              <div class="session-card-date">${d.toLocaleDateString('en-SG',{weekday:'short',day:'numeric',month:'short',year:'numeric'})}</div>
              <div class="session-card-time">${s.startTime} – ${s.endTime}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:22px;font-weight:800">${attCount}</div>
              <div style="font-size:11px;opacity:.7">attending</div>
            </div>
          </div>
          <div class="session-card-body">
            <div class="session-card-loc">📍 ${s.location}</div>
            <div class="session-courts">${courts.map(c=>`<span class="court-badge">${c}</span>`).join('')}</div>
          </div>
        </div>`;
    }).join('') : `<div class="empty"><div class="empty-icon">📅</div><p>No upcoming sessions scheduled</p></div>`;

    document.getElementById('dashboard-stats').innerHTML = `
      <div class="stat-pill"><div class="num">${members.length}</div><div class="lbl">Members</div></div>
      <div class="stat-pill"><div class="num">${sessions.length}</div><div class="lbl">Sessions</div></div>
      <div class="stat-pill"><div class="num">${upcoming.length}</div><div class="lbl">Upcoming</div></div>`;
  } catch (e) { toast('Dashboard error: ' + e.message, 'error'); }
}

// ── MEMBERS ────────────────────────────────────────────────────
async function loadMembers() {
  try { allMembers = await scriptGet('getMembers'); populateMemberSelects(); renderMembers(); }
  catch (e) { toast(e.message, 'error'); }
}

function renderMembers() {
  const q        = document.getElementById('member-search').value.toLowerCase();
  const filtered = allMembers.filter(m => m.name.toLowerCase().includes(q) || (m.phone || '').includes(q));
  const el       = document.getElementById('members-list');
  el.innerHTML   = filtered.length ? filtered.map(m => `
    <div class="member-card">
      <div class="member-avatar">${m.name.charAt(0).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-phone">📞 ${m.phone || '—'}</div>
        <div class="member-badges">
          <span class="badge badge-${m.type === 'permanent' ? 'perm' : 'temp'}">${m.type}</span>
          <span class="badge badge-${m.category === 'competitive' ? 'comp' : 'pleasure'}">${m.category}</span>
        </div>
      </div>
      ${currentUser.role === 'admin' ? `<button class="btn-danger btn-sm" onclick="deleteMember('${m.id}','${m.name}')">✕</button>` : ''}
    </div>`).join('') : `<div class="empty"><div class="empty-icon">👥</div><p>No members found</p></div>`;
}

document.getElementById('member-search').addEventListener('input', renderMembers);

async function addMember() {
  const name     = document.getElementById('m-name').value.trim();
  const phone    = document.getElementById('m-phone').value.trim();
  const type     = document.getElementById('m-type').value;
  const category = document.getElementById('m-category').value;
  if (!name) return toast('Name is required', 'error');
  try {
    const m = await scriptPost('addMember', { name, phone, type, category });
    allMembers.push(m); renderMembers(); populateMemberSelects();
    hideModal('modal-add-member');
    document.getElementById('m-name').value = '';
    document.getElementById('m-phone').value = '';
    toast('Member added ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMember(id, name) {
  if (!confirm(`Remove ${name}?`)) return;
  try {
    await scriptPost('deleteMember', { id });
    allMembers = allMembers.filter(m => m.id !== id);
    renderMembers(); populateMemberSelects();
    toast('Member removed', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── SESSIONS ──────────────────────────────────────────────────
function parseCourts(raw) {
  try { return JSON.parse(raw).filter(Boolean); } catch { return [raw].filter(Boolean); }
}

async function loadSessions() {
  try { allSessions = await scriptGet('getSessions'); populateSessionSelects(); renderSessions(); }
  catch (e) { toast(e.message, 'error'); }
}

function renderSessions() {
  const sorted = [...allSessions].sort((a, b) => a.date < b.date ? 1 : -1);
  const el     = document.getElementById('sessions-list');
  el.innerHTML = sorted.length ? sorted.map(s => {
    const d      = new Date(s.date + 'T00:00:00');
    const courts = parseCourts(s.courts);
    return `
      <div class="session-card">
        <div class="session-card-header">
          <div>
            <div class="session-card-date">${d.toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            <div class="session-card-time">${s.startTime} – ${s.endTime}</div>
          </div>
        </div>
        <div class="session-card-body">
          <div class="session-card-loc">📍 ${s.location}</div>
          <div class="session-courts">${courts.map(c=>`<span class="court-badge">${c}</span>`).join('')}</div>
        </div>
        <div class="session-card-actions">
          <button class="btn-danger btn-sm" onclick="deleteSession('${s.id}')">Delete</button>
        </div>
      </div>`;
  }).join('') : `<div class="empty"><div class="empty-icon">📅</div><p>No sessions yet</p></div>`;
}

function addCourt() {
  if (courtCount >= 5) return toast('Maximum 5 courts', 'error');
  courtCount++;
  const div = document.createElement('div');
  div.className = 'court-row';
  div.innerHTML = `<input type="text" class="court-input" placeholder="e.g. Court ${courtCount}">
    <button class="remove-btn" onclick="removeCourt(this)">×</button>`;
  document.getElementById('courts-container').appendChild(div);
  if (courtCount >= 5) document.getElementById('add-court-btn').style.display = 'none';
}

function removeCourt(btn) {
  btn.parentElement.remove(); courtCount--;
  document.getElementById('add-court-btn').style.display = '';
}

async function addSession() {
  const date      = document.getElementById('s-date').value;
  const startTime = document.getElementById('s-start').value;
  const endTime   = document.getElementById('s-end').value;
  const location  = document.getElementById('s-location').value.trim();
  const courts    = [...document.querySelectorAll('.court-input')].map(i => i.value.trim()).filter(Boolean);
  if (!date)         return toast('Date is required', 'error');
  if (!courts.length) return toast('Add at least one court', 'error');
  try {
    const s = await scriptPost('addSession', { date, startTime, endTime, location, courts });
    allSessions.push(s); renderSessions(); populateSessionSelects();
    hideModal('modal-add-session');
    document.getElementById('s-date').value = '';
    document.querySelectorAll('.court-input').forEach((inp, i) => {
      if (i >= 2) inp.parentElement.remove(); else inp.value = '';
    });
    courtCount = 2;
    toast('Session created ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteSession(id) {
  if (!confirm('Delete this session?')) return;
  try {
    await scriptPost('deleteSession', { id });
    allSessions = allSessions.filter(s => s.id !== id);
    renderSessions(); populateSessionSelects();
    toast('Session deleted', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── GAMES ──────────────────────────────────────────────────────
async function loadGames() {
  const sessionId = document.getElementById('games-session-filter').value;
  document.getElementById('add-game-btn').style.display = sessionId ? '' : 'none';
  const el = document.getElementById('games-list');
  if (!sessionId) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🏆</div><p>Select a session to view games</p></div>`;
    return;
  }
  try {
    const games = await scriptGet('getGames', { sessionId });
    renderGames(games);
  } catch (e) { toast(e.message, 'error'); }
}

document.getElementById('games-session-filter').addEventListener('change', loadGames);

function renderGames(games) {
  const el = document.getElementById('games-list');
  el.innerHTML = games.length ? games.map((g, i) => {
    const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
    const aWon     = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
    return `
      <div class="game-card">
        <div class="game-header">
          <span>Game ${i + 1}</span>
          <span style="color:${hasScore ? 'var(--accent)' : 'var(--warning)'}; font-weight:700">${hasScore ? 'Scored' : 'Pending'}</span>
        </div>
        <div class="game-body">
          <div class="matchup">
            <div class="team team-a"><div class="team-tag">Team A</div><div class="team-players">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div></div>
            <div class="vs">VS</div>
            <div class="team team-b"><div class="team-tag">Team B</div><div class="team-players">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div></div>
          </div>
          ${hasScore ? `<div class="score-display">${g.teamAScore} – ${g.teamBScore}<div class="winner">${aWon ? '🏆 Team A wins' : '🏆 Team B wins'}</div></div>` : ''}
        </div>
        <div class="game-footer">
          <button class="btn-sm btn-secondary" onclick="openScoreModal('${g.id}','${g.teamAPlayer1} & ${g.teamAPlayer2}','${g.teamBPlayer1} & ${g.teamBPlayer2}','${g.teamAScore}','${g.teamBScore}')">
            ${hasScore ? '✏️ Edit Score' : '📝 Enter Score'}
          </button>
          <button class="btn-sm btn-danger" onclick="deleteGame('${g.id}')">✕</button>
        </div>
      </div>`;
  }).join('') : `<div class="empty"><div class="empty-icon">🏸</div><p>No games yet. Add the first game!</p></div>`;
}

function openAddGame() { populateMemberSelects(); showModal('modal-add-game'); }

async function addGame() {
  const sessionId = document.getElementById('games-session-filter').value;
  const session   = allSessions.find(s => s.id === sessionId);
  const getName   = id => (allMembers.find(m => m.id === id) || {}).name || id;
  const a1 = document.getElementById('g-a1').value;
  const a2 = document.getElementById('g-a2').value;
  const b1 = document.getElementById('g-b1').value;
  const b2 = document.getElementById('g-b2').value;
  if (!a1 || !a2 || !b1 || !b2)               return toast('Select all 4 players', 'error');
  if (new Set([a1,a2,b1,b2]).size < 4)         return toast('Players must be different', 'error');
  try {
    await scriptPost('addGame', {
      sessionId, date: session?.date || '',
      teamAPlayer1: getName(a1), teamAPlayer2: getName(a2),
      teamBPlayer1: getName(b1), teamBPlayer2: getName(b2),
    });
    hideModal('modal-add-game');
    toast('Game added ✓', 'success');
    loadGames();
  } catch (e) { toast(e.message, 'error'); }
}

function openScoreModal(id, teamA, teamB, scoreA, scoreB) {
  document.getElementById('score-game-id').value = id;
  document.getElementById('score-label-a').textContent = teamA;
  document.getElementById('score-label-b').textContent = teamB;
  document.getElementById('score-a').value = scoreA || '';
  document.getElementById('score-b').value = scoreB || '';
  showModal('modal-score');
}

async function submitScore() {
  const id        = document.getElementById('score-game-id').value;
  const teamAScore = document.getElementById('score-a').value;
  const teamBScore = document.getElementById('score-b').value;
  if (teamAScore === '' || teamBScore === '') return toast('Enter both scores', 'error');
  try {
    await scriptPost('updateScore', { id, teamAScore, teamBScore });
    hideModal('modal-score'); toast('Score saved ✓', 'success'); loadGames();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteGame(id) {
  if (!confirm('Delete this game?')) return;
  try { await scriptPost('deleteGame', { id }); toast('Game deleted', 'success'); loadGames(); }
  catch (e) { toast(e.message, 'error'); }
}

// ── ATTENDANCE ────────────────────────────────────────────────
async function loadAttendancePage() {
  const sessionId = document.getElementById('att-session').value;
  const el        = document.getElementById('att-confirmed-list');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const list = (await scriptGet('getAttendance', { date: session?.date || '' }))
                   .filter(a => a.sessionId === sessionId);
    el.innerHTML = list.length ? list.map(a => `
      <div class="confirm-item">
        <div><div class="name">${a.memberName}</div><div class="time">${fmtTime(a.confirmedAt)}</div></div>
        <span class="confirmed-chip">✓ Attending</span>
      </div>`).join('') : `<div class="empty"><div class="empty-icon">✅</div><p>No confirmations yet</p></div>`;
  } catch (e) { console.error(e); }
}

document.getElementById('att-session').addEventListener('change', loadAttendancePage);

async function submitAttendance() {
  const sessionId  = document.getElementById('att-session').value;
  const memberId   = document.getElementById('att-member').value;
  const session    = allSessions.find(s => s.id === sessionId);
  const member     = allMembers.find(m => m.id === memberId);
  if (!sessionId) return toast('Select a session', 'error');
  if (!memberId)  return toast('Select your name', 'error');
  try {
    await scriptPost('addAttendance', { sessionId, date: session?.date || '', memberId, memberName: member?.name || '' });
    toast('Attendance confirmed ✓', 'success'); loadAttendancePage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── BOOKING ────────────────────────────────────────────────────
async function loadBookingPage() {
  const sessionId = document.getElementById('book-session').value;
  const el        = document.getElementById('book-confirmed-list');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const list = (await scriptGet('getBookings', { date: session?.date || '' }))
                   .filter(b => b.sessionId === sessionId);
    el.innerHTML = list.length ? list.map(b => `
      <div class="confirm-item">
        <div><div class="name">${b.memberName}</div><div class="time">${fmtTime(b.bookedAt)}</div></div>
        <span class="confirmed-chip">🔖 Booked</span>
      </div>`).join('') : `<div class="empty"><div class="empty-icon">🔖</div><p>No bookings confirmed yet</p></div>`;
  } catch (e) { console.error(e); }
}

document.getElementById('book-session').addEventListener('change', loadBookingPage);

async function submitBooking() {
  const sessionId = document.getElementById('book-session').value;
  const memberId  = document.getElementById('book-member').value;
  const session   = allSessions.find(s => s.id === sessionId);
  const member    = allMembers.find(m => m.id === memberId);
  if (!sessionId) return toast('Select a session', 'error');
  if (!memberId)  return toast('Select your name', 'error');
  try {
    await scriptPost('addBooking', { sessionId, date: session?.date || '', memberId, memberName: member?.name || '' });
    toast('Booking confirmed ✓', 'success'); loadBookingPage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── PAYMENTS ────────────────────────────────────────────────────
async function loadPaymentPage() {
  const sessionId = document.getElementById('pay-session').value;
  const el        = document.getElementById('pay-member-list');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const payments = (await scriptGet('getPayments', { date: session?.date || '' }))
                       .filter(p => p.sessionId === sessionId);
    const paidIds  = new Set(payments.map(p => p.memberId));
    el.innerHTML = `<div class="section-title" style="margin-bottom:10px">Payment Status</div>` +
      allMembers.map(m => {
        const paid = paidIds.has(m.id);
        const rec  = payments.find(p => p.memberId === m.id);
        return `
          <div class="pay-row">
            <div>
              <div class="name">${m.name}</div>
              ${paid ? `<div style="font-size:12px;color:var(--muted)">${fmtDateTime(rec.paidAt)}</div>` : ''}
            </div>
            ${paid ? `<span class="confirmed-chip">✓ Paid</span>`
                   : `<button class="btn-success btn-sm" onclick="markPaid('${sessionId}','${session?.date||''}','${m.id}','${m.name}')">Mark Paid</button>`}
          </div>`;
      }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

document.getElementById('pay-session').addEventListener('change', loadPaymentPage);

async function markPaid(sessionId, date, memberId, memberName) {
  try {
    await scriptPost('addPayment', { sessionId, date, memberId, memberName });
    toast(`${memberName} marked paid ✓`, 'success'); loadPaymentPage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── REPORTS ────────────────────────────────────────────────────
async function loadReportAttendance() {
  const sessionId = document.getElementById('ratt-session').value;
  const el        = document.getElementById('ratt-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const attended   = (await scriptGet('getAttendance', { date: session?.date || '' })).filter(a => a.sessionId === sessionId);
    const attendedIds = new Set(attended.map(a => a.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${attended.length}</div><div class="lbl">Confirmed</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - attended.length}</div><div class="lbl">Not Confirmed</div></div>
      </div>
      <div class="section-title">Confirmed</div>
      ${attended.map(a => `<div class="confirm-item"><div class="name">${a.memberName}</div><span class="confirmed-chip">✓</span></div>`).join('') || '<div class="empty"><p>None yet</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Confirmed</div>
      ${allMembers.filter(m => !attendedIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All confirmed! 🎉</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportBookings() {
  const sessionId = document.getElementById('rbook-session').value;
  const el        = document.getElementById('rbook-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const booked   = (await scriptGet('getBookings', { date: session?.date || '' })).filter(b => b.sessionId === sessionId);
    const bookedIds = new Set(booked.map(b => b.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${booked.length}</div><div class="lbl">Booked</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - booked.length}</div><div class="lbl">Not Booked</div></div>
      </div>
      <div class="section-title">Booked at ActiveSG</div>
      ${booked.map(b => `<div class="confirm-item"><div class="name">${b.memberName}</div><span class="confirmed-chip">🔖 Done</span></div>`).join('') || '<div class="empty"><p>None yet</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Yet Booked</div>
      ${allMembers.filter(m => !bookedIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All booked! 🎉</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportResults() {
  const sessionId = document.getElementById('rres-session').value;
  const el        = document.getElementById('rres-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  try {
    const games = await scriptGet('getGames', { sessionId });
    el.innerHTML = games.length ? games.map((g, i) => {
      const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
      const aWon     = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
      return `
        <div class="result-row">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Game ${i+1}</div>
          <div class="result-teams">
            <div style="${hasScore&&aWon?'color:var(--accent)':''}">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
            <div class="result-score">${hasScore ? `<div class="score">${g.teamAScore} – ${g.teamBScore}</div><div class="winner-tag">${aWon?'🏆 A wins':'🏆 B wins'}</div>` : '<span style="color:var(--muted);font-size:13px">Pending</span>'}</div>
            <div style="text-align:right;${hasScore&&!aWon?'color:var(--accent)':''}">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
          </div>
        </div>`;
    }).join('') : `<div class="empty"><div class="empty-icon">🎯</div><p>No games for this session</p></div>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportPlayers() {
  const el = document.getElementById('rplayer-content');
  el.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><p>Loading stats…</p></div>`;
  try {
    const stats = await scriptGet('getPlayerStats');
    const rankClass = i => ['gold','silver','bronze'][i] || '';
    el.innerHTML = stats.length ? stats.map((p, i) => {
      const rate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
      return `
        <div class="player-stat-card">
          <div class="player-stat-top">
            <div class="player-rank ${rankClass(i)}">${i+1}</div>
            <div><div class="player-stat-name">${p.name}</div>
            <div style="font-size:12px;color:var(--muted)">${rate}% win rate · ${p.pointsFor} pts scored</div></div>
          </div>
          <div class="player-stat-bars">
            <div class="stat-bar-item"><div class="stat-bar-num played-num">${p.played}</div><div class="stat-bar-lbl">Played</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num wins-num">${p.wins}</div><div class="stat-bar-lbl">Wins</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num losses-num">${p.losses}</div><div class="stat-bar-lbl">Losses</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num" style="color:var(--muted)">${p.pointsFor}–${p.pointsAgainst}</div><div class="stat-bar-lbl">PF–PA</div></div>
          </div>
          <div class="win-rate-bar"><div class="win-rate-fill" style="width:${rate}%"></div></div>
        </div>`;
    }).join('') : `<div class="empty"><div class="empty-icon">📈</div><p>No game data yet</p></div>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportTeams() {
  const p1Id = document.getElementById('rteam-p1').value;
  const p2Id = document.getElementById('rteam-p2').value;
  const p1   = (allMembers.find(m => m.id === p1Id) || {}).name;
  const p2   = (allMembers.find(m => m.id === p2Id) || {}).name;
  if (!p1) return toast('Select at least Player 1', 'error');
  const el = document.getElementById('rteam-content');
  el.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
  try {
    const games = await scriptGet('getTeamHistory', { p1, p2: p2 || '' });
    el.innerHTML = games.length ? `<div class="section-title" style="margin-bottom:10px">${games.length} game(s) found</div>` +
      games.map(g => {
        const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
        const aWon     = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
        return `
          <div class="result-row">
            <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${g.date}</div>
            <div class="result-teams">
              <div>${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
              <div class="result-score">${hasScore ? `<div class="score">${g.teamAScore}–${g.teamBScore}</div><div class="winner-tag">${aWon?'A wins':'B wins'}</div>` : 'Pending'}</div>
              <div style="text-align:right">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
            </div>
          </div>`;
      }).join('') : `<div class="empty"><div class="empty-icon">🤝</div><p>No games found for this pair</p></div>`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportPayments() {
  const sessionId = document.getElementById('rpay-session').value;
  const el        = document.getElementById('rpay-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const payments = (await scriptGet('getPayments', { date: session?.date || '' })).filter(p => p.sessionId === sessionId);
    const paidIds  = new Set(payments.map(p => p.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${payments.length}</div><div class="lbl">Paid</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - payments.length}</div><div class="lbl">Unpaid</div></div>
      </div>
      <div class="section-title">Paid</div>
      ${payments.map(p => `<div class="confirm-item"><div class="name">${p.memberName}</div><span class="confirmed-chip">✓ Paid</span></div>`).join('') || '<div class="empty"><p>None yet</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Paid</div>
      ${allMembers.filter(m => !paidIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All paid! 🎉</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

// ── HELPERS ────────────────────────────────────────────────────
function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function fmtDateTime(iso) {
  try { return new Date(iso).toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}

// ── START ──────────────────────────────────────────────────────
checkSession();
