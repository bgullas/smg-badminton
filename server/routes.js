const express = require('express');
const router = express.Router();
const { readSheet, appendRow, updateRow, deleteRow, SHEETS } = require('./sheets');
const { v4: uuidv4 } = require('uuid');

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).json({ error: 'Admin only' });
}

// --- AUTH ---
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'smg123456') {
    req.session.user = { username: 'admin', role: 'admin' };
    return res.json({ role: 'admin' });
  }
  if (username === 'smg' && password === 'smg12345') {
    req.session.user = { username: 'smg', role: 'member' };
    return res.json({ role: 'member' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

router.post('/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

router.get('/auth/me', (req, res) => {
  if (req.session && req.session.user) return res.json(req.session.user);
  res.status(401).json({ error: 'Not logged in' });
});

// --- MEMBERS ---
router.get('/members', requireAuth, async (req, res) => {
  try {
    const members = await readSheet(SHEETS.MEMBERS);
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/members', requireAdmin, async (req, res) => {
  try {
    const { name, phone, type, category } = req.body;
    const row = { id: uuidv4(), name, phone, type, category, createdAt: new Date().toISOString() };
    await appendRow(SHEETS.MEMBERS, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/members/:id', requireAdmin, async (req, res) => {
  try {
    await updateRow(SHEETS.MEMBERS, req.params.id, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/members/:id', requireAdmin, async (req, res) => {
  try {
    await deleteRow(SHEETS.MEMBERS, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- SESSIONS ---
router.get('/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await readSheet(SHEETS.SESSIONS);
    res.json(sessions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sessions', requireAdmin, async (req, res) => {
  try {
    const { date, startTime, endTime, location, courts } = req.body;
    const row = {
      id: uuidv4(), date, startTime, endTime,
      location: location || 'Yio Chu Kang',
      courts: JSON.stringify(courts),
      createdAt: new Date().toISOString()
    };
    await appendRow(SHEETS.SESSIONS, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/sessions/:id', requireAdmin, async (req, res) => {
  try {
    await deleteRow(SHEETS.SESSIONS, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- GAMES ---
router.get('/games', requireAuth, async (req, res) => {
  try {
    const games = await readSheet(SHEETS.GAMES);
    const { date, sessionId } = req.query;
    let filtered = games;
    if (date) filtered = filtered.filter(g => g.date === date);
    if (sessionId) filtered = filtered.filter(g => g.sessionId === sessionId);
    res.json(filtered);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/games', requireAdmin, async (req, res) => {
  try {
    const { sessionId, date, teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2 } = req.body;
    const row = {
      id: uuidv4(), sessionId, date,
      teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2,
      teamAScore: '', teamBScore: '',
      createdAt: new Date().toISOString()
    };
    await appendRow(SHEETS.GAMES, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/games/:id/score', requireAdmin, async (req, res) => {
  try {
    const { teamAScore, teamBScore } = req.body;
    await updateRow(SHEETS.GAMES, req.params.id, { teamAScore, teamBScore });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/games/:id', requireAdmin, async (req, res) => {
  try {
    await deleteRow(SHEETS.GAMES, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- ATTENDANCE ---
router.get('/attendance', requireAuth, async (req, res) => {
  try {
    const rows = await readSheet(SHEETS.ATTENDANCE);
    const { date } = req.query;
    res.json(date ? rows.filter(r => r.date === date) : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/attendance', requireAuth, async (req, res) => {
  try {
    const { sessionId, date, memberId, memberName } = req.body;
    const existing = await readSheet(SHEETS.ATTENDANCE);
    if (existing.find(r => r.sessionId === sessionId && r.memberId === memberId)) {
      return res.status(409).json({ error: 'Already confirmed' });
    }
    const row = { id: uuidv4(), sessionId, date, memberId, memberName, confirmedAt: new Date().toISOString() };
    await appendRow(SHEETS.ATTENDANCE, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/attendance/:id', requireAuth, async (req, res) => {
  try {
    await deleteRow(SHEETS.ATTENDANCE, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- BOOKINGS ---
router.get('/bookings', requireAuth, async (req, res) => {
  try {
    const rows = await readSheet(SHEETS.BOOKINGS);
    const { date } = req.query;
    res.json(date ? rows.filter(r => r.date === date) : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/bookings', requireAuth, async (req, res) => {
  try {
    const { sessionId, date, memberId, memberName } = req.body;
    const existing = await readSheet(SHEETS.BOOKINGS);
    if (existing.find(r => r.sessionId === sessionId && r.memberId === memberId)) {
      return res.status(409).json({ error: 'Already booked' });
    }
    const row = { id: uuidv4(), sessionId, date, memberId, memberName, bookedAt: new Date().toISOString() };
    await appendRow(SHEETS.BOOKINGS, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/bookings/:id', requireAuth, async (req, res) => {
  try {
    await deleteRow(SHEETS.BOOKINGS, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PAYMENTS ---
router.get('/payments', requireAuth, async (req, res) => {
  try {
    const rows = await readSheet(SHEETS.PAYMENTS);
    const { date } = req.query;
    res.json(date ? rows.filter(r => r.date === date) : rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payments', requireAdmin, async (req, res) => {
  try {
    const { sessionId, date, memberId, memberName } = req.body;
    const existing = await readSheet(SHEETS.PAYMENTS);
    if (existing.find(r => r.sessionId === sessionId && r.memberId === memberId)) {
      return res.status(409).json({ error: 'Already marked paid' });
    }
    const row = { id: uuidv4(), sessionId, date, memberId, memberName, paidAt: new Date().toISOString() };
    await appendRow(SHEETS.PAYMENTS, row);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/payments/:id', requireAdmin, async (req, res) => {
  try {
    await deleteRow(SHEETS.PAYMENTS, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- REPORTS ---
router.get('/reports/player-stats', requireAuth, async (req, res) => {
  try {
    const games = await readSheet(SHEETS.GAMES);
    const stats = {};
    games.forEach(g => {
      if (!g.teamAScore || !g.teamBScore) return;
      const aScore = parseInt(g.teamAScore);
      const bScore = parseInt(g.teamBScore);
      const aWin = aScore > bScore;
      [[g.teamAPlayer1, g.teamAPlayer2], [g.teamBPlayer1, g.teamBPlayer2]].forEach((team, ti) => {
        const win = ti === 0 ? aWin : !aWin;
        const scored = ti === 0 ? aScore : bScore;
        const conceded = ti === 0 ? bScore : aScore;
        team.forEach(p => {
          if (!p) return;
          if (!stats[p]) stats[p] = { name: p, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
          stats[p].played++;
          if (win) stats[p].wins++; else stats[p].losses++;
          stats[p].pointsFor += scored;
          stats[p].pointsAgainst += conceded;
        });
      });
    });
    res.json(Object.values(stats).sort((a, b) => b.wins - a.wins));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/reports/team-history', requireAuth, async (req, res) => {
  try {
    const { p1, p2 } = req.query;
    const games = await readSheet(SHEETS.GAMES);
    const result = games.filter(g => {
      const teamA = [g.teamAPlayer1, g.teamAPlayer2];
      const teamB = [g.teamBPlayer1, g.teamBPlayer2];
      if (p1 && p2) {
        return (teamA.includes(p1) && teamA.includes(p2)) || (teamB.includes(p1) && teamB.includes(p2));
      }
      if (p1) return teamA.includes(p1) || teamB.includes(p1);
      return true;
    });
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
