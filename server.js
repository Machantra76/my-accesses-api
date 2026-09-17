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

// រៀបចំ Table និងបន្ថែម column password បើមិនទាន់មាន
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100),
                role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // បន្ថែម column password ប្រសិនបើគ្មាន
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(100);
        `);
        console.log("Database initialized successfully!");
    } catch (err) {
        console.error("DB Init Error:", err);
    }
}
initDB();

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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
