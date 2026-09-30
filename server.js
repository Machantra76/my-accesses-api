const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

// 🔗 ភ្ជាប់ទៅកាន់ PostgreSQL Database (Neon)
const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_gqyNjVpn0a9A@ep-summer-mountain-b5v7mdk3-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL (Neon) Database successfully!"))[cite: 6]
    .catch(err => console.error("Database connection error:", err));[cite: 6]

// ----------------- 0. SERVE FRONTEND STATIC FILES FROM 'public' -----------------
app.use(express.static(path.join(__dirname, 'public')));[cite: 6]

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));[cite: 6]
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
            wholesale_price DECIMAL(10, 2) DEFAULT 0
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
        
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'EXPENSE';`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ALTER COLUMN type DROP NOT NULL;`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ALTER COLUMN type SET DEFAULT 'EXPENSE';`);[cite: 6]

        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'ដុំ';`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0;`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2) DEFAULT 0;`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS retail_price DECIMAL(10, 2) DEFAULT 0;`);[cite: 6]
        await pool.query(`ALTER TABLE master_items ADD COLUMN IF NOT EXISTS wholesale_price DECIMAL(10, 2) DEFAULT 0;`);[cite: 6]
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS item_id INT;`);[cite: 6]

        console.log("Database tables and columns are ready and safe.");[cite: 6]
    } catch (err) {
        console.error("Error creating/updating tables:", err);[cite: 6]
    }
};
initTables();

// ----------------- 2. MASTER ITEMS API -----------------

app.get('/api/accounting/master-items', async (req, res) => {
    try {
        let result = await pool.query('SELECT * FROM master_items ORDER BY category, item_name ASC');[cite: 6]
        res.json({ success: true, data: result.rows });[cite: 6]
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

app.post('/api/accounting/master-items', async (req, res) => {
    try {
        let { type, category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price } = req.body;[cite: 6]
        const formattedType = (type && type.trim() !== '') ? type.toUpperCase() : 'EXPENSE';[cite: 6]
        const itemUnit = (unit && unit.trim() !== '') ? unit : 'ដុំ';[cite: 6]

        const query = `
            INSERT INTO master_items (type, category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;
        `;
        let result = await pool.query(query, [[cite: 6]
            formattedType, 
            category, 
            item_name, 
            itemUnit,
            stock_quantity || 0, 
            cost_price || 0,
            retail_price || 0,
            wholesale_price || 0
        ]);
        
        res.status(201).json({ success: true, message: "Master item added successfully!", data: result.rows[0] });[cite: 6]
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });[cite: 6]
    }
});

app.put('/api/accounting/master-items/:id', async (req, res) => {
    try {
        const { id } = req.params;[cite: 6]
        const { category, item_name, unit, stock_quantity, cost_price, retail_price, wholesale_price } = req.body;[cite: 6]
        const itemUnit = (unit && unit.trim() !== '') ? unit : 'ដុំ';[cite: 6]

        const query = `
            UPDATE master_items 
            SET category = $1, item_name = $2, unit = $3, stock_quantity = $4, cost_price = $5, retail_price = $6, wholesale_price = $7
            WHERE id = $8 RETURNING *;
        `;
        let result = await pool.query(query, [[cite: 6]
            category, 
            item_name, 
            itemUnit,
            stock_quantity || 0, 
            cost_price || 0, 
            retail_price || 0,
            wholesale_price || 0,
            id
        ]);

        if (result.rows.length === 0) {[cite: 6]
            return res.status(404).json({ success: false, error: "Master item not found!" });[cite: 6]
        }

        res.json({ success: true, message: "Master item updated successfully!", data: result.rows[0] });[cite: 6]
    } catch (err) {
        res.status(400).json({ success: false, error: err.message });[cite: 6]
    }
});

app.delete('/api/accounting/master-items/:id', async (req, res) => {
    try {
        const { id } = req.params;[cite: 6]
        await pool.query('DELETE FROM master_items WHERE id = $1', [id]);[cite: 6]
        res.json({ success: true, message: "Master item deleted successfully!" });[cite: 6]
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

// ----------------- 3. TRANSACTIONS API -----------------

app.get('/api/accounting/transactions', async (req, res) => {
    try {
        let result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');[cite: 6]
        res.json({ success: true, data: result.rows });[cite: 6]
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

app.post('/api/accounting/transactions', async (req, res) => {
    const client = await pool.connect();[cite: 6]
    try {
        await client.query('BEGIN');[cite: 6]

        const { type, item_id, category, item_name, quantity, unit_price } = req.body;[cite: 6]
        const formattedType = type ? type.toUpperCase() : 'INCOME';[cite: 6]
        const qty = parseInt(quantity) || 1;[cite: 6]
        const price = parseFloat(unit_price) || 0;[cite: 6]
        const totalAmount = qty * price;[cite: 6]

        const insertQuery = `
            INSERT INTO transactions (type, item_id, category, item_name, quantity, unit_price, amount)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
        `;
        let result = await client.query(insertQuery, [formattedType, item_id, category, item_name, qty, price, totalAmount]);[cite: 6]

        if (item_id) {[cite: 6]
            if (formattedType === 'INCOME') {[cite: 6]
                await client.query(`UPDATE master_items SET stock_quantity = stock_quantity - $1 WHERE id = $2`, [qty, item_id]);[cite: 6]
            } else if (formattedType === 'EXPENSE') {[cite: 6]
                let masterRes = await client.query(`SELECT stock_quantity, cost_price FROM master_items WHERE id = $1`, [item_id]);[cite: 6]
                
                if (masterRes.rows.length > 0) {[cite: 6]
                    let item = masterRes.rows[0];[cite: 6]
                    let oldStock = parseInt(item.stock_quantity) || 0;[cite: 6]
                    let oldCostPrice = parseFloat(item.cost_price) || 0;[cite: 6]
                    
                    let newStock = oldStock + qty;[cite: 6]
                    let newCostPrice = oldCostPrice;[cite: 6]

                    if (newStock > 0) {[cite: 6]
                        newCostPrice = ((oldStock * oldCostPrice) + (qty * price)) / newStock;[cite: 6]
                    }

                    await client.query([cite: 6]
                        `UPDATE master_items SET stock_quantity = $1, cost_price = $2 WHERE id = $3`,
                        [newStock, newCostPrice, item_id]
                    );
                }
            }
        }

        await client.query('COMMIT');[cite: 6]
        res.status(201).json({ success: true, data: result.rows[0] });[cite: 6]
    } catch (err) {
        await client.query('ROLLBACK');[cite: 6]
        res.status(400).json({ success: false, error: err.message });[cite: 6]
    } finally {
        client.release();[cite: 6]
    }
});

app.put('/api/accounting/transactions/:id', async (req, res) => {
    const client = await pool.connect();[cite: 6]
    try {
        await client.query('BEGIN');[cite: 6]
        const { id } = req.params;[cite: 6]
        const { type, item_id, quantity, unit_price } = req.body;[cite: 6]
        
        const qty = parseInt(quantity) || 1;[cite: 6]
        const price = parseFloat(unit_price) || 0;[cite: 6]
        const totalAmount = qty * price;[cite: 6]
        const formattedType = type ? type.toUpperCase() : 'INCOME';[cite: 6]

        let oldTxData = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);[cite: 6]
        if (oldTxData.rows.length === 0) {[cite: 6]
            await client.query('ROLLBACK');[cite: 6]
            return res.status(404).json({ success: false, error: "Transaction not found!" });[cite: 6]
        }
        let oldTx = oldTxData.rows[0];[cite: 6]

        if (oldTx.item_id) {[cite: 6]
            if (oldTx.type === 'INCOME') {[cite: 6]
                await client.query(`UPDATE master_items SET stock_quantity = stock_quantity + $1 WHERE id = $2`, [oldTx.quantity, oldTx.item_id]);[cite: 6]
            } else if (oldTx.type === 'EXPENSE') {[cite: 6]
                await client.query(`UPDATE master_items SET stock_quantity = stock_quantity - $1 WHERE id = $2`, [oldTx.quantity, oldTx.item_id]);[cite: 6]
            }
        }

        if (item_id) {[cite: 6]
            if (formattedType === 'INCOME') {[cite: 6]
                await client.query(`UPDATE master_items SET stock_quantity = stock_quantity - $1 WHERE id = $2`, [qty, item_id]);[cite: 6]
            } else if (formattedType === 'EXPENSE') {[cite: 6]
                await client.query(`UPDATE master_items SET stock_quantity = stock_quantity + $1 WHERE id = $2`, [qty, item_id]);[cite: 6]
            }
        }

        const updateQuery = `
            UPDATE transactions 
            SET type = $1, item_id = $2, quantity = $3, unit_price = $4, amount = $5
            WHERE id = $6 RETURNING *;
        `;
        let result = await client.query(updateQuery, [formattedType, item_id, qty, price, totalAmount, id]);[cite: 6]

        await client.query('COMMIT');[cite: 6]
        res.json({ success: true, message: "Transaction updated successfully!", data: result.rows[0] });[cite: 6]
    } catch (err) {
        await client.query('ROLLBACK');[cite: 6]
        res.status(400).json({ success: false, error: err.message });[cite: 6]
    } finally {
        client.release();[cite: 6]
    }
});

// ----------------- 4. ACCOUNTING GENERAL & SUMMARY API -----------------
app.get('/api/accounting', async (req, res) => {
    try {
        let txResult = await pool.query('SELECT * FROM transactions ORDER BY date DESC');[cite: 6]
        let masterResult = await pool.query('SELECT * FROM master_items ORDER BY category, item_name ASC');[cite: 6]
        res.json({[cite: 6]
            success: true, 
            transactions: txResult.rows,
            master_items: masterResult.rows 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

app.get('/api/accounting/summary', async (req, res) => {
    try {
        let txResult = await pool.query("SELECT * FROM transactions WHERE type = 'INCOME'");[cite: 6]
        let masterResult = await pool.query("SELECT * FROM master_items");[cite: 6]
        
        let totalIncome = 0;[cite: 6]
        let totalProfit = 0;[cite: 6]

        let costPriceMap = {};[cite: 6]
        masterResult.rows.forEach(m => {[cite: 6]
            costPriceMap[m.id] = parseFloat(m.cost_price) || 0;[cite: 6]
        });

        txResult.rows.forEach(tx => {[cite: 6]
            let incomeAmt = parseFloat(tx.amount) || 0;[cite: 6]
            totalIncome += incomeAmt;[cite: 6]

            let costPrice = costPriceMap[tx.item_id] || 0;[cite: 6]
            let profitPerUnit = parseFloat(tx.unit_price) - costPrice;[cite: 6]
            totalProfit += (profitPerUnit * tx.quantity);[cite: 6]
        });

        let totalInventoryValue = 0;[cite: 6]
        masterResult.rows.forEach(m => {[cite: 6]
            totalInventoryValue += (parseInt(m.stock_quantity) * parseFloat(m.cost_price));[cite: 6]
        });

        res.json({[cite: 6]
            success: true,
            summary: {
                total_income: totalIncome,
                total_purchase_value: totalInventoryValue,
                net_profit: totalProfit
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

app.get('/api/accounting/category-summary', async (req, res) => {
    try {
        let masterResult = await pool.query("SELECT * FROM master_items");[cite: 6]
        let txResult = await pool.query("SELECT * FROM transactions WHERE type = 'INCOME'");[cite: 6]

        let categoryProfitMap = {};[cite: 6]
        masterResult.rows.forEach(m => {[cite: 6]
            if (!categoryProfitMap[m.category]) categoryProfitMap[m.category] = 0;[cite: 6]
        });

        txResult.rows.forEach(tx => {[cite: 6]
            let masterItem = masterResult.rows.find(m => m.id === tx.item_id);[cite: 6]
            let costPrice = masterItem ? parseFloat(masterItem.cost_price) : 0;[cite: 6]
            let profit = (parseFloat(tx.unit_price) - costPrice) * tx.quantity;[cite: 6]

            if (!categoryProfitMap[tx.category]) categoryProfitMap[tx.category] = 0;[cite: 6]
            categoryProfitMap[tx.category] += profit;[cite: 6]
        });

        let formattedData = Object.keys(categoryProfitMap).map(cat => ({[cite: 6]
            category: cat,
            profit: categoryProfitMap[cat]
        }));

        res.json({ success: true, data: formattedData });[cite: 6]
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    }
});

app.delete('/api/accounting/transactions/:id', async (req, res) => {
    const client = await pool.connect();[cite: 6]
    try {
        await client.query('BEGIN');[cite: 6]
        const { id } = req.params;[cite: 6]

        let txData = await client.query('SELECT * FROM transactions WHERE id = $1', [id]);[cite: 6]
        if (txData.rows.length > 0) {[cite: 6]
            let tx = txData.rows[0];[cite: 6]
            if (tx.item_id) {[cite: 6]
                if (tx.type === 'INCOME') {[cite: 6]
                    await client.query(`UPDATE master_items SET stock_quantity = stock_quantity + $1 WHERE id = $2`, [tx.quantity, tx.item_id]);[cite: 6]
                } else if (tx.type === 'EXPENSE') {[cite: 6]
                    await client.query(`UPDATE master_items SET stock_quantity = stock_quantity - $1 WHERE id = $2`, [tx.quantity, tx.item_id]);[cite: 6]
                }
            }
            await client.query('DELETE FROM transactions WHERE id = $1', [id]);[cite: 6]
        }

        await client.query('COMMIT');[cite: 6]
        res.json({ success: true, message: "Transaction deleted successfully!" });[cite: 6]
    } catch (err) {
        await client.query('ROLLBACK');[cite: 6]
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    } finally {
        client.release();[cite: 6]
    }
});

app.post('/api/accounting/reset-all', async (req, res) => {
    const client = await pool.connect();[cite: 6]
    try {
        await client.query('BEGIN');[cite: 6]
        await client.query('DELETE FROM transactions;');[cite: 6]
        await client.query('DELETE FROM master_items;');[cite: 6]
        await client.query('COMMIT');[cite: 6]
        res.json({ success: true, message: "All data cleared successfully from database!" });[cite: 6]
    } catch (err) {
        await client.query('ROLLBACK');[cite: 6]
        res.status(500).json({ success: false, error: err.message });[cite: 6]
    } finally {
        client.release();[cite: 6]
    }
});

// រត់ Server[cite: 6]
const PORT = process.env.PORT || 5000;[cite: 6]
app.listen(PORT, () => {
    console.log(`Accounting API Server is running on port ${PORT}`);[cite: 6]
});
