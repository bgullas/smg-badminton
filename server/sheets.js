const { google } = require('googleapis');
const path = require('path');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const SHEETS = {
  MEMBERS: 'members',
  SESSIONS: 'sessions',
  GAMES: 'games',
  ATTENDANCE: 'attendance',
  BOOKINGS: 'bookings',
  PAYMENTS: 'payments',
};

let sheetsClient = null;

async function getClient() {
  if (sheetsClient) return sheetsClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

async function ensureSheets() {
  const client = await getClient();
  const meta = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existing = meta.data.sheets.map(s => s.properties.title);
  const needed = Object.values(SHEETS);
  const missing = needed.filter(s => !existing.includes(s));
  if (missing.length === 0) return;
  await client.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: missing.map(title => ({
        addSheet: { properties: { title } }
      }))
    }
  });
  // Add headers
  const headerMap = {
    members: [['id', 'name', 'phone', 'type', 'category', 'createdAt']],
    sessions: [['id', 'date', 'startTime', 'endTime', 'location', 'courts', 'createdAt']],
    games: [['id', 'sessionId', 'date', 'teamAPlayer1', 'teamAPlayer2', 'teamBPlayer1', 'teamBPlayer2', 'teamAScore', 'teamBScore', 'createdAt']],
    attendance: [['id', 'sessionId', 'date', 'memberId', 'memberName', 'confirmedAt']],
    bookings: [['id', 'sessionId', 'date', 'memberId', 'memberName', 'bookedAt']],
    payments: [['id', 'sessionId', 'date', 'memberId', 'memberName', 'paidAt']],
  };
  for (const sheet of missing) {
    if (headerMap[sheet]) {
      await client.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheet}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: headerMap[sheet] }
      });
    }
  }
}

async function readSheet(sheetName) {
  const client = await getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

async function appendRow(sheetName, rowData) {
  const client = await getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1:Z1`,
  });
  const headers = (res.data.values || [[]])[0];
  const row = headers.map(h => rowData[h] !== undefined ? rowData[h] : '');
  await client.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] }
  });
}

async function updateRow(sheetName, idValue, updates) {
  const client = await getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return false;
  const headers = rows[0];
  const idIdx = headers.indexOf('id');
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[idIdx] === idValue);
  if (rowIdx === -1) return false;
  const updatedRow = headers.map((h, i) => updates[h] !== undefined ? updates[h] : (rows[rowIdx][i] || ''));
  await client.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A${rowIdx + 1}:Z${rowIdx + 1}`,
    valueInputOption: 'RAW',
    requestBody: { values: [updatedRow] }
  });
  return true;
}

async function deleteRow(sheetName, idValue) {
  const client = await getClient();
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return false;
  const headers = rows[0];
  const idIdx = headers.indexOf('id');
  const rowIdx = rows.findIndex((r, i) => i > 0 && r[idIdx] === idValue);
  if (rowIdx === -1) return false;
  // Get sheet id
  const meta = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
  await client.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIdx,
            endIndex: rowIdx + 1
          }
        }
      }]
    }
  });
  return true;
}

module.exports = { SHEETS, ensureSheets, readSheet, appendRow, updateRow, deleteRow };
