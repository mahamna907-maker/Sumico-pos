const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
const db = new Database('retail_pos.db');

// Enable Foreign Keys
db.pragma('foreign_keys = ON');

// Initialize Database Tables
function initDB() {
    // 1. CUSTOMERS TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mobile_number TEXT UNIQUE NOT NULL,
            company_name TEXT,
            customer_name TEXT NOT NULL,
            address TEXT,
            email TEXT,
            custom_category TEXT DEFAULT 'DEFAULT',
            terms TEXT,
            due_date TEXT,
            credit_limit REAL DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 2. EXPENSES TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            expense_date TEXT NOT NULL,
            location TEXT NOT NULL,
            ref_no TEXT NOT NULL,
            payee_name TEXT NOT NULL,
            description TEXT,
            category TEXT NOT NULL,
            payment_method TEXT NOT NULL,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 3. PETTY CASH TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS petty_cash (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT CHECK(type IN ('Reimbursement', 'Expense')) NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            receipt_no TEXT,
            payee TEXT,
            description TEXT,
            running_balance REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 4. CASH REGISTER TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS cash_registers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            register_code TEXT DEFAULT 'REG001',
            opening_balance REAL DEFAULT 0.00,
            closing_balance REAL DEFAULT 0.00,
            status TEXT CHECK(status IN ('OPEN', 'CLOSED')) DEFAULT 'OPEN',
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME
        )
    `);

    // 5. SALES / INVOICES TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id TEXT UNIQUE NOT NULL,
            customer_id INTEGER,
            invoice_date TEXT NOT NULL,
            total_amount REAL NOT NULL,
            discount REAL DEFAULT 0.00,
            vat_amount REAL DEFAULT 0.00,
            net_amount REAL NOT NULL,
            returned_amount REAL DEFAULT 0.00,
            payment_method TEXT NOT NULL, -- Cash, Card, Bank, Credit
            payment_status TEXT CHECK(payment_status IN ('PAID', 'PENDING', 'PARTIAL', 'VOID')) DEFAULT 'PAID',
            order_status TEXT CHECK(order_status IN ('BILLED', 'HOLD', 'CANCELLED')) DEFAULT 'BILLED',
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )
    `);

    // 6. QUOTATIONS TABLE
    db.exec(`
        CREATE TABLE IF NOT EXISTS quotations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ref_no TEXT UNIQUE NOT NULL,
            customer_name TEXT,
            company_name TEXT,
            address TEXT,
            contact TEXT,
            email TEXT,
            quote_date TEXT NOT NULL,
            availability TEXT DEFAULT 'Ex Stock',
            validity TEXT DEFAULT '14 Days',
            payment_terms TEXT DEFAULT '50% Advance Before Installing System, 50% Balance After Installing System',
            total_items INTEGER DEFAULT 0,
            total_amount REAL DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    console.log('All POS Database tables initialized successfully.');
}

initDB();

// =================================================================
// 1. DASHBOARD & OVERVIEW API
// =================================================================
app.get('/api/dashboard/overview', (req, res) => {
    try {
        const totalSales = db.prepare(`SELECT SUM(net_amount) as total FROM sales WHERE order_status = 'BILLED'`).get().total || 0;
        const cashPayments = db.prepare(`SELECT SUM(net_amount) as total FROM sales WHERE payment_method = 'Cash' AND order_status = 'BILLED'`).get().total || 0;
        const cardPayments = db.prepare(`SELECT SUM(net_amount) as total FROM sales WHERE payment_method = 'Card' AND order_status = 'BILLED'`).get().total || 0;
        const bankPayments = db.prepare(`SELECT SUM(net_amount) as total FROM sales WHERE payment_method = 'Bank' AND order_status = 'BILLED'`).get().total || 0;
        const creditSales = db.prepare(`SELECT SUM(net_amount) as total FROM sales WHERE payment_method = 'Credit' AND order_status = 'BILLED'`).get().total || 0;
        const holdOrders = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE order_status = 'HOLD'`).get().count || 0;
        const pendingPayments = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE payment_status = 'PENDING'`).get().count || 0;

        res.json({
            status: 'success',
            data: {
                totalSales,
                paymentMix: {
                    cash: cashPayments,
                    card: cardPayments,
                    bank: bankPayments,
                    creditSales: creditSales
                },
                holdOrders,
                pendingPayments
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =================================================================
// 2. EXPENSES MODULE API
// =================================================================
app.post('/api/expenses', (req, res) => {
    const { expense_date, location, ref_no, payee_name, description, category, payment_method, amount } = req.body;
    
    if (!expense_date || !ref_no || !payee_name || !amount) {
        return res.status(400).json({ error: 'Required fields missing: Date, Ref No, Payee Name, Amount' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO expenses (expense_date, location, ref_no, payee_name, description, category, payment_method, amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(expense_date, location, ref_no, payee_name, description, category, payment_method, amount);
        res.status(201).json({ message: 'Expense added successfully', expenseId: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/expenses', (req, res) => {
    try {
        const expenses = db.prepare(`SELECT * FROM expenses ORDER BY id DESC`).all();
        const total = db.prepare(`SELECT SUM(amount) as totalExpense FROM expenses`).get().totalExpense || 0;
        res.json({ totalExpense: total, data: expenses });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =================================================================
// 3. PETTY CASH MODULE API
// =================================================================
app.get('/api/petty-cash', (req, res) => {
    try {
        const entries = db.prepare(`SELECT * FROM petty_cash ORDER BY id DESC`).all();
        const lastEntry = db.prepare(`SELECT running_balance FROM petty_cash ORDER BY id DESC LIMIT 1`).get();
        const runningBalance = lastEntry ? lastEntry.running_balance : 0.00;

        res.json({ runningBalance, entries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/petty-cash/entry', (req, res) => {
    const { type, date, amount, receipt_no, payee, description } = req.body;

    try {
        const lastEntry = db.prepare(`SELECT running_balance FROM petty_cash ORDER BY id DESC LIMIT 1`).get();
        let currentBalance = lastEntry ? lastEntry.running_balance : 0.00;

        let newBalance = type === 'Reimbursement' ? currentBalance + amount : currentBalance - amount;

        const stmt = db.prepare(`
            INSERT INTO petty_cash (type, date, amount, receipt_no, payee, description, running_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(type, date, amount, receipt_no, payee, description, newBalance);

        res.json({ message: 'Petty Cash entry saved', newBalance });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =================================================================
// 4. CUSTOMER MODULE API
// =================================================================
app.post('/api/customers', (req, res) => {
    const { mobile_number, company_name, customer_name, address, email, custom_category, terms, due_date } = req.body;

    if (!mobile_number || !customer_name) {
        return res.status(400).json({ error: 'Mobile Number and Customer Name are required' });
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO customers (mobile_number, company_name, customer_name, address, email, custom_category, terms, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(mobile_number, company_name, customer_name, address, email, custom_category || 'DEFAULT', terms, due_date);
        res.status(201).json({ message: 'Customer added successfully', customerId: info.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/customers', (req, res) => {
    try {
        const customers = db.prepare(`SELECT * FROM customers ORDER BY id DESC`).all();
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// =================================================================
// 5. SALES & QUOTATIONS API
// =================================================================
app.get('/api/sales', (req, res) => {
    try {
        const sales = db.prepare(`
            SELECT sales.*, customers.customer_name 
            FROM sales 
            LEFT JOIN customers ON sales.customer_id = customers.id
            ORDER BY sales.id DESC
        `).all();
        res.json(sales);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/quotations', (req, res) => {
    const { customer_name, company_name, address, contact, email, total_items, total_amount } = req.body;
    const ref_no = 'REF' + Date.now();
    const quote_date = new Date().toISOString().split('T')[0];

    try {
        const stmt = db.prepare(`
            INSERT INTO quotations (ref_no, customer_name, company_name, address, contact, email, quote_date, total_items, total_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(ref_no, customer_name, company_name, address, contact, email, quote_date, total_items, total_amount);
        res.status(201).json({ message: 'Quotation created', ref_no });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Default Health Route
app.get('/', (req, res) => {
    res.send('Sumico Retail POS API is Live!');
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
