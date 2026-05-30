// ── CONFIG — replace with your Apps Script URL after deploying Code.gs ──
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzKp-WuYBJP4qUTKNSX9Mc9hycSebigwXcbqGKNt4mfRBfnPxuZSWQ2JX5wams76_oozQ/exec';

// ── STATE ────────────────────────────────────────────────────────────────
let currentUser = null, currentPage = 'home', pageStack = [];
let allMembers = [], allSessions = [], courtCount = 2;

const PAGE_TITLES = {
  home:'Home', members:'Members', schedule:'Schedule', games:'Tournament Games',
  attendance:'My Attendance', booking:'ActiveSG Booking', payments:'Payments',
  reports:'Reports', ratt:'Attendance Report', rbook:'Bookings Report',
  rresults:'Game Results', rplayers:'Player Stats', rteams:'Team History', rpayments:'Payment Report'
};

const SUB_PAGES = ['ratt','rbook','rresults','rplayers','rteams','rpayments'];

// ── APPS SCRIPT API ──────────────────────────────────────────────────────
async function sGet(action, params={}) {
  const url = new URL(SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('token', currentUser.token);
  Object.entries(params).forEach(([k,v]) => { if (v!==undefined && v!=='') url.searchParams.set(k,v); });
  const r = await fetch(url.toString()); const d = await r.json();
  if (d.error) throw new Error(d.error); return d;
}
async function sPost(action, body={}) {
  const r = await fetch(SCRIPT_URL, {method:'POST', headers:{'Content-Type':'text/plain'},
    body: JSON.stringify({action, token: currentUser.token, ...body})});
  const d = await r.json(); if (d.error) throw new Error(d.error); return d;
}

// ── TOAST ────────────────────────────────────────────────────────────────
function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'show ' + (type==='success'?'ok':type==='error'?'err':'');
  clearTimeout(el._t); el._t = setTimeout(() => el.className = '', 2800);
}

// ── SHEETS ───────────────────────────────────────────────────────────────
function openSheet(id) { document.getElementById(id).classList.remove('hidden'); }
function closeSheet(id) { document.getElementById(id).classList.add('hidden'); }
document.addEventListener('click', e => {
  if (e.target.classList.contains('overlay')) closeSheet(e.target.id);
});

// ── NAV ──────────────────────────────────────────────────────────────────
function goTo(page, push=true) {
  document.querySelectorAll('.pg').forEach(p => p.classList.add('hidden'));
  const el = document.getElementById('pg-'+page); if (el) el.classList.remove('hidden');
  document.getElementById('page-title').textContent = PAGE_TITLES[page] || page;
  const isSub = SUB_PAGES.includes(page);
  document.getElementById('back-btn').classList.toggle('hidden', !isSub);
  if (push && isSub) pageStack.push(currentPage);
  currentPage = page;
  // bottom nav highlight
  document.querySelectorAll('.ntab').forEach(t => t.classList.toggle('active', t.dataset.pg === page));
  // header plus button
  const plusPages = {members:true, schedule:true, games:true};
  document.getElementById('hdr-plus').classList.toggle('hidden', !plusPages[page]);
  loadPage(page);
}
document.getElementById('back-btn').addEventListener('click', () => goTo(pageStack.pop()||'reports', false));
document.querySelectorAll('.ntab').forEach(t => t.addEventListener('click', () => goTo(t.dataset.pg)));
function onHeaderPlus() {
  if (currentPage==='members') openSheet('sheet-member');
  else if (currentPage==='schedule') openSheet('sheet-session');
  else if (currentPage==='games') openAddGame();
}

// ── AUTH ─────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', e => {
  e.preventDefault();
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value;
  if (u==='admin' && p==='smg123456') { currentUser={role:'admin',token:p}; save(); boot(); }
  else if (u==='smg' && p==='smg12345') { currentUser={role:'member',token:p}; save(); boot(); }
  else document.getElementById('login-error').textContent = 'Invalid username or password';
});
function save() { localStorage.setItem('smg_u', JSON.stringify(currentUser)); }
document.getElementById('logout-btn') && document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('smg_u'); location.reload();
});

function boot() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  const isAdmin = currentUser.role==='admin';
  document.querySelectorAll('.admin-tab').forEach(el => el.style.display = isAdmin?'':'none');
  preload(); goTo('home', false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

(function checkSaved() {
  const s = localStorage.getItem('smg_u');
  if (s) { currentUser = JSON.parse(s); boot(); }
})();

// ── PRELOAD ───────────────────────────────────────────────────────────────
async function preload() {
  try {
    [allMembers, allSessions] = await Promise.all([sGet('getMembers'), sGet('getSessions')]);
    fillSessionSelects(); fillMemberSelects();
  } catch(e) { console.warn('Preload:', e.message); }
}
function sessionLabel(s) {
  const d = new Date(s.date+'T00:00:00');
  return d.toLocaleDateString('en-SG',{weekday:'short',day:'numeric',month:'short'})+' · '+s.startTime+'–'+s.endTime;
}
function fillSessionSelects() {
  const sorted = [...allSessions].sort((a,b)=>a.date<b.date?1:-1);
  ['att-session','book-session','pay-session','games-session-sel','ratt-session','rbook-session','rres-session','rpay-session'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const v=el.value;
    el.innerHTML='<option value="">— Select session —</option>'+sorted.map(s=>`<option value="${s.id}">${sessionLabel(s)}</option>`).join('');
    if(v) el.value=v;
  });
}
function fillMemberSelects() {
  const sorted=[...allMembers].sort((a,b)=>a.name.localeCompare(b.name));
  ['att-member','book-member','g-a1','g-a2','g-b1','g-b2','rteam-p1','rteam-p2'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const opt = id==='rteam-p2'?'<option value="">Any player</option>':'<option value="">— Select —</option>';
    el.innerHTML=opt+sorted.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
  });
}

// ── PAGE LOADER ───────────────────────────────────────────────────────────
function loadPage(p) {
  const map = {
    home:loadHome, members:loadMembers, schedule:loadSessions,
    games:()=>{}, attendance:loadAttendancePage, booking:loadBookingPage,
    payments:loadPaymentPage, ratt:loadRAttendance, rbook:loadRBookings,
    rresults:loadRResults, rplayers:loadRPlayers, reports:buildReportGrid
  };
  if(map[p]) map[p]();
}

// ── HOME ──────────────────────────────────────────────────────────────────
async function loadHome() {
  const now = new Date();
  const hr = now.getHours();
  const greet = hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
  document.getElementById('home-greeting').textContent = greet + (currentUser.role==='admin'?' Admin':'') +'! 👋';
  document.getElementById('home-role').textContent = currentUser.role==='admin'?'Administrator':'Club Member';
  document.getElementById('home-date').textContent = now.toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  // Icon grid
  const isAdmin = currentUser.role==='admin';
  const grid = [
    ...(isAdmin?[
      {icon:'👥',label:'Members',color:'#1A56DB',bg:'#EBF5FF',page:'members'},
      {icon:'📅',label:'Schedule',color:'#059669',bg:'#ECFDF5',page:'schedule'},
      {icon:'🏆',label:'Games',color:'#D97706',bg:'#FFFBEB',page:'games'},
      {icon:'💰',label:'Payments',color:'#7C3AED',bg:'#F5F3FF',page:'payments'},
    ]:[]),
    {icon:'✅',label:'Attendance',color:'#059669',bg:'#ECFDF5',page:'attendance'},
    {icon:'🔖',label:'Booking',color:'#1A56DB',bg:'#EBF5FF',page:'booking'},
    {icon:'📊',label:'Reports',color:'#DB2777',bg:'#FDF2F8',page:'reports'},
  ];
  document.getElementById('app-grid').innerHTML = grid.map(g=>`
    <button class="app-icon-btn" onclick="goTo('${g.page}')">
      <div class="icon-wrap" style="background:${g.bg};color:${g.color}">${g.icon}</div>
      <span class="icon-label">${g.label}</span>
    </button>`).join('');

  try {
    const [sessions, members, attendance] = await Promise.all([
      sGet('getSessions'), sGet('getMembers'), sGet('getAttendance')
    ]);
    allSessions=sessions; allMembers=members; fillSessionSelects(); fillMemberSelects();

    const today = now.toISOString().slice(0,10);
    const upcoming = sessions.filter(s=>s.date>=today).sort((a,b)=>a.date>b.date?1:-1);
    const nxt = upcoming[0];
    const el = document.getElementById('next-session-card');
    if (nxt) {
      const d = new Date(nxt.date+'T00:00:00');
      const attCnt = attendance.filter(a=>a.sessionId===nxt.id).length;
      el.innerHTML=`
        <div class="next-card">
          <div class="next-card-icon">📅</div>
          <div>
            <div class="next-card-title">Next Session</div>
            <div class="next-card-date">${d.toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long'})}</div>
            <div class="next-card-meta">${nxt.startTime}–${nxt.endTime} &nbsp;·&nbsp; ${nxt.location} &nbsp;·&nbsp; ${attCnt} attending</div>
          </div>
        </div>`;
    } else el.innerHTML='';

    document.getElementById('stats-row').innerHTML=`
      <div class="stat-card"><div class="stat-num">${members.length}</div><div class="stat-lbl">Members</div></div>
      <div class="stat-card"><div class="stat-num">${sessions.length}</div><div class="stat-lbl">Sessions</div></div>
      <div class="stat-card"><div class="stat-num">${upcoming.length}</div><div class="stat-lbl">Upcoming</div></div>`;
  } catch(e) { console.warn(e.message); }
}

// ── MEMBERS ───────────────────────────────────────────────────────────────
async function loadMembers() {
  try { allMembers=await sGet('getMembers'); fillMemberSelects(); renderMembers(); }
  catch(e) { toast(e.message,'error'); }
}
function renderMembers() {
  const q=document.getElementById('member-search').value.toLowerCase();
  const filtered=allMembers.filter(m=>m.name.toLowerCase().includes(q)||(m.phone||'').includes(q));
  const el=document.getElementById('members-list');
  const colors=['#1A56DB','#059669','#D97706','#7C3AED','#DB2777','#0D9488'];
  el.innerHTML=filtered.length?filtered.map((m,i)=>`
    <div class="member-card">
      <div class="avatar" style="background:${colors[i%colors.length]}">${m.name.charAt(0).toUpperCase()}</div>
      <div class="member-info">
        <div class="member-name">${m.name}</div>
        <div class="member-phone">📞 ${m.phone||'—'}</div>
        <div class="member-tags">
          <span class="tag ${m.type==='permanent'?'tag-perm':'tag-temp'}">${m.type==='permanent'?'Perm':'Temp'}</span>
          <span class="tag ${m.category==='competitive'?'tag-comp':'tag-pleasure'}">${m.category}</span>
        </div>
      </div>
      ${currentUser.role==='admin'?`<button class="del-btn" onclick="delMember('${m.id}','${m.name}')">✕</button>`:''}
    </div>`).join('')
  :`<div class="empty"><div class="empty-icon">👥</div><p>No members found</p></div>`;
}
document.getElementById('member-search').addEventListener('input', renderMembers);

async function addMember() {
  const name=document.getElementById('m-name').value.trim();
  const phone=document.getElementById('m-phone').value.trim();
  const type=document.getElementById('m-type').value;
  const category=document.getElementById('m-category').value;
  if(!name) return toast('Name is required','error');
  try {
    const m=await sPost('addMember',{name,phone,type,category});
    allMembers.push(m); renderMembers(); fillMemberSelects();
    closeSheet('sheet-member');
    document.getElementById('m-name').value=''; document.getElementById('m-phone').value='';
    toast('Member added ✓','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delMember(id,name) {
  if(!confirm(`Remove ${name}?`)) return;
  try {
    await sPost('deleteMember',{id});
    allMembers=allMembers.filter(m=>m.id!==id); renderMembers(); fillMemberSelects();
    toast('Removed','success');
  } catch(e) { toast(e.message,'error'); }
}

// ── SESSIONS ──────────────────────────────────────────────────────────────
function parseCourts(raw) { try{return JSON.parse(raw).filter(Boolean);}catch{return [raw].filter(Boolean);} }
async function loadSessions() {
  try { allSessions=await sGet('getSessions'); fillSessionSelects(); renderSessions(); }
  catch(e) { toast(e.message,'error'); }
}
function renderSessions() {
  const sorted=[...allSessions].sort((a,b)=>a.date<b.date?1:-1);
  const el=document.getElementById('sessions-list');
  el.innerHTML=sorted.length?sorted.map(s=>{
    const d=new Date(s.date+'T00:00:00');
    const courts=parseCourts(s.courts);
    return `
      <div class="session-card">
        <div class="session-hdr">
          <div>
            <div class="session-date">${d.toLocaleDateString('en-SG',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
            <div class="session-time">${s.startTime} – ${s.endTime}</div>
          </div>
        </div>
        <div class="session-body">
          <div class="session-loc">📍 ${s.location}</div>
          <div class="court-chips">${courts.map(c=>`<span class="court-chip">${c}</span>`).join('')}</div>
        </div>
        <div class="session-footer">
          <button class="btn-sm btn-sm-red" onclick="delSession('${s.id}')">Delete</button>
        </div>
      </div>`;
  }).join(''):`<div class="empty"><div class="empty-icon">📅</div><p>No sessions yet.<br>Tap + to add one.</p></div>`;
}

function addCourt() {
  if(courtCount>=5) return toast('Max 5 courts','error');
  courtCount++;
  const div=document.createElement('div'); div.className='court-row';
  div.innerHTML=`<input type="text" class="finput court-input" placeholder="e.g. Court ${courtCount}"><button class="court-del" onclick="removeCourt(this)">✕</button>`;
  document.getElementById('courts-container').appendChild(div);
  if(courtCount>=5) document.getElementById('add-court-btn').style.display='none';
}
function removeCourt(btn) { btn.parentElement.remove(); courtCount--; document.getElementById('add-court-btn').style.display=''; }

async function addSession() {
  const date=document.getElementById('s-date').value;
  const startTime=document.getElementById('s-start').value;
  const endTime=document.getElementById('s-end').value;
  const location=document.getElementById('s-location').value.trim();
  const courts=[...document.querySelectorAll('.court-input')].map(i=>i.value.trim()).filter(Boolean);
  if(!date) return toast('Date required','error');
  if(!courts.length) return toast('Add at least one court','error');
  try {
    const s=await sPost('addSession',{date,startTime,endTime,location,courts});
    allSessions.push(s); renderSessions(); fillSessionSelects();
    closeSheet('sheet-session');
    document.getElementById('s-date').value='';
    document.querySelectorAll('.court-input').forEach((inp,i)=>{ if(i>=2) inp.parentElement.remove(); else inp.value=''; });
    courtCount=2;
    toast('Session created ✓','success');
  } catch(e) { toast(e.message,'error'); }
}
async function delSession(id) {
  if(!confirm('Delete this session?')) return;
  try {
    await sPost('deleteSession',{id});
    allSessions=allSessions.filter(s=>s.id!==id); renderSessions(); fillSessionSelects();
    toast('Deleted','success');
  } catch(e) { toast(e.message,'error'); }
}

// ── GAMES ─────────────────────────────────────────────────────────────────
async function loadGames() {
  const sessionId=document.getElementById('games-session-sel').value;
  const el=document.getElementById('games-list');
  if(!sessionId){ el.innerHTML=`<div class="empty"><div class="empty-icon">🏆</div><p>Select a session above</p></div>`; return; }
  try { renderGames(await sGet('getGames',{sessionId})); }
  catch(e) { toast(e.message,'error'); }
}
function renderGames(games) {
  const el=document.getElementById('games-list');
  el.innerHTML=games.length?games.map((g,i)=>{
    const hasScore=g.teamAScore!==''&&g.teamBScore!=='';
    const aWon=hasScore&&parseInt(g.teamAScore)>parseInt(g.teamBScore);
    return `
      <div class="game-card">
        <div class="game-hdr"><span>Game ${i+1}</span>
          <span style="color:${hasScore?'var(--green)':'var(--orange)'};">${hasScore?'✓ Scored':'⏳ Pending'}</span>
        </div>
        <div class="game-body">
          <div class="matchup">
            <div class="team team-a"><div class="team-tag">Team A</div><div class="team-players">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div></div>
            <div class="vs">VS</div>
            <div class="team team-b"><div class="team-tag">Team B</div><div class="team-players">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div></div>
          </div>
          ${hasScore?`<div class="score-box"><div class="score-nums">${g.teamAScore} – ${g.teamBScore}</div><div class="score-winner">${aWon?'🏆 Team A wins':'🏆 Team B wins'}</div></div>`:''}
        </div>
        <div class="game-footer">
          <button class="btn-sm btn-sm-blue" onclick="openScore('${g.id}','${g.teamAPlayer1} & ${g.teamAPlayer2}','${g.teamBPlayer1} & ${g.teamBPlayer2}','${g.teamAScore}','${g.teamBScore}')">
            ${hasScore?'✏️ Edit Score':'📝 Enter Score'}
          </button>
          <button class="btn-sm btn-sm-red" onclick="delGame('${g.id}')">✕</button>
        </div>
      </div>`;
  }).join(''):`<div class="empty"><div class="empty-icon">🏸</div><p>No games yet</p></div>`;
}
function openAddGame() { fillMemberSelects(); openSheet('sheet-game'); }
async function addGame() {
  const sessionId=document.getElementById('games-session-sel').value;
  const session=allSessions.find(s=>s.id===sessionId);
  const n=id=>(allMembers.find(m=>m.id===id)||{}).name||id;
  const a1=document.getElementById('g-a1').value, a2=document.getElementById('g-a2').value;
  const b1=document.getElementById('g-b1').value, b2=document.getElementById('g-b2').value;
  if(!a1||!a2||!b1||!b2) return toast('Select all 4 players','error');
  if(new Set([a1,a2,b1,b2]).size<4) return toast('Players must be different','error');
  try {
    await sPost('addGame',{sessionId,date:session?.date||'',teamAPlayer1:n(a1),teamAPlayer2:n(a2),teamBPlayer1:n(b1),teamBPlayer2:n(b2)});
    closeSheet('sheet-game'); toast('Game added ✓','success'); loadGames();
  } catch(e) { toast(e.message,'error'); }
}
function openScore(id,ta,tb,sa,sb) {
  document.getElementById('score-game-id').value=id;
  document.getElementById('score-name-a').textContent=ta;
  document.getElementById('score-name-b').textContent=tb;
  document.getElementById('score-a').value=sa||'';
  document.getElementById('score-b').value=sb||'';
  openSheet('sheet-score');
}
async function submitScore() {
  const id=document.getElementById('score-game-id').value;
  const teamAScore=document.getElementById('score-a').value;
  const teamBScore=document.getElementById('score-b').value;
  if(teamAScore===''||teamBScore==='') return toast('Enter both scores','error');
  try { await sPost('updateScore',{id,teamAScore,teamBScore}); closeSheet('sheet-score'); toast('Score saved ✓','success'); loadGames(); }
  catch(e) { toast(e.message,'error'); }
}
async function delGame(id) {
  if(!confirm('Delete this game?')) return;
  try { await sPost('deleteGame',{id}); toast('Deleted','success'); loadGames(); }
  catch(e) { toast(e.message,'error'); }
}

// ── ATTENDANCE ────────────────────────────────────────────────────────────
async function onAttSessionChange() { loadAttendancePage(); }
async function loadAttendancePage() {
  const sessionId=document.getElementById('att-session').value;
  const el=document.getElementById('att-list');
  const lbl=document.getElementById('att-label');
  if(!sessionId) { el.innerHTML=''; lbl.classList.add('hidden'); return; }
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const list=(await sGet('getAttendance',{date:session?.date||''})).filter(a=>a.sessionId===sessionId);
    lbl.classList.toggle('hidden', !list.length);
    el.innerHTML=list.length?list.map(a=>`
      <div class="confirm-item">
        <div><div class="ci-name">${a.memberName}</div><div class="ci-time">${fmtTime(a.confirmedAt)}</div></div>
        <span class="chip-yes">✓ Going</span>
      </div>`).join(''):'';
  } catch(e) { console.warn(e); }
}
async function submitAttendance() {
  const sessionId=document.getElementById('att-session').value;
  const memberId=document.getElementById('att-member').value;
  const session=allSessions.find(s=>s.id===sessionId);
  const member=allMembers.find(m=>m.id===memberId);
  if(!sessionId) return toast('Select a session','error');
  if(!memberId) return toast('Select your name','error');
  try {
    await sPost('addAttendance',{sessionId,date:session?.date||'',memberId,memberName:member?.name||''});
    toast('Attendance confirmed ✓','success'); loadAttendancePage();
  } catch(e) { toast(e.message,'error'); }
}

// ── BOOKING ───────────────────────────────────────────────────────────────
async function onBookSessionChange() { loadBookingPage(); }
async function loadBookingPage() {
  const sessionId=document.getElementById('book-session').value;
  const el=document.getElementById('book-list');
  const lbl=document.getElementById('book-label');
  if(!sessionId) { el.innerHTML=''; lbl.classList.add('hidden'); return; }
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const list=(await sGet('getBookings',{date:session?.date||''})).filter(b=>b.sessionId===sessionId);
    lbl.classList.toggle('hidden', !list.length);
    el.innerHTML=list.length?list.map(b=>`
      <div class="confirm-item">
        <div><div class="ci-name">${b.memberName}</div><div class="ci-time">${fmtTime(b.bookedAt)}</div></div>
        <span class="chip-book">🔖 Booked</span>
      </div>`).join(''):'';
  } catch(e) { console.warn(e); }
}
async function submitBooking() {
  const sessionId=document.getElementById('book-session').value;
  const memberId=document.getElementById('book-member').value;
  const session=allSessions.find(s=>s.id===sessionId);
  const member=allMembers.find(m=>m.id===memberId);
  if(!sessionId) return toast('Select a session','error');
  if(!memberId) return toast('Select your name','error');
  try {
    await sPost('addBooking',{sessionId,date:session?.date||'',memberId,memberName:member?.name||''});
    toast('Booking confirmed ✓','success'); loadBookingPage();
  } catch(e) { toast(e.message,'error'); }
}

// ── PAYMENTS ──────────────────────────────────────────────────────────────
async function loadPaymentPage() {
  const sessionId=document.getElementById('pay-session').value;
  const el=document.getElementById('pay-list');
  if(!sessionId) { el.innerHTML=''; return; }
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const payments=(await sGet('getPayments',{date:session?.date||''})).filter(p=>p.sessionId===sessionId);
    const paidIds=new Set(payments.map(p=>p.memberId));
    el.innerHTML=`<div class="section-label" style="margin-bottom:10px">Payment Status</div>`+
      allMembers.map(m=>{
        const paid=paidIds.has(m.id);
        const rec=payments.find(p=>p.memberId===m.id);
        return `<div class="pay-row">
          <div><div class="pay-name">${m.name}</div>${paid?`<div style="font-size:12px;color:var(--muted)">${fmtDateTime(rec.paidAt)}</div>`:''}</div>
          ${paid?`<span class="chip-yes">✓ Paid</span>`:`<button class="btn-sm btn-sm-green" onclick="markPaid('${sessionId}','${session?.date||''}','${m.id}','${m.name}')">Mark Paid</button>`}
        </div>`;
      }).join('');
  } catch(e) { toast(e.message,'error'); }
}
async function markPaid(sessionId,date,memberId,memberName) {
  try { await sPost('addPayment',{sessionId,date,memberId,memberName}); toast(`${memberName} marked paid ✓`,'success'); loadPaymentPage(); }
  catch(e) { toast(e.message,'error'); }
}

// ── REPORT GRID ───────────────────────────────────────────────────────────
function buildReportGrid() {
  const isAdmin = currentUser.role==='admin';
  const cards = [
    {icon:'👥',name:'Attendance',desc:'Who registered per session',page:'ratt'},
    {icon:'🔖',name:'Bookings',desc:'ActiveSG booking status',page:'rbook'},
    {icon:'🎯',name:'Game Results',desc:'Scores by session',page:'rresults'},
    {icon:'📈',name:'Player Stats',desc:'Win/loss per player',page:'rplayers'},
    {icon:'🤝',name:'Team History',desc:'Pair performance',page:'rteams'},
    ...(isAdmin?[{icon:'💰',name:'Payments',desc:'Paid vs unpaid',page:'rpayments'}]:[]),
  ];
  document.getElementById('report-grid').innerHTML=cards.map(c=>`
    <div class="report-card" onclick="goTo('${c.page}')">
      <div class="report-icon">${c.icon}</div>
      <div class="report-name">${c.name}</div>
      <div class="report-desc">${c.desc}</div>
    </div>`).join('');
}

// ── REPORT: ATTENDANCE ────────────────────────────────────────────────────
async function loadRAttendance() {
  const sessionId=document.getElementById('ratt-session').value;
  const el=document.getElementById('ratt-content');
  if(!sessionId){el.innerHTML='';return;}
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const attended=(await sGet('getAttendance',{date:session?.date||''})).filter(a=>a.sessionId===sessionId);
    const ids=new Set(attended.map(a=>a.memberId));
    el.innerHTML=`
      <div class="stats-summary">
        <div class="ss-card"><div class="ss-num">${attended.length}</div><div class="ss-lbl">Confirmed</div></div>
        <div class="ss-card"><div class="ss-num" style="color:var(--red)">${allMembers.length-attended.length}</div><div class="ss-lbl">Not confirmed</div></div>
      </div>
      <div class="section-label">Confirmed</div>
      ${attended.map(a=>`<div class="confirm-item"><div class="ci-name">${a.memberName}</div><span class="chip-yes">✓</span></div>`).join('')||'<div class="empty"><p>None yet</p></div>'}
      <div class="section-label" style="margin-top:16px">Not Confirmed</div>
      ${allMembers.filter(m=>!ids.has(m.id)).map(m=>`<div class="confirm-item"><div class="ci-name">${m.name}</div><span class="chip-no">✗</span></div>`).join('')||'<div class="empty"><p>All confirmed! 🎉</p></div>'}`;
  } catch(e) { toast(e.message,'error'); }
}

// ── REPORT: BOOKINGS ──────────────────────────────────────────────────────
async function loadRBookings() {
  const sessionId=document.getElementById('rbook-session').value;
  const el=document.getElementById('rbook-content');
  if(!sessionId){el.innerHTML='';return;}
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const booked=(await sGet('getBookings',{date:session?.date||''})).filter(b=>b.sessionId===sessionId);
    const ids=new Set(booked.map(b=>b.memberId));
    el.innerHTML=`
      <div class="stats-summary">
        <div class="ss-card"><div class="ss-num">${booked.length}</div><div class="ss-lbl">Booked</div></div>
        <div class="ss-card"><div class="ss-num" style="color:var(--red)">${allMembers.length-booked.length}</div><div class="ss-lbl">Not booked</div></div>
      </div>
      <div class="section-label">Booked at ActiveSG</div>
      ${booked.map(b=>`<div class="confirm-item"><div class="ci-name">${b.memberName}</div><span class="chip-book">🔖</span></div>`).join('')||'<div class="empty"><p>None yet</p></div>'}
      <div class="section-label" style="margin-top:16px">Not Yet Booked</div>
      ${allMembers.filter(m=>!ids.has(m.id)).map(m=>`<div class="confirm-item"><div class="ci-name">${m.name}</div><span class="chip-no">✗</span></div>`).join('')||'<div class="empty"><p>All booked! 🎉</p></div>'}`;
  } catch(e) { toast(e.message,'error'); }
}

// ── REPORT: RESULTS ───────────────────────────────────────────────────────
async function loadRResults() {
  const sessionId=document.getElementById('rres-session').value;
  const el=document.getElementById('rres-content');
  if(!sessionId){el.innerHTML='';return;}
  try {
    const games=await sGet('getGames',{sessionId});
    el.innerHTML=games.length?games.map((g,i)=>{
      const has=g.teamAScore!==''&&g.teamBScore!=='';
      const aW=has&&parseInt(g.teamAScore)>parseInt(g.teamBScore);
      return `<div class="result-row">
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px;font-weight:600">Game ${i+1}</div>
        <div class="result-teams">
          <div style="${has&&aW?'color:var(--green);font-weight:700':''}">${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
          <div class="result-score">${has?`<div class="result-nums">${g.teamAScore}–${g.teamBScore}</div><div class="result-winner">${aW?'🏆 A wins':'🏆 B wins'}</div>`:'<span style="color:var(--muted);font-size:13px">Pending</span>'}</div>
          <div style="text-align:right;${has&&!aW?'color:var(--green);font-weight:700':''}">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
        </div>
      </div>`;
    }).join(''):`<div class="empty"><div class="empty-icon">🎯</div><p>No games recorded</p></div>`;
  } catch(e) { toast(e.message,'error'); }
}

// ── REPORT: PLAYER STATS ──────────────────────────────────────────────────
async function loadRPlayers() {
  const el=document.getElementById('rplayer-content');
  el.innerHTML=`<div class="empty"><div class="empty-icon">⏳</div><p>Loading…</p></div>`;
  try {
    const stats=await sGet('getPlayerStats');
    const rankCls=i=>['gold','silver','bronze'][i]||'';
    el.innerHTML=stats.length?stats.map((p,i)=>{
      const rate=p.played?Math.round(p.wins/p.played*100):0;
      return `<div class="player-card">
        <div class="pc-top">
          <div class="pc-rank ${rankCls(i)}">${i+1}</div>
          <div><div class="pc-name">${p.name}</div><div class="pc-sub">${rate}% win rate · ${p.pointsFor} pts scored</div></div>
        </div>
        <div class="pc-bars">
          <div class="pc-bar"><div class="pc-num blue-num">${p.played}</div><div class="pc-lbl">Played</div></div>
          <div class="pc-bar"><div class="pc-num green-num">${p.wins}</div><div class="pc-lbl">Wins</div></div>
          <div class="pc-bar"><div class="pc-num red-num">${p.losses}</div><div class="pc-lbl">Losses</div></div>
          <div class="pc-bar"><div class="pc-num" style="color:var(--muted)">${p.pointsFor}–${p.pointsAgainst}</div><div class="pc-lbl">PF–PA</div></div>
        </div>
        <div class="win-bar"><div class="win-fill" style="width:${rate}%"></div></div>
      </div>`;
    }).join(''):`<div class="empty"><div class="empty-icon">📈</div><p>No game data yet</p></div>`;
  } catch(e) { toast(e.message,'error'); }
}

// ── REPORT: TEAM HISTORY ──────────────────────────────────────────────────
async function loadRTeams() {
  const p1Id=document.getElementById('rteam-p1').value;
  const p2Id=document.getElementById('rteam-p2').value;
  const p1=(allMembers.find(m=>m.id===p1Id)||{}).name;
  const p2=(allMembers.find(m=>m.id===p2Id)||{}).name;
  if(!p1) return toast('Select Player 1','error');
  const el=document.getElementById('rteam-content');
  el.innerHTML=`<div class="empty"><div class="empty-icon">⏳</div><p>Searching…</p></div>`;
  try {
    const games=await sGet('getTeamHistory',{p1,p2:p2||''});
    el.innerHTML=games.length?`<div class="section-label" style="margin-bottom:10px">${games.length} game(s) found</div>`+
      games.map(g=>{
        const has=g.teamAScore!==''&&g.teamBScore!=='';
        const aW=has&&parseInt(g.teamAScore)>parseInt(g.teamBScore);
        return `<div class="result-row">
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${g.date}</div>
          <div class="result-teams">
            <div>${g.teamAPlayer1}<br>${g.teamAPlayer2}</div>
            <div class="result-score">${has?`<div class="result-nums">${g.teamAScore}–${g.teamBScore}</div><div class="result-winner">${aW?'A wins':'B wins'}</div>`:'Pending'}</div>
            <div style="text-align:right">${g.teamBPlayer1}<br>${g.teamBPlayer2}</div>
          </div>
        </div>`;
      }).join(''):`<div class="empty"><div class="empty-icon">🤝</div><p>No games found</p></div>`;
  } catch(e) { toast(e.message,'error'); }
}

// ── REPORT: PAYMENTS ──────────────────────────────────────────────────────
async function loadRPayments() {
  const sessionId=document.getElementById('rpay-session').value;
  const el=document.getElementById('rpay-content');
  if(!sessionId){el.innerHTML='';return;}
  const session=allSessions.find(s=>s.id===sessionId);
  try {
    const payments=(await sGet('getPayments',{date:session?.date||''})).filter(p=>p.sessionId===sessionId);
    const ids=new Set(payments.map(p=>p.memberId));
    el.innerHTML=`
      <div class="stats-summary">
        <div class="ss-card"><div class="ss-num">${payments.length}</div><div class="ss-lbl">Paid</div></div>
        <div class="ss-card"><div class="ss-num" style="color:var(--red)">${allMembers.length-payments.length}</div><div class="ss-lbl">Unpaid</div></div>
      </div>
      <div class="section-label">Paid</div>
      ${payments.map(p=>`<div class="confirm-item"><div class="ci-name">${p.memberName}</div><span class="chip-yes">✓ Paid</span></div>`).join('')||'<div class="empty"><p>None yet</p></div>'}
      <div class="section-label" style="margin-top:16px">Not Paid</div>
      ${allMembers.filter(m=>!ids.has(m.id)).map(m=>`<div class="confirm-item"><div class="ci-name">${m.name}</div><span class="chip-no">✗</span></div>`).join('')||'<div class="empty"><p>All paid! 🎉</p></div>'}`;
  } catch(e) { toast(e.message,'error'); }
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function fmtTime(iso) { try{return new Date(iso).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit'});}catch{return '';} }
function fmtDateTime(iso) { try{return new Date(iso).toLocaleString('en-SG',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';} }

// Fix the greeting template literal issue
(function fixGreeting(){
  const now=new Date(), hr=now.getHours();
  const el=document.getElementById('home-greeting');
  if(el){
    const word=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
    const role=currentUser&&currentUser.role==='admin'?' Admin':'';
    el.textContent=word+role+' 👋';
  }
})();
