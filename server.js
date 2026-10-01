const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// 🔗 ភ្ជាប់ទៅកាន់ PostgreSQL Database (Neon)[cite: 3]
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_gqyNjVpn0a9A@ep-summer-mountain-b5v7mdk3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL (Neon) Database successfully!"))
    .catch(err => console.error("Database connection error:", err));

// ----------------- 0. SERVE FRONTEND STATIC FILES FROM 'public' -----------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ----------------- 1. CREATE TABLES & MIGRATE COLUMNS -----------------
const initTables = async () => {
    const queryMaster = `
        CREATE TABLE IF NOT EXISTS master_items (
            id SERIAL PRIMARY KEY,
            type VARCHAR(50) DEFAULT 'EXPENSE',
            category VARCHAR(255) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            unit VARCHAR(50) DEFAULT 'ដុំ',
            stock_quantity INT DEFAULT 0,
            cost_price DECIMAL(10, 2) DEFAULT 0,
            retail_price DECIMAL(10, 2) DEFAULT 0,
            wholesale_price DECIMAL(10, 2) DEFAULT 0,
            image_url TEXT DEFAULT ''
        );
    `;
    const queryTransactions = `
        CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            type VARCHAR(50) NOT NULL,
            item_id INT,
            category VARCHAR(255) NOT NULL,
            item_name VARCHAR(255) NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            unit_price DECIMAL(10, 2) NOT NULL,
            amount DECIMAL(10, 2) NOT NULL
        );
    `;
    try {
        await pool.query(queryMaster);
        await pool.query(queryTransactions);
        
        // ធានាថាមាន Column image_url ស្រាប់
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';`);

        console.log("Database tables and columns are ready and safe.");
    } catch (err) {
        console.error("Error creating/updating tables:", err);
    }
};
initTables();

// ----------------- 2. MASTER ITEMS API -----------------

app.get('/api/accounting/master-items', async (req, res) => {
    try {
        let result = await pool.query('SELECT * FROM master_items ORDER BY category, item_name ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/accounting/master-items', async (req, res) => {
    try {
        let { type, category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price, image_url } = req.body;
        const formattedType = (type && type.trim() !== '') ? type.toUpperCase() : 'EXPENSE';
        const itemUnit = (unit && unit.trim() !== '') ? unit : 'ដុំ';
        const imgUrl = image_url || '';

        const query = `
            INSERT INTO master_items (type, category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price, image_url)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;
        `;
        let result = await pool.query(query, [
            formattedType, 
            category, 
            item_name, 
            itemUnit,
            stock_quantity || 0, 
            cost_price || 0,
            retail_price || 0,
            wholesale_price || 0,
            imgUrl
        ]);
        
        res.status(201).json({ success: true, message: "Master item added successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.put('/api/accounting/master-items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price, image_url } = req.body;
        const itemUnit = (unit && unit.trim() !== '') ? unit : 'ដុំ';
        const imgUrl = image_url || '';

        const query = `
            UPDATE master_items 
            SET category = $1, item_name = $2, unit = $3, stock_quantity = $4, cost_price = $5, retail_price = $6, wholesale_price = $7, image_url = $8
            WHERE id = $9 RETURNING *;
        `;
        let result = await pool.query(query, [
            category, 
            item_name, 
            itemUnit,
            stock_quantity || 0, 
            cost_price || 0, 
            retail_price || 0,
            wholesale_price || 0,
            imgUrl,
            id
        ]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: "Master item not found!" });
        }

        res.json({ success: true, message: "Master item updated successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });
    }
});

app.delete('/api/accounting/master-items/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM master_items WHERE id = $1', [id]);
        res.json({ success: true, message: "Master item deleted successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// រត់ Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Accounting API Server is running on port ${PORT}`);
});
