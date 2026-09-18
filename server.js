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
        // 1. បង្កើត Table users
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100),
                role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(100);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active VARCHAR(20) DEFAULT 'Active';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
        `);

        // 2. បង្កើត Table shipping_lines
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shipping_lines (
                id SERIAL PRIMARY KEY,
                shipping_line VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 3. បង្កើត Table container_stock
        await pool.query(`
            CREATE TABLE IF NOT EXISTS container_stock (
                id SERIAL PRIMARY KEY,
                container_no VARCHAR(50) NOT NULL,
                size VARCHAR(20),
                type VARCHAR(20),
                shipping_line VARCHAR(100),
                vessel_voy VARCHAR(100),
                booking_no VARCHAR(100),
                remark TEXT,
                status VARCHAR(50) DEFAULT 'IN YARD',
                day_in_yard VARCHAR(10) DEFAULT '0',
                date_in TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date_out TIMESTAMP
            );
        `);

        await pool.query(`
            ALTER TABLE container_stock ADD COLUMN IF NOT EXISTS check_repair VARCHAR(100);
        `);

        // 4. បង្កើត Table activity_log
        await pool.query(`
            CREATE TABLE IF NOT EXISTS activity_log (
                log_id SERIAL PRIMARY KEY,
                date_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_name VARCHAR(100),
                action VARCHAR(100),
                module VARCHAR(100),
                container_no VARCHAR(50),
                discription TEXT
            );
        `);

        // 5. បង្កើត Table container_repair (ស៊ីសង្វាក់គ្នានឹង Form CONTAINER REPAIR)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS container_repair (
                id SERIAL PRIMARY KEY,
                container_no VARCHAR(50) NOT NULL,
                repair_date_in_time TIMESTAMP,
                shipping_line VARCHAR(100),
                size VARCHAR(20),
                type VARCHAR(20),
                vessel_voy VARCHAR(100),
                repair_status VARCHAR(50),
                damage_type VARCHAR(100),
                damage_discription TEXT,
                vender VARCHAR(100),
                est_cost NUMERIC(10,2) DEFAULT 0,
                act_cost NUMERIC(10,2) DEFAULT 0,
                remark TEXT,
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

app.get('/api/users', async (req, res) => {
    try {
        const result = await pool.query("SELECT id, username, COALESCE(full_name, username) AS full_name, role, COALESCE(active, 'Active') AS active, created_at FROM users ORDER BY id ASC");
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/users/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING *',
            [role, id]
        );

        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "User role updated successfully!", user: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "User not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND password = $2',
            [username, password]
        );

        if (result.rows.length > 0) {
            await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [result.rows[0].id]);
            res.status(200).json({ status: "Success", message: "Login successful", user: result.rows[0] });
        } else {
            res.status(401).json({ status: "Error", message: "Invalid username or password" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.post('/api/users', async (req, res) => {
    const { username, password, role, full_name } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
            [username, password || '123', role || 'User', full_name || username]
        );
        res.status(201).json({ status: "Success", message: "User saved successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ==========================================
// SHIPPING LINE API ENDPOINTS
// ==========================================

app.post('/api/shipping-lines', async (req, res) => {
    const { shipping_line, code, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO shipping_lines (shipping_line, code, status) VALUES ($1, $2, $3) RETURNING *',
            [shipping_line, code, status || 'Active']
        );
        res.status(201).json({ status: "Success", message: "Shipping Line saved successfully", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.get('/api/shipping-lines', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM shipping_lines ORDER BY id DESC');
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ==========================================
// CONTAINER STOCK API ENDPOINTS
// ==========================================

app.get('/api/containers/check-duplicate', async (req, res) => {
    const { container_no } = req.query;
    try {
        const result = await pool.query(
            "SELECT * FROM container_stock WHERE container_no = $1 AND status = 'IN YARD'",
            [container_no]
        );
        res.status(200).json({ exists: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.post('/api/containers', async (req, res) => {
    const { container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO container_stock (container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair, status, day_in_yard) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'IN YARD', '0') RETURNING *`,
            [container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair || '']
        );
        res.status(201).json({ status: "Success", message: "Container saved successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.get('/api/containers', async (req, res) => {
    const { shipping_line, size, container_no } = req.query;
    try {
        let query = "SELECT * FROM container_stock WHERE 1=1";
        let params = [];
        let paramIndex = 1;

        if (shipping_line && shipping_line.trim() !== "") {
            query += ` AND shipping_line ILIKE $${paramIndex}`;
            params.push(`%${shipping_line}%`);
            paramIndex++;
        }
        if (size && size.trim() !== "") {
            query += ` AND size ILIKE $${paramIndex}`;
            params.push(`%${size}%`);
            paramIndex++;
        }
        if (container_no && container_no.trim() !== "") {
            query += ` AND container_no ILIKE $${paramIndex}`;
            params.push(`%${container_no}%`);
            paramIndex++;
        }

        query += " ORDER BY id DESC LIMIT 500";
        const result = await pool.query(query, params);
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/containers/status', async (req, res) => {
    const { container_no, status } = req.body;
    try {
        let query = "UPDATE container_stock SET status = $1";
        let params = [status, container_no];

        if (status === 'RELEASE') {
            query += ", date_out = CURRENT_TIMESTAMP WHERE container_no = $2 RETURNING *";
        } else {
            query += ", date_out = NULL WHERE container_no = $2 RETURNING *";
        }

        const result = await pool.query(query, params);
        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Status updated", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/containers/edit', async (req, res) => {
    const { container_no, booking_no, remark } = req.body;
    try {
        const result = await pool.query(
            `UPDATE container_stock SET booking_no = $1, remark = $2 WHERE container_no = $3 RETURNING *`,
            [booking_no, remark, container_no]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Container updated", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ==========================================
// CONTAINER REPAIR API ENDPOINTS (តម្រូវតាម Form CONTAINER REPAIR)
// ==========================================

// ទាញយកបញ្ជីកុងតឺន័រដែលត្រូវជួសជុល (សម្រាប់ ComboBox CONTAINER_No ក្នុង Form Repair)
app.get('/api/containers/repair-list', async (req, res) => {
    try {
        const query = `
            SELECT container_no, date_in, shipping_line, size, type, vessel_voy, check_repair 
            FROM container_stock 
            WHERE check_repair IS NOT NULL 
              AND TRIM(check_repair) <> '' 
              AND UPPER(check_repair) <> 'NO'
            ORDER BY id DESC
        `;
        const result = await pool.query(query);
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// រក្សាទុកទិន្នន័យជួសជុលកុងតឺន័រ (ពេលចុចป៊ូតុង SAVE នៅលើ Form Repair)
app.post('/api/container-repairs', async (req, res) => {
    const { 
        container_no, repair_date_in_time, shipping_line, size, type, 
        vessel_voy, repair_status, damage_type, damage_discription, 
        vender, est_cost, act_cost, remark 
    } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO container_repair 
            (container_no, repair_date_in_time, shipping_line, size, type, vessel_voy, repair_status, damage_type, damage_discription, vender, est_cost, act_cost, remark) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
            [
                container_no, repair_date_in_time || new Date(), shipping_line, size, type, 
                vessel_voy, repair_status, damage_type, damage_discription, 
                vender, est_cost || 0, act_cost || 0, remark
            ]
        );

        res.status(201).json({
            status: "Success",
            message: "Container repair record saved successfully!",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ==========================================
// ACTIVITY LOG API ENDPOINTS
// ==========================================

app.post('/api/activity-log', async (req, res) => {
    const { user_name, action, module, container_no, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO activity_log (date_time, user_name, action, module, container_no, discription) 
             VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5) RETURNING *`,
            [user_name || 'System', action, module, container_no || '', description]
        );
        res.status(201).json({ status: "Success", message: "Log saved", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.get('/api/activity-log', async (req, res) => {
    const { user_name } = req.query;
    try {
        let query = "SELECT log_id, date_time, user_name, action, module, container_no, discription FROM activity_log ";
        let params = [];

        if (user_name && user_name.trim() !== "") {
            query += "WHERE LOWER(user_name) LIKE LOWER($1) ";
            params.push(`%${user_name}%`);
        }

        query += "ORDER BY log_id DESC LIMIT 200";
        const result = await pool.query(query, params);
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// ដំណើរការ Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
