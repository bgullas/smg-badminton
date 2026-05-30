// ── STATE ──────────────────────────────────────────
let currentUser = null;
let currentPage = 'dashboard';
let pageHistory = [];
let allMembers = [];
let allSessions = [];
let courtCount = 2;
let selectedGameSession = null;

const PAGE_TITLES = {
  dashboard: 'SMG Badminton',
  members: 'Members',
  schedule: 'Game Schedule',
  games: 'Tournament Games',
  attendance: 'My Attendance',
  booking: 'ActiveSG Booking',
  payments: 'Payments',
  reports: 'Reports',
  'report-attendance': 'Attendance Report',
  'report-bookings': 'Bookings Report',
  'report-results': 'Game Results',
  'report-players': 'Player Stats',
  'report-teams': 'Team History',
  'report-payments': 'Payment Report',
};

// ── API ────────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch('/api' + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}
const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b);
const PUT = (p, b) => api('PUT', p, b);
const DEL = (p) => api('DELETE', p);

// ── TOAST ──────────────────────────────────────────
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = '', 2800);
}

// ── MODAL ──────────────────────────────────────────
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// ── NAV ────────────────────────────────────────────
function navigateTo(page, pushHistory = true) {
  const subPages = ['report-attendance','report-bookings','report-results','report-players','report-teams','report-payments'];
  const isSubPage = subPages.includes(page);

  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  document.getElementById('back-btn').classList.toggle('hidden', !isSubPage);

  if (pushHistory && isSubPage) pageHistory.push(currentPage);
  currentPage = page;

  // Update bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  loadPage(page);
}

document.getElementById('back-btn').addEventListener('click', () => {
  const prev = pageHistory.pop() || 'reports';
  navigateTo(prev, false);
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// ── AUTH ────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  try {
    const res = await POST('/auth/login', { username: u, password: p });
    currentUser = res;
    initApp();
  } catch {
    document.getElementById('login-error').textContent = 'Invalid username or password';
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await POST('/auth/logout');
  location.reload();
});

async function checkSession() {
  try {
    currentUser = await GET('/auth/me');
    initApp();
  } catch {
    // show login
  }
}

function initApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });

  preloadData();
  navigateTo('dashboard', false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

async function preloadData() {
  try {
    [allMembers, allSessions] = await Promise.all([GET('/members'), GET('/sessions')]);
    populateSessionSelects();
    populateMemberSelects();
  } catch (e) {
    console.error('Preload failed', e);
  }
}

// ── SESSION SELECTS ────────────────────────────────
function formatSessionLabel(s) {
  const d = new Date(s.date + 'T00:00:00');
  const day = d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day} · ${s.startTime}–${s.endTime} · ${s.location}`;
}

function populateSessionSelects() {
  const sorted = [...allSessions].sort((a, b) => a.date < b.date ? 1 : -1);
  const selects = ['att-session', 'book-session', 'pay-session',
    'games-session-filter', 'ratt-session', 'rbook-session',
    'rres-session', 'rpay-session'];
  selects.forEach(id => {
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
  const selects = ['att-member', 'book-member', 'g-a1', 'g-a2', 'g-b1', 'g-b2', 'rteam-p1', 'rteam-p2'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const isOptional = ['rteam-p2'].includes(id);
    el.innerHTML = (isOptional ? '<option value="">Any</option>' : '<option value="">Select member…</option>') +
      sorted.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  });
}

// ── PAGE LOADER ────────────────────────────────────
function loadPage(page) {
  const loaders = {
    dashboard: loadDashboard,
    members: loadMembers,
    schedule: loadSessions,
    games: loadGames,
    attendance: loadAttendancePage,
    booking: loadBookingPage,
    payments: loadPaymentPage,
    'report-attendance': loadReportAttendance,
    'report-bookings': loadReportBookings,
    'report-results': loadReportResults,
    'report-players': loadReportPlayers,
    'report-teams': () => {},
  };
  if (loaders[page]) loaders[page]();
}

// ── DASHBOARD ──────────────────────────────────────
async function loadDashboard() {
  const today = new Date();
  document.getElementById('hero-date').textContent =
    today.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  try {
    const [sessions, members, attendance] = await Promise.all([
      GET('/sessions'), GET('/members'), GET('/attendance')
    ]);
    allSessions = sessions;
    allMembers = members;
    populateSessionSelects();

    const upcoming = sessions
      .filter(s => s.date >= today.toISOString().slice(0, 10))
      .sort((a, b) => a.date > b.date ? 1 : -1)
      .slice(0, 5);

    const container = document.getElementById('dashboard-sessions');
    if (!upcoming.length) {
      container.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>No upcoming sessions</p></div>`;
    } else {
      container.innerHTML = upcoming.map(s => {
        const d = new Date(s.date + 'T00:00:00');
        const dayNum = d.getDate();
        const month = d.toLocaleDateString('en-SG', { month: 'short' });
        const weekday = d.toLocaleDateString('en-SG', { weekday: 'short' });
        const attCount = attendance.filter(a => a.sessionId === s.id).length;
        const courts = parseCourts(s.courts);
        return `
          <div class="session-card">
            <div class="session-card-header">
              <div>
                <div class="session-card-date">${weekday}, ${dayNum} ${month}</div>
                <div class="session-card-time">${s.startTime} – ${s.endTime}</div>
              </div>
              <div style="text-align:right">
                <div style="font-size:18px;font-weight:800">${attCount}</div>
                <div style="font-size:11px;opacity:.7">attending</div>
              </div>
            </div>
            <div class="session-card-body">
              <div class="session-card-loc">📍 ${s.location}</div>
              <div class="session-courts">${courts.map(c => `<span class="court-badge">${c}</span>`).join('')}</div>
            </div>
          </div>`;
      }).join('');
    }

    document.getElementById('dashboard-stats').innerHTML = `
      <div class="stat-pill"><div class="num">${members.length}</div><div class="lbl">Members</div></div>
      <div class="stat-pill"><div class="num">${sessions.length}</div><div class="lbl">Sessions</div></div>
      <div class="stat-pill"><div class="num">${upcoming.length}</div><div class="lbl">Upcoming</div></div>
    `;
  } catch (e) {
    console.error(e);
  }
}

// ── MEMBERS ────────────────────────────────────────
async function loadMembers() {
  try {
    allMembers = await GET('/members');
    populateMemberSelects();
    renderMembers(allMembers);
  } catch (e) { toast(e.message, 'error'); }
}

function renderMembers(members) {
  const search = document.getElementById('member-search').value.toLowerCase();
  const filtered = members.filter(m => m.name.toLowerCase().includes(search) || m.phone.includes(search));
  const container = document.getElementById('members-list');
  if (!filtered.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">👥</div><p>No members found</p></div>`;
    return;
  }
  container.innerHTML = filtered.map(m => `
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
      ${currentUser.role === 'admin' ? `
      <div class="member-actions">
        <button class="btn-danger btn-sm" onclick="deleteMember('${m.id}','${m.name}')">✕</button>
      </div>` : ''}
    </div>`).join('');
}

document.getElementById('member-search').addEventListener('input', () => renderMembers(allMembers));

async function addMember() {
  const name = document.getElementById('m-name').value.trim();
  const phone = document.getElementById('m-phone').value.trim();
  const type = document.getElementById('m-type').value;
  const category = document.getElementById('m-category').value;
  if (!name) return toast('Name is required', 'error');
  try {
    const m = await POST('/members', { name, phone, type, category });
    allMembers.push(m);
    renderMembers(allMembers);
    populateMemberSelects();
    hideModal('modal-add-member');
    document.getElementById('m-name').value = '';
    document.getElementById('m-phone').value = '';
    toast('Member added ✓', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteMember(id, name) {
  if (!confirm(`Remove ${name}?`)) return;
  try {
    await DEL('/members/' + id);
    allMembers = allMembers.filter(m => m.id !== id);
    renderMembers(allMembers);
    populateMemberSelects();
    toast('Member removed', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── SESSIONS ──────────────────────────────────────
function parseCourts(courtsRaw) {
  try { return JSON.parse(courtsRaw).filter(Boolean); } catch { return [courtsRaw].filter(Boolean); }
}

async function loadSessions() {
  try {
    allSessions = await GET('/sessions');
    populateSessionSelects();
    renderSessions(allSessions);
  } catch (e) { toast(e.message, 'error'); }
}

function renderSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => a.date < b.date ? 1 : -1);
  const container = document.getElementById('sessions-list');
  if (!sorted.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>No sessions yet</p></div>`;
    return;
  }
  container.innerHTML = sorted.map(s => {
    const d = new Date(s.date + 'T00:00:00');
    const label = d.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const courts = parseCourts(s.courts);
    return `
      <div class="session-card">
        <div class="session-card-header">
          <div>
            <div class="session-card-date">${label}</div>
            <div class="session-card-time">${s.startTime} – ${s.endTime}</div>
          </div>
        </div>
        <div class="session-card-body">
          <div class="session-card-loc">📍 ${s.location}</div>
          <div class="session-courts">${courts.map(c => `<span class="court-badge">${c}</span>`).join('')}</div>
        </div>
        <div class="session-card-actions">
          <button class="btn-danger btn-sm" onclick="deleteSession('${s.id}')">Delete</button>
        </div>
      </div>`;
  }).join('');
}

function addCourt() {
  if (courtCount >= 5) return toast('Maximum 5 courts', 'error');
  courtCount++;
  const div = document.createElement('div');
  div.className = 'court-row';
  div.innerHTML = `<input type="text" class="court-input" placeholder="Court ${courtCount}">
    <button class="remove-btn" onclick="removeCourt(this)">×</button>`;
  document.getElementById('courts-container').appendChild(div);
  document.getElementById('add-court-btn').style.display = courtCount >= 5 ? 'none' : '';
}

function removeCourt(btn) {
  btn.parentElement.remove();
  courtCount--;
  document.getElementById('add-court-btn').style.display = courtCount >= 5 ? 'none' : '';
}

async function addSession() {
  const date = document.getElementById('s-date').value;
  const startTime = document.getElementById('s-start').value;
  const endTime = document.getElementById('s-end').value;
  const location = document.getElementById('s-location').value.trim();
  const courts = [...document.querySelectorAll('.court-input')].map(i => i.value.trim()).filter(Boolean);
  if (!date) return toast('Date is required', 'error');
  if (!courts.length) return toast('At least one court required', 'error');
  try {
    const s = await POST('/sessions', { date, startTime, endTime, location, courts });
    allSessions.push(s);
    renderSessions(allSessions);
    populateSessionSelects();
    hideModal('modal-add-session');
    // Reset form
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
    await DEL('/sessions/' + id);
    allSessions = allSessions.filter(s => s.id !== id);
    renderSessions(allSessions);
    populateSessionSelects();
    toast('Session deleted', 'success');
  } catch (e) { toast(e.message, 'error'); }
}

// ── GAMES ──────────────────────────────────────────
async function loadGames() {
  const sessionId = document.getElementById('games-session-filter').value;
  document.getElementById('add-game-btn').style.display = sessionId ? '' : 'none';
  if (!sessionId) {
    document.getElementById('games-list').innerHTML = `<div class="empty"><div class="empty-icon">🏆</div><p>Select a session to view games</p></div>`;
    return;
  }
  selectedGameSession = allSessions.find(s => s.id === sessionId);
  try {
    const games = await GET('/games?sessionId=' + sessionId);
    renderGames(games);
  } catch (e) { toast(e.message, 'error'); }
}

document.getElementById('games-session-filter').addEventListener('change', loadGames);

function renderGames(games) {
  const container = document.getElementById('games-list');
  if (!games.length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🏸</div><p>No games yet. Add the first game!</p></div>`;
    return;
  }
  container.innerHTML = games.map((g, i) => {
    const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
    const aWon = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
    return `
      <div class="game-card">
        <div class="game-header">
          <span>Game ${i + 1}</span>
          ${hasScore ? `<span style="color:var(--accent);font-weight:700">Scored</span>` : `<span style="color:var(--warning)">Pending</span>`}
        </div>
        <div class="game-body">
          <div class="matchup">
            <div class="team team-a">
              <div class="team-tag">Team A</div>
              <div class="team-players">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
            </div>
            <div class="vs">VS</div>
            <div class="team team-b">
              <div class="team-tag">Team B</div>
              <div class="team-players">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
            </div>
          </div>
          ${hasScore ? `
            <div class="score-display">
              ${g.teamAScore} – ${g.teamBScore}
              <div class="winner">${aWon ? '🏆 Team A wins' : '🏆 Team B wins'}</div>
            </div>` : ''}
        </div>
        <div class="game-footer">
          <button class="btn-sm btn-secondary" onclick="openScoreModal('${g.id}','${g.teamAPlayer1} & ${g.teamAPlayer2}','${g.teamBPlayer1} & ${g.teamBPlayer2}','${g.teamAScore}','${g.teamBScore}')">
            ${hasScore ? '✏️ Edit Score' : '📝 Enter Score'}
          </button>
          <button class="btn-sm btn-danger" onclick="deleteGame('${g.id}')">✕</button>
        </div>
      </div>`;
  }).join('');
}

function openAddGame() {
  populateMemberSelects();
  showModal('modal-add-game');
}

async function addGame() {
  const sessionId = document.getElementById('games-session-filter').value;
  const session = allSessions.find(s => s.id === sessionId);
  const getMemberName = id => (allMembers.find(m => m.id === id) || {}).name || id;
  const a1 = document.getElementById('g-a1').value;
  const a2 = document.getElementById('g-a2').value;
  const b1 = document.getElementById('g-b1').value;
  const b2 = document.getElementById('g-b2').value;
  if (!a1 || !a2 || !b1 || !b2) return toast('Select all 4 players', 'error');
  if (new Set([a1, a2, b1, b2]).size < 4) return toast('Players must be different', 'error');
  try {
    await POST('/games', {
      sessionId, date: session?.date || '',
      teamAPlayer1: getMemberName(a1), teamAPlayer2: getMemberName(a2),
      teamBPlayer1: getMemberName(b1), teamBPlayer2: getMemberName(b2),
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
  const id = document.getElementById('score-game-id').value;
  const teamAScore = document.getElementById('score-a').value;
  const teamBScore = document.getElementById('score-b').value;
  if (teamAScore === '' || teamBScore === '') return toast('Enter both scores', 'error');
  try {
    await PUT('/games/' + id + '/score', { teamAScore, teamBScore });
    hideModal('modal-score');
    toast('Score saved ✓', 'success');
    loadGames();
  } catch (e) { toast(e.message, 'error'); }
}

async function deleteGame(id) {
  if (!confirm('Delete this game?')) return;
  try {
    await DEL('/games/' + id);
    toast('Game deleted', 'success');
    loadGames();
  } catch (e) { toast(e.message, 'error'); }
}

// ── ATTENDANCE ─────────────────────────────────────
async function loadAttendancePage() {
  const sessionId = document.getElementById('att-session').value;
  if (!sessionId) { document.getElementById('att-confirmed-list').innerHTML = ''; return; }
  try {
    const session = allSessions.find(s => s.id === sessionId);
    const list = await GET('/attendance?date=' + (session?.date || ''));
    const sessionList = list.filter(a => a.sessionId === sessionId);
    document.getElementById('att-confirmed-list').innerHTML = sessionList.length
      ? sessionList.map(a => `
          <div class="confirm-item">
            <div><div class="name">${a.memberName}</div><div class="time">${new Date(a.confirmedAt).toLocaleTimeString('en-SG', {hour:'2-digit',minute:'2-digit'})}</div></div>
            <span class="confirmed-chip">✓ Attending</span>
          </div>`).join('')
      : `<div class="empty"><div class="empty-icon">✅</div><p>No one confirmed yet</p></div>`;
  } catch (e) { console.error(e); }
}

document.getElementById('att-session').addEventListener('change', loadAttendancePage);

async function submitAttendance() {
  const sessionId = document.getElementById('att-session').value;
  const memberId = document.getElementById('att-member').value;
  const session = allSessions.find(s => s.id === sessionId);
  const member = allMembers.find(m => m.id === memberId);
  if (!sessionId) return toast('Select a session', 'error');
  if (!memberId) return toast('Select your name', 'error');
  try {
    await POST('/attendance', { sessionId, date: session?.date || '', memberId, memberName: member?.name || '' });
    toast('Attendance confirmed ✓', 'success');
    loadAttendancePage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── BOOKING ────────────────────────────────────────
async function loadBookingPage() {
  const sessionId = document.getElementById('book-session').value;
  if (!sessionId) { document.getElementById('book-confirmed-list').innerHTML = ''; return; }
  try {
    const session = allSessions.find(s => s.id === sessionId);
    const list = await GET('/bookings?date=' + (session?.date || ''));
    const sessionList = list.filter(b => b.sessionId === sessionId);
    document.getElementById('book-confirmed-list').innerHTML = sessionList.length
      ? sessionList.map(b => `
          <div class="confirm-item">
            <div><div class="name">${b.memberName}</div><div class="time">${new Date(b.bookedAt).toLocaleTimeString('en-SG', {hour:'2-digit',minute:'2-digit'})}</div></div>
            <span class="confirmed-chip">🔖 Booked</span>
          </div>`).join('')
      : `<div class="empty"><div class="empty-icon">🔖</div><p>No bookings confirmed yet</p></div>`;
  } catch (e) { console.error(e); }
}

document.getElementById('book-session').addEventListener('change', loadBookingPage);

async function submitBooking() {
  const sessionId = document.getElementById('book-session').value;
  const memberId = document.getElementById('book-member').value;
  const session = allSessions.find(s => s.id === sessionId);
  const member = allMembers.find(m => m.id === memberId);
  if (!sessionId) return toast('Select a session', 'error');
  if (!memberId) return toast('Select your name', 'error');
  try {
    await POST('/bookings', { sessionId, date: session?.date || '', memberId, memberName: member?.name || '' });
    toast('Booking confirmed ✓', 'success');
    loadBookingPage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── PAYMENTS ───────────────────────────────────────
async function loadPaymentPage() {
  const sessionId = document.getElementById('pay-session').value;
  if (!sessionId) { document.getElementById('pay-member-list').innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const [payments, attendance] = await Promise.all([
      GET('/payments?date=' + (session?.date || '')),
      GET('/attendance?date=' + (session?.date || ''))
    ]);
    const sessionPayments = payments.filter(p => p.sessionId === sessionId);
    const sessionAttendees = attendance.filter(a => a.sessionId === sessionId);
    const paidIds = new Set(sessionPayments.map(p => p.memberId));

    // Show all members (or those who confirmed attendance)
    const relevantMembers = allMembers;
    document.getElementById('pay-member-list').innerHTML = `
      <div class="section-title" style="margin-bottom:10px">Members – Payment Status</div>
      ${relevantMembers.map(m => {
        const paid = paidIds.has(m.id);
        const payRecord = sessionPayments.find(p => p.memberId === m.id);
        return `
          <div class="pay-row">
            <div>
              <div class="name">${m.name}</div>
              ${paid ? `<div style="font-size:12px;color:var(--muted)">${new Date(payRecord.paidAt).toLocaleString('en-SG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</div>` : ''}
            </div>
            ${paid
              ? `<span class="confirmed-chip">✓ Paid</span>`
              : `<button class="btn-success btn-sm" onclick="markPaid('${sessionId}','${session?.date||''}','${m.id}','${m.name}')">Mark Paid</button>`
            }
          </div>`;
      }).join('')}`;
  } catch (e) { toast(e.message, 'error'); }
}

document.getElementById('pay-session').addEventListener('change', loadPaymentPage);

async function markPaid(sessionId, date, memberId, memberName) {
  try {
    await POST('/payments', { sessionId, date, memberId, memberName });
    toast(`${memberName} marked as paid ✓`, 'success');
    loadPaymentPage();
  } catch (e) { toast(e.message, 'error'); }
}

// ── REPORTS ────────────────────────────────────────
async function loadReportAttendance() {
  const sessionId = document.getElementById('ratt-session').value;
  const el = document.getElementById('ratt-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const list = await GET('/attendance?date=' + (session?.date || ''));
    const attended = list.filter(a => a.sessionId === sessionId);
    const attendedIds = new Set(attended.map(a => a.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${attended.length}</div><div class="lbl">Confirmed</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - attended.length}</div><div class="lbl">Not confirmed</div></div>
      </div>
      <div class="section-title">Confirmed</div>
      ${attended.map(a => `<div class="confirm-item"><div class="name">${a.memberName}</div><span class="confirmed-chip">✓</span></div>`).join('') || '<div class="empty"><p>None</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Confirmed</div>
      ${allMembers.filter(m => !attendedIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All confirmed!</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportBookings() {
  const sessionId = document.getElementById('rbook-session').value;
  const el = document.getElementById('rbook-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const list = await GET('/bookings?date=' + (session?.date || ''));
    const booked = list.filter(b => b.sessionId === sessionId);
    const bookedIds = new Set(booked.map(b => b.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${booked.length}</div><div class="lbl">Booked</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - booked.length}</div><div class="lbl">Not booked</div></div>
      </div>
      <div class="section-title">Booked at ActiveSG</div>
      ${booked.map(b => `<div class="confirm-item"><div class="name">${b.memberName}</div><span class="confirmed-chip">🔖 Done</span></div>`).join('') || '<div class="empty"><p>None</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Yet Booked</div>
      ${allMembers.filter(m => !bookedIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All booked!</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportResults() {
  const sessionId = document.getElementById('rres-session').value;
  const el = document.getElementById('rres-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  try {
    const games = await GET('/games?sessionId=' + sessionId);
    if (!games.length) { el.innerHTML = `<div class="empty"><div class="empty-icon">🎯</div><p>No games for this session</p></div>`; return; }
    el.innerHTML = games.map((g, i) => {
      const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
      const aWon = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
      return `
        <div class="result-row">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px">Game ${i+1}</div>
          <div class="result-teams">
            <div style="${hasScore && aWon ? 'color:var(--accent)' : ''}">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
            <div class="result-score">
              ${hasScore ? `<div class="score">${g.teamAScore} – ${g.teamBScore}</div>
              <div class="winner-tag">${aWon ? '🏆 A wins' : '🏆 B wins'}</div>`
              : '<div style="color:var(--muted);font-size:13px">Pending</div>'}
            </div>
            <div style="text-align:right;${hasScore && !aWon ? 'color:var(--accent)' : ''}">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
          </div>
        </div>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportPlayers() {
  const el = document.getElementById('rplayer-content');
  el.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
  try {
    const stats = await GET('/reports/player-stats');
    if (!stats.length) { el.innerHTML = `<div class="empty"><div class="empty-icon">📈</div><p>No game data yet</p></div>`; return; }
    const rankClass = i => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    el.innerHTML = stats.map((p, i) => {
      const rate = p.played ? Math.round((p.wins / p.played) * 100) : 0;
      return `
        <div class="player-stat-card">
          <div class="player-stat-top">
            <div class="player-rank ${rankClass(i)}">${i + 1}</div>
            <div>
              <div class="player-stat-name">${p.name}</div>
              <div style="font-size:12px;color:var(--muted)">${rate}% win rate · ${p.pointsFor} pts scored</div>
            </div>
          </div>
          <div class="player-stat-bars">
            <div class="stat-bar-item"><div class="stat-bar-num played-num">${p.played}</div><div class="stat-bar-lbl">Played</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num wins-num">${p.wins}</div><div class="stat-bar-lbl">Wins</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num losses-num">${p.losses}</div><div class="stat-bar-lbl">Losses</div></div>
            <div class="stat-bar-item"><div class="stat-bar-num" style="color:var(--muted)">${p.pointsFor}–${p.pointsAgainst}</div><div class="stat-bar-lbl">PF–PA</div></div>
          </div>
          <div class="win-rate-bar"><div class="win-rate-fill" style="width:${rate}%"></div></div>
        </div>`;
    }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportTeams() {
  const p1Id = document.getElementById('rteam-p1').value;
  const p2Id = document.getElementById('rteam-p2').value;
  const p1 = (allMembers.find(m => m.id === p1Id) || {}).name;
  const p2 = (allMembers.find(m => m.id === p2Id) || {}).name;
  if (!p1) return toast('Select at least Player 1', 'error');
  const el = document.getElementById('rteam-content');
  el.innerHTML = `<div class="empty"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
  try {
    let url = '/reports/team-history?p1=' + encodeURIComponent(p1);
    if (p2) url += '&p2=' + encodeURIComponent(p2);
    const games = await GET(url);
    if (!games.length) { el.innerHTML = `<div class="empty"><div class="empty-icon">🤝</div><p>No games found</p></div>`; return; }
    el.innerHTML = `<div class="section-title" style="margin-bottom:10px">${games.length} game(s) found</div>` +
      games.map(g => {
        const hasScore = g.teamAScore !== '' && g.teamBScore !== '';
        const aWon = hasScore && parseInt(g.teamAScore) > parseInt(g.teamBScore);
        return `
          <div class="result-row">
            <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${g.date}</div>
            <div class="result-teams">
              <div>${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
              <div class="result-score">${hasScore ? `<div class="score">${g.teamAScore}–${g.teamBScore}</div><div class="winner-tag">${aWon?'A wins':'B wins'}</div>` : 'Pending'}</div>
              <div style="text-align:right">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
            </div>
          </div>`;
      }).join('');
  } catch (e) { toast(e.message, 'error'); }
}

async function loadReportPayments() {
  const sessionId = document.getElementById('rpay-session').value;
  const el = document.getElementById('rpay-content');
  if (!sessionId) { el.innerHTML = ''; return; }
  const session = allSessions.find(s => s.id === sessionId);
  try {
    const payments = await GET('/payments?date=' + (session?.date || ''));
    const sessionPayments = payments.filter(p => p.sessionId === sessionId);
    const paidIds = new Set(sessionPayments.map(p => p.memberId));
    el.innerHTML = `
      <div class="stats-row" style="margin-bottom:16px">
        <div class="stat-pill"><div class="num">${sessionPayments.length}</div><div class="lbl">Paid</div></div>
        <div class="stat-pill"><div class="num">${allMembers.length - sessionPayments.length}</div><div class="lbl">Unpaid</div></div>
      </div>
      <div class="section-title">Paid</div>
      ${sessionPayments.map(p => `<div class="confirm-item"><div class="name">${p.memberName}</div><span class="confirmed-chip">✓ Paid</span></div>`).join('') || '<div class="empty"><p>None</p></div>'}
      <div class="section-title" style="margin-top:16px">Not Paid</div>
      ${allMembers.filter(m => !paidIds.has(m.id)).map(m => `<div class="confirm-item"><div class="name">${m.name}</div><span class="not-confirmed-chip">✗</span></div>`).join('') || '<div class="empty"><p>All paid!</p></div>'}`;
  } catch (e) { toast(e.message, 'error'); }
}

// ── INIT ───────────────────────────────────────────
checkSession();
