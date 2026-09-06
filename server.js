const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- DATABASE SETUP ----
// The .db file lives on disk next to this script. On most free hosts this
// resets when the server restarts unless you attach a persistent volume
// (see DEPLOY.md). For a shop that needs data to NEVER disappear, attaching
// a persistent disk (Railway/Render volume) is required.
const db = new Database(path.join(__dirname, 'sumico.db'));

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id TEXT, username TEXT, password TEXT
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice TEXT, customer TEXT, item TEXT, amount REAL, payment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payee TEXT, category TEXT, amount REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, mobile TEXT, address TEXT
);
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barcode TEXT, name TEXT, price REAL, qty INTEGER
);
`);

// seed a default login if none exists yet
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (userCount === 0) {
  db.prepare('INSERT INTO users (business_id, username, password) VALUES (?, ?, ?)')
    .run('SUMICO001', 'admin', 'admin123');
}

// ---- AUTH ----
app.post('/api/login', (req, res) => {
  const { businessId, username, password } = req.body;
  const user = db.prepare(
    'SELECT * FROM users WHERE business_id = ? AND username = ? AND password = ?'
  ).get(businessId, username, password);
  if (user) res.json({ ok: true });
  else res.status(401).json({ ok: false, error: 'Invalid Business ID, username or password' });
});

// ---- SALES ----
app.get('/api/sales', (req, res) => {
  res.json(db.prepare('SELECT * FROM sales ORDER BY id DESC').all());
});
app.post('/api/sales', (req, res) => {
  const { customer, item, amount, payment } = req.body;
  const invoice = 'INV-' + (1000 + db.prepare('SELECT COUNT(*) AS c FROM sales').get().c + 1);
  db.prepare('INSERT INTO sales (invoice, customer, item, amount, payment) VALUES (?,?,?,?,?)')
    .run(invoice, customer || 'Walk-in customer', item || '-', amount, payment || 'Cash');
  res.json({ ok: true, invoice });
});

// ---- EXPENSES ----
app.get('/api/expenses', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY id DESC').all());
});
app.post('/api/expenses', (req, res) => {
  const { payee, category, amount } = req.body;
  db.prepare('INSERT INTO expenses (payee, category, amount) VALUES (?,?,?)').run(payee, category, amount);
  res.json({ ok: true });
});

// ---- CUSTOMERS ----
app.get('/api/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers ORDER BY id DESC').all());
});
app.post('/api/customers', (req, res) => {
  const { name, mobile, address } = req.body;
  db.prepare('INSERT INTO customers (name, mobile, address) VALUES (?,?,?)').run(name, mobile, address || '-');
  res.json({ ok: true });
});

// ---- INVENTORY ----
app.get('/api/inventory', (req, res) => {
  res.json(db.prepare('SELECT * FROM inventory ORDER BY id DESC').all());
});
app.post('/api/inventory', (req, res) => {
  const { barcode, name, price, qty } = req.body;
  db.prepare('INSERT INTO inventory (barcode, name, price, qty) VALUES (?,?,?,?)').run(barcode, name, price, qty || 1);
  res.json({ ok: true });
});

// ---- DASHBOARD SUMMARY ----
app.get('/api/summary', (req, res) => {
  const totalSales = db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM sales').get().t;
  const cash = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM sales WHERE payment='Cash'").get().t;
  const card = db.prepare("SELECT COALESCE(SUM(amount),0) AS t FROM sales WHERE payment='Card'").get().t;
  const totalExpense = db.prepare('SELECT COALESCE(SUM(amount),0) AS t FROM expenses').get().t;
  res.json({ totalSales, cash, card, totalExpense });
});

// ---- SERVER SETUP FOR RAILWAY ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log('Sumico POS server running on port ' + PORT);
});
