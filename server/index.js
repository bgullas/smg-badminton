require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { ensureSheets } = require('./sheets');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));

app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', routes);

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

ensureSheets().then(() => {
  app.listen(PORT, () => console.log(`SMG Badminton running on http://localhost:${PORT}`));
}).catch(err => {
  console.error('Failed to initialize sheets:', err.message);
  app.listen(PORT, () => console.log(`SMG Badminton running on http://localhost:${PORT} (sheets init failed)`));
});
