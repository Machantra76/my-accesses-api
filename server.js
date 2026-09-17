const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ភ្ជាប់ទៅ Cloud PostgreSQL Database (Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// រៀបចំ Tables ទាំងអស់ក្នុង Database ដោយស្វ័យប្រវត្តិ
async function initDB() {
    try {
        // 1. បង្កើត Table users ប្រសិនបើយ៉ាងមិនទាន់មាន
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100),
                role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // បន្ថែម column password ទៅ users
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(100);
        `);

        // 2. បង្កើត Table shipping_lines ប្រសិនបើយ៉ាងមិនទាន់មាន
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shipping_lines (
                id SERIAL PRIMARY KEY,
                shipping_line VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log("Database initialized successfully!");
    } catch (err) {
        console.error("DB Init Error:", err);
    }
}
initDB();

// ==========================================
// USER API ENDPOINTS
// ==========================================

// API សម្រាប់ Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Login successful", user: result.rows[0] });
        } else {
            res.status(401).json({ status: "Error", message: "Invalid username or password" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// API Save Data / Register User
app.post('/api/users', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING *',
            [username, password || '123', role || 'User']
        );
        res.status(201).json({
            status: "Success",
            message: "Data saved to Cloud Database successfully!",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ==========================================
// SHIPPING LINE API ENDPOINTS
// ==========================================

// API Save Shipping Line
app.post('/api/shipping-lines', async (req, res) => {
    const { shipping_line, code, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO shipping_lines (shipping_line, code, status) VALUES ($1, $2, $3) RETURNING *',
            [shipping_line, code, status || 'Active']
        );

        res.status(201).json({
            status: "Success",
            message: "Shipping Line saved successfully",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// API ទាញយកបញ្ជី Shipping Line ទាំងអស់ (សម្រាប់បង្ហាញលើ Access/Form)
app.get('/api/shipping-lines', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shipping_lines ORDER BY id DESC');
        res.status(200).json({
            status: "Success",
            data: result.rows
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ដំណើរការ Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
