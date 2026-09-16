const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ភ្ជាប់ទៅ Cloud PostgreSQL Database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// បង្កើត Table users ស្វ័យប្រវត្តិបើមិនទាន់មាន
pool.query(`
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100),
        role VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).catch(err => console.error('Error creating table:', err));

// API Save Data ចូល Database
app.post('/api/users', async (req, res) => {
    const { username, role } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, role) VALUES ($1, $2) RETURNING *',
            [username, role]
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

// API ទាញ Data ពី Database
app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM users ORDER BY id DESC');
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
