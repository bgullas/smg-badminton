// ═══════════════════════════════════════════════════════════════
//  SMG BADMINTON CLUB — Google Apps Script Backend
//  Paste this entire file into your Google Apps Script editor.
//  Deploy as Web App: Execute as "Me", Access "Anyone"
// ═══════════════════════════════════════════════════════════════

var SS_ID        = '1nNqgJPfujjxgK6xBkL49ToaplUWC4RmVPYxN3OegdjA';
var ADMIN_PASS   = 'smg123456';
var MEMBER_PASS  = 'smg12345';

// ── AUTH ────────────────────────────────────────────────────────
function getRole(token) {
  if (token === ADMIN_PASS) return 'admin';
  if (token === MEMBER_PASS) return 'member';
  return null;
}

// ── ENTRY POINTS ────────────────────────────────────────────────
function doGet(e) {
  var p    = e.parameter;
  var role = getRole(p.token);
  if (!role) return jsonOut({ error: 'Unauthorized' });

  try {
    var action = p.action;
    var result;

    if (action === 'getMembers') {
      result = getSheetData('members');

    } else if (action === 'getSessions') {
      result = getSheetData('sessions');

    } else if (action === 'getGames') {
      result = getSheetData('games').filter(function(g) {
        if (p.sessionId && g.sessionId !== p.sessionId) return false;
        if (p.date && g.date !== p.date) return false;
        return true;
      });

    } else if (action === 'getAttendance') {
      result = getSheetData('attendance').filter(function(a) {
        return !p.date || a.date === p.date;
      });

    } else if (action === 'getBookings') {
      result = getSheetData('bookings').filter(function(b) {
        return !p.date || b.date === p.date;
      });

    } else if (action === 'getPayments') {
      result = getSheetData('payments').filter(function(r) {
        return !p.date || r.date === p.date;
      });

    } else if (action === 'getPlayerStats') {
      result = calcPlayerStats();

    } else if (action === 'getTeamHistory') {
      result = getTeamHistory(p.p1, p.p2);

    } else {
      result = { error: 'Unknown action: ' + action };
    }

    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var role = getRole(data.token);
  if (!role) return jsonOut({ error: 'Unauthorized' });

  try {
    var a = data.action;

    // ── MEMBERS ──────────────────────────────────
    if (a === 'addMember') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      var row = {
        id: Utilities.getUuid(), name: data.name, phone: data.phone || '',
        type: data.type, category: data.category, createdAt: new Date().toISOString()
      };
      addRow('members', row);
      return jsonOut(row);
    }

    if (a === 'updateMember') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(updateRow('members', data.id, {
        name: data.name, phone: data.phone, type: data.type, category: data.category
      }));
    }

    if (a === 'deleteMember') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(deleteRow('members', data.id));
    }

    // ── SESSIONS ─────────────────────────────────
    if (a === 'addSession') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      var row = {
        id: Utilities.getUuid(), date: data.date, startTime: data.startTime,
        endTime: data.endTime, location: data.location || 'Yio Chu Kang Sports Hall',
        courts: JSON.stringify(data.courts), createdAt: new Date().toISOString()
      };
      addRow('sessions', row);
      return jsonOut(row);
    }

    if (a === 'deleteSession') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(deleteRow('sessions', data.id));
    }

    // ── GAMES ────────────────────────────────────
    if (a === 'addGame') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      var row = {
        id: Utilities.getUuid(), sessionId: data.sessionId, date: data.date,
        teamAPlayer1: data.teamAPlayer1, teamAPlayer2: data.teamAPlayer2,
        teamBPlayer1: data.teamBPlayer1, teamBPlayer2: data.teamBPlayer2,
        teamAScore: '', teamBScore: '', createdAt: new Date().toISOString()
      };
      addRow('games', row);
      return jsonOut(row);
    }

    if (a === 'updateScore') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(updateRow('games', data.id, {
        teamAScore: data.teamAScore, teamBScore: data.teamBScore
      }));
    }

    if (a === 'deleteGame') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(deleteRow('games', data.id));
    }

    // ── ATTENDANCE ───────────────────────────────
    if (a === 'addAttendance') {
      var existing = getSheetData('attendance').filter(function(r) {
        return r.sessionId === data.sessionId && r.memberId === data.memberId;
      });
      if (existing.length) return jsonOut({ error: 'Already confirmed' });
      var row = {
        id: Utilities.getUuid(), sessionId: data.sessionId, date: data.date,
        memberId: data.memberId, memberName: data.memberName, confirmedAt: new Date().toISOString()
      };
      addRow('attendance', row);
      return jsonOut(row);
    }

    if (a === 'deleteAttendance') {
      return jsonOut(deleteRow('attendance', data.id));
    }

    // ── BOOKINGS ─────────────────────────────────
    if (a === 'addBooking') {
      var existing = getSheetData('bookings').filter(function(r) {
        return r.sessionId === data.sessionId && r.memberId === data.memberId;
      });
      if (existing.length) return jsonOut({ error: 'Already booked' });
      var row = {
        id: Utilities.getUuid(), sessionId: data.sessionId, date: data.date,
        memberId: data.memberId, memberName: data.memberName, bookedAt: new Date().toISOString()
      };
      addRow('bookings', row);
      return jsonOut(row);
    }

    if (a === 'deleteBooking') {
      return jsonOut(deleteRow('bookings', data.id));
    }

    // ── PAYMENTS ─────────────────────────────────
    if (a === 'addPayment') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      var existing = getSheetData('payments').filter(function(r) {
        return r.sessionId === data.sessionId && r.memberId === data.memberId;
      });
      if (existing.length) return jsonOut({ error: 'Already marked paid' });
      var row = {
        id: Utilities.getUuid(), sessionId: data.sessionId, date: data.date,
        memberId: data.memberId, memberName: data.memberName, paidAt: new Date().toISOString()
      };
      addRow('payments', row);
      return jsonOut(row);
    }

    if (a === 'deletePayment') {
      if (role !== 'admin') return jsonOut({ error: 'Admin only' });
      return jsonOut(deleteRow('payments', data.id));
    }

    return jsonOut({ error: 'Unknown action: ' + a });

  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

// ── SHEET HELPERS ────────────────────────────────────────────────
var HEADERS = {
  members:    ['id','name','phone','type','category','createdAt'],
  sessions:   ['id','date','startTime','endTime','location','courts','createdAt'],
  games:      ['id','sessionId','date','teamAPlayer1','teamAPlayer2','teamBPlayer1','teamBPlayer2','teamAScore','teamBScore','createdAt'],
  attendance: ['id','sessionId','date','memberId','memberName','confirmedAt'],
  bookings:   ['id','sessionId','date','memberId','memberName','bookedAt'],
  payments:   ['id','sessionId','date','memberId','memberName','paidAt']
};

function getSheet(name) {
  var ss    = SpreadsheetApp.openById(SS_ID);
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (HEADERS[name]) sheet.appendRow(HEADERS[name]);
  }
  return sheet;
}

function getSheetData(name) {
  var sheet = getSheet(name);
  var last  = sheet.getLastRow();
  if (last < 2) return [];
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var tz      = Session.getScriptTimeZone();
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var val = row[i];
      if (val instanceof Date) {
        if (h === 'date') {
          obj[h] = Utilities.formatDate(val, tz, 'yyyy-MM-dd');
        } else if (h === 'startTime' || h === 'endTime') {
          obj[h] = Utilities.formatDate(val, tz, 'HH:mm');
        } else {
          obj[h] = val.toISOString();
        }
      } else {
        obj[h] = (val !== undefined && val !== null) ? String(val) : '';
      }
    });
    return obj;
  });
}

// ── UTILITY: clear session data, keep members ────────────────────────────────
function clearSessionData() {
  ['sessions','games','attendance','bookings','payments'].forEach(function(name) {
    var sheet = getSheet(name);
    var last  = sheet.getLastRow();
    if (last > 1) sheet.deleteRows(2, last - 1);
  });
  Logger.log('Cleared sessions, games, attendance, bookings, payments. Members kept.');
}

function addRow(sheetName, rowData) {
  var sheet   = getSheet(sheetName);
  var headers = HEADERS[sheetName];
  var row     = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ''; });
  sheet.appendRow(row);
}

function updateRow(sheetName, id, updates) {
  var sheet   = getSheet(sheetName);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var idCol   = headers.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      headers.forEach(function(h, j) {
        if (updates[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(updates[h]);
      });
      return { ok: true };
    }
  }
  return { error: 'Row not found' };
}

function deleteRow(sheetName, id) {
  var sheet = getSheet(sheetName);
  var data  = sheet.getDataRange().getValues();
  var idCol = data[0].indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === id) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Row not found' };
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── REPORTS ──────────────────────────────────────────────────────
function calcPlayerStats() {
  var games = getSheetData('games');
  var stats = {};
  games.forEach(function(g) {
    if (!g.teamAScore || !g.teamBScore) return;
    var aScore = parseInt(g.teamAScore);
    var bScore = parseInt(g.teamBScore);
    var aWin   = aScore > bScore;
    [[g.teamAPlayer1, g.teamAPlayer2], [g.teamBPlayer1, g.teamBPlayer2]].forEach(function(team, ti) {
      var win      = ti === 0 ? aWin : !aWin;
      var scored   = ti === 0 ? aScore : bScore;
      var conceded = ti === 0 ? bScore : aScore;
      team.forEach(function(p) {
        if (!p) return;
        if (!stats[p]) stats[p] = { name: p, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
        stats[p].played++;
        if (win) stats[p].wins++; else stats[p].losses++;
        stats[p].pointsFor    += scored;
        stats[p].pointsAgainst += conceded;
      });
    });
  });
  return Object.values(stats).sort(function(a, b) { return b.wins - a.wins; });
}

function getTeamHistory(p1, p2) {
  var games = getSheetData('games');
  return games.filter(function(g) {
    var teamA = [g.teamAPlayer1, g.teamAPlayer2];
    var teamB = [g.teamBPlayer1, g.teamBPlayer2];
    if (p1 && p2) {
      return (teamA.indexOf(p1) > -1 && teamA.indexOf(p2) > -1) ||
             (teamB.indexOf(p1) > -1 && teamB.indexOf(p2) > -1);
    }
    if (p1) return teamA.indexOf(p1) > -1 || teamB.indexOf(p1) > -1;
    return true;
  });
}
