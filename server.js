const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// -------------------------------------------------------------
// SERVE STATIC FILES FROM "PUBLIC" FOLDER
// -------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// -------------------------------------------------------------
// HTML PAGE ROUTES
// -------------------------------------------------------------
app.get('/stock_in.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'stock_in.html')));
app.get('/repair.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'repair.html')));
app.get('/shipping_line.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shipping_line.html')));
app.get('/date_in.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'date_in.html')));
app.get('/report_repair.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'report_repair.html')));
app.get('/shipping_line_manager.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shipping_line_manager.html')));
app.get('/location_manager.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'location_manager.html')));
app.get('/user_activity.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user_activity.html')));
app.get('/user_management.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user_management.html')));
app.get('/user_report.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'user_report.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

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
        await pool.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(100);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS active VARCHAR(20) DEFAULT 'Active';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS shipping_lines (
                id SERIAL PRIMARY KEY,
                shipping_line VARCHAR(255) NOT NULL,
                code VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS locations (
                id SERIAL PRIMARY KEY,
                location_code VARCHAR(100) NOT NULL,
                yard_block VARCHAR(100),
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
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
            ALTER TABLE container_stock ADD COLUMN IF NOT EXISTS location VARCHAR(100);
        `);
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS container_repair (
                id SERIAL PRIMARY KEY,
                container_no VARCHAR(50) NOT NULL,
                repair_date_in_time TIMESTAMP,
                shipping_line VARCHAR(100),
                size VARCHAR(20),
                type VARCHAR(20),
                day_in_repair VARCHAR(50),
                repair_status VARCHAR(50),
                complete_date VARCHAR(50),
                vessel_voy VARCHAR(100),
                check_repair VARCHAR(100),
                damage_type VARCHAR(100),
                damage_discription TEXT,
                vender VARCHAR(100),
                est_cost NUMERIC(10,2) DEFAULT 0,
                act_cost NUMERIC(10,2) DEFAULT 0,
                remark TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            ALTER TABLE container_repair ADD COLUMN IF NOT EXISTS day_in_repair VARCHAR(50);
            ALTER TABLE container_repair ADD COLUMN IF NOT EXISTS complete_date VARCHAR(50);
            ALTER TABLE container_repair ADD COLUMN IF NOT EXISTS check_repair VARCHAR(100);
        `);

        console.log("Database initialized successfully with Location support!");
    } catch (err) {
        console.error("DB Init Error:", err);
    }
}
initDB();

// -------------------------------------------------------------
// SYSTEM RESET / CLEAR DATABASE ENDPOINT
// -------------------------------------------------------------
app.delete('/api/reset-database', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE container_repair, container_stock, shipping_lines, locations, activity_log, users RESTART IDENTITY CASCADE;');
        res.status(200).json({ 
            status: "Success", 
            message: "All database tables cleared and IDs reset successfully!" 
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// -------------------------------------------------------------
// USER API ENDPOINTS
// -------------------------------------------------------------
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
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', [role, id]);
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
        const result = await pool.query('SELECT * FROM users WHERE username = $1 AND password = $2', [username, password]);
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
        const result = await pool.query('INSERT INTO users (username, password, role, full_name) VALUES ($1, $2, $3, $4) RETURNING *', [username, password || '123', role || 'User', full_name || username]);
        res.status(201).json({ status: "Success", message: "User saved successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// 🟢 ថែមកន្លែង Change Username & Password សម្រាប់ User ខ្លួនឯង
app.put('/api/users/change-credentials', async (req, res) => {
    const { old_username, new_username, old_password, new_password } = req.body;
    try {
        // ១. ផ្ទៀងផ្ទាត់ User និង Password ចាស់
        const checkUser = await pool.query(
            "SELECT * FROM users WHERE username = $1 AND password = $2", 
            [old_username, old_password]
        );

        if (checkUser.rows.length === 0) {
            return res.status(401).json({ status: "Error", message: "Password ចាស់មិនត្រឹមត្រូវទេ!" });
        }

        // ២. រៀបចំ query សម្រាប់ Update យក Username ថ្មី និង Password ថ្មី (បើមាន)
        let updateQuery = "";
        let updateParams = [];

        if (new_password && new_password.trim() !== "") {
            updateQuery = "UPDATE users SET username = $1, password = $2 WHERE username = $3 RETURNING id, username, role";
            updateParams = [new_username, new_password, old_username];
        } else {
            updateQuery = "UPDATE users SET username = $1 WHERE username = $2 RETURNING id, username, role";
            updateParams = [new_username, old_username];
        }

        const result = await pool.query(updateQuery, updateParams);

        if (result.rows.length > 0) {
            res.status(200).json({ 
                status: "Success", 
                message: "ផ្លាស់ប្តូរ Username និង Password បានជោគជ័យ!", 
                data: result.rows[0] 
            });
        } else {
            res.status(404).json({ status: "Error", message: "រកមិនឃើញគណនីនេះទេ!" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// -------------------------------------------------------------
// SHIPPING LINES API ENDPOINTS
// -------------------------------------------------------------
app.post('/api/shipping-lines', async (req, res) => {
    const { shipping_line, code, status } = req.body;
    try {
        const result = await pool.query('INSERT INTO shipping_lines (shipping_line, code, status) VALUES ($1, $2, $3) RETURNING *', [shipping_line, code, status || 'Active']);
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

// -------------------------------------------------------------
// YARD LOCATIONS API ENDPOINTS
// -------------------------------------------------------------
app.get('/api/locations', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM locations ORDER BY id DESC');
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.post('/api/locations', async (req, res) => {
    const { location_code, yard_block, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO locations (location_code, yard_block, description) 
             VALUES ($1, $2, $3) RETURNING *`,
            [location_code, yard_block, description || '']
        );
        res.status(201).json({ status: "Success", message: "Location created successfully!", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// -------------------------------------------------------------
// CONTAINER STOCK API ENDPOINTS
// -------------------------------------------------------------
app.get('/api/containers/check-duplicate', async (req, res) => {
    const { container_no } = req.query;
    try {
        const result = await pool.query("SELECT * FROM container_stock WHERE container_no = $1 AND status = 'IN YARD'", [container_no]);
        res.status(200).json({ exists: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

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

app.get('/api/containers/available-for-repair', async (req, res) => {
    try {
        const query = `
            SELECT id, container_no, shipping_line, size, type, vessel_voy, status, check_repair 
            FROM container_stock 
            WHERE status = 'IN YARD' 
              AND (check_repair IS NULL OR TRIM(check_repair) = '' OR UPPER(check_repair) = 'NO')
            ORDER BY id DESC
        `;
        const result = await pool.query(query);
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.post('/api/containers', async (req, res) => {
    const { container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair, location } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO container_stock (container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair, location, status, day_in_yard) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'IN YARD', '0') RETURNING *`, 
            [container_no, size, type, shipping_line, vessel_voy, booking_no, remark, check_repair || '', location || '']
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

app.put('/api/containers/edit-full', async (req, res) => {
    const { original_container_no, container_no, size, type, shipping_line, vessel_voy, booking_no, remark, location } = req.body;
    try {
        const checkExist = await pool.query("SELECT * FROM container_stock WHERE container_no = $1", [original_container_no]);
        
        if (checkExist.rows.length === 0) {
            return res.status(404).json({ status: "Error", message: "Container not found" });
        }

        const result = await pool.query(
            `UPDATE container_stock 
             SET container_no = $1, size = $2, type = $3, shipping_line = $4, vessel_voy = $5, booking_no = $6, remark = $7, location = $8 
             WHERE container_no = $9 RETURNING *`,
            [container_no, size, type, shipping_line, vessel_voy, booking_no, remark, location, original_container_no]
        );

        res.status(200).json({ status: "Success", message: "Container updated successfully", data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/containers/update-repair-status', async (req, res) => {
    const { container_no, check_repair, checkRepair } = req.body;
    const statusVal = check_repair || checkRepair || 'UnderRepair';
    try {
        const result = await pool.query(
            "UPDATE container_stock SET check_repair = $1 WHERE container_no = $2 RETURNING *",
            [statusVal, container_no]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Check Repair updated", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/containers/status', async (req, res) => {
    const { container_no, status } = req.body;
    try {
        let newStatus = status || 'RELEASE';
        let query = "UPDATE container_stock SET status = $1";
        let params = [newStatus, container_no];
        
        if (newStatus === 'RELEASE' || newStatus === 'RELIES') {
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

app.put('/api/containers/status/:container_no', async (req, res) => {
    const { container_no } = req.params;
    const { status } = req.body;
    try {
        let newStatus = status || 'RELEASE';
        const result = await pool.query(
            "UPDATE container_stock SET status = $1, date_out = CURRENT_TIMESTAMP WHERE container_no = $2 RETURNING *",
            [newStatus, container_no]
        );
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
        const result = await pool.query(`UPDATE container_stock SET booking_no = $1, remark = $2 WHERE container_no = $3 RETURNING *`, [booking_no, remark, container_no]);
        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Container updated", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/containers/:container_no', async (req, res) => {
    const { container_no } = req.params;
    const { check_repair, checkRepair } = req.body;
    const statusVal = check_repair || checkRepair || 'UnderRepair';
    try {
        const result = await pool.query(
            "UPDATE container_stock SET check_repair = $1 WHERE container_no = $2 RETURNING *",
            [statusVal, container_no]
        );
        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Check Repair updated", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// -------------------------------------------------------------
// CONTAINER REPAIRS API ENDPOINTS
// -------------------------------------------------------------
app.post('/api/container-repairs', async (req, res) => {
    const { 
        container_no, repair_date_in_time, shipping_line, size, type, 
        day_in_repair, repair_status, complete_date, vessel_voy, 
        check_repair, damage_type, damage_discription, vender, 
        est_cost, act_cost, remark 
    } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO container_repair 
            (container_no, repair_date_in_time, shipping_line, size, type, day_in_repair, repair_status, complete_date, vessel_voy, check_repair, damage_type, damage_discription, vender, est_cost, act_cost, remark) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
            [
                container_no, repair_date_in_time || new Date(), shipping_line, size, type, 
                day_in_repair, repair_status || 'UnderRepair', complete_date, vessel_voy, 
                check_repair || 'UnderRepair', damage_type, damage_discription, vender, 
                est_cost || 0, act_cost || 0, remark
            ]
        );

        await pool.query(
            `UPDATE container_stock SET check_repair = 'UnderRepair' WHERE container_no = $1`,
            [container_no]
        );

        res.status(201).json({
            status: "Success",
            message: "Container repair record saved and stock status updated successfully!",
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/container-repairs/complete', async (req, res) => {
    const { container_no, complete_date, check_repair, repair_status, id } = req.body;
    try {
        let query = "";
        let params = [];

        if (id) {
            query = `
                UPDATE container_repair 
                SET complete_date = $1, check_repair = $2, repair_status = $3 
                WHERE id = $4 RETURNING *
            `;
            params = [complete_date || new Date().toISOString(), check_repair || 'Complete', repair_status || 'Completed', id];
        } else {
            query = `
                UPDATE container_repair 
                SET complete_date = $1, check_repair = $2, repair_status = $3 
                WHERE container_no = $4 RETURNING *
            `;
            params = [complete_date || new Date().toISOString(), check_repair || 'Complete', repair_status || 'Completed', container_no];
        }

        const result = await pool.query(query, params);

        if (container_no) {
            await pool.query(
                `UPDATE container_stock SET check_repair = 'Complete' WHERE container_no = $1`,
                [container_no]
            );
        }

        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Repair marked as Complete successfully!", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container repair record not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.put('/api/container-repairs/edit', async (req, res) => {
    const { 
        id, container_no, damage_type, damage_discription, vender, 
        est_cost, act_cost, remark, repair_status, check_repair 
    } = req.body;
    try {
        const query = `
            UPDATE container_repair 
            SET damage_type = $1, damage_discription = $2, vender = $3, 
                est_cost = $4, act_cost = $5, remark = $6, 
                repair_status = COALESCE($7, repair_status), 
                check_repair = COALESCE($8, check_repair)
            WHERE id = $9 OR container_no = $10 RETURNING *
        `;
        const result = await pool.query(query, [
            damage_type, damage_discription, vender, 
            est_cost || 0, act_cost || 0, remark, 
            repair_status, check_repair, id || 0, container_no
        ]);

        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "Repair record updated successfully!", data: result.rows[0] });
        } else {
            res.status(404).json({ status: "Error", message: "Container repair record not found" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.delete('/api/container-repairs/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM container_repair WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length > 0) {
            res.status(200).json({ status: "Success", message: "លុបទិន្នន័យពី container_repair ជោគជ័យ!" });
        } else {
            res.status(404).json({ status: "Error", message: "រកមិនឃើញទិន្នន័យដែលត្រូវលុបទេ" });
        }
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

app.get('/api/container-repairs-report', async (req, res) => {
    try {
        const query = `
            SELECT id AS "No", container_no AS "CONTAINER_No", repair_date_in_time AS "REPAIR_DATE_IN_TIME", 
                   shipping_line AS "SHIPPING_LINE", size AS "SIZE", type AS "TYPE", 
                   day_in_repair AS "DAY_IN_REPAIR", repair_status AS "REPAIR_STATUS", 
                   complete_date AS "COMPLETE_DATE", vessel_voy AS "VESSEL_VOY", 
                   check_repair AS "CHECK_REPAIR", damage_type AS "DAMAGE_TYPE", 
                   damage_discription AS "DAMAGE_DISCRIPTION", vender AS "VENDER", 
                   est_cost AS "EST_COST", act_cost AS "ACT_COST", remark AS "REMARK"
            FROM container_repair 
            ORDER BY id DESC LIMIT 500
        `;
        const result = await pool.query(query);
        res.status(200).json({ status: "Success", data: result.rows });
    } catch (err) {
        res.status(500).json({ status: "Error", message: err.message });
    }
});

// -------------------------------------------------------------
// ACTIVITY LOG API ENDPOINTS
// -------------------------------------------------------------
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

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
