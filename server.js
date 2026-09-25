const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ទិន្នន័យគំរូក្នុងអង្គចងចាំ (In-Memory Database Mockup)
let shippingLines = [
    { id: 1, name: 'MAERSK' },
    { id: 2, name: 'MSC' },
    { id: 3, name: 'CMA CGM' }
];

let locations = [
    { id: 1, name: 'Depot A - Phnom Penh' },
    { id: 2, name: 'Depot B - Sihanoukville' }
];

let containers = [
    { id: 1, containerNo: 'MSKU1234567', type: '40HC', status: 'Available', locationId: 1, shippingLineId: 1 }
];

let containerRepairs = [
    { id: 1, containerNo: 'MSKU1234567', damageType: 'Dent', cost: 150, status: 'Pending' }
];

let accountingRecords = [
    { id: 1, type: 'Income', description: 'Container Lift-on/Lift-off', amount: 50, date: '2026-06-01' },
    { id: 2, type: 'Expense', description: 'Repair Cost MSKU1234567', amount: 150, date: '2026-06-02' }
];

let activityLogs = [];

// ==========================================
// 1. DATABASE RESET ROUTE
// ==========================================
app.post('/api/reset-database', (req, res) => {
    shippingLines = [];
    locations = [];
    containers = [];
    containerRepairs = [];
    accountingRecords = [];
    activityLogs = [];
    res.json({ success: true, message: 'Database has been reset successfully.' });
});

// ==========================================
// 2. SHIPPING LINES ROUTES
// ==========================================
app.get('/api/shipping-lines', (req, res) => {
    res.json(shippingLines);
});

app.post('/api/shipping-lines', (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    shippingLines.push(newItem);
    res.status(201).json(newItem);
});

// ==========================================
// 3. LOCATIONS ROUTES
// ==========================================
app.get('/api/locations', (req, res) => {
    res.json(locations);
});

app.post('/api/locations', (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    locations.push(newItem);
    res.status(201).json(newItem);
});

// ==========================================
// 4. CONTAINERS ROUTES
// ==========================================
app.get('/api/containers', (req, res) => {
    res.json(containers);
});

app.post('/api/containers', (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    containers.push(newItem);
    res.status(201).json(newItem);
});

app.get('/api/containers/repair-list', (req, res) => {
    const repairContainers = containers.filter(c => c.status === 'Repair');
    res.json(repairContainers);
});

// ==========================================
// 5. CONTAINER REPAIRS ROUTES
// ==========================================
app.get('/api/container-repairs', (req, res) => {
    res.json(containerRepairs);
});

app.post('/api/container-repairs', (req, res) => {
    const newItem = { id: Date.now(), ...req.body };
    containerRepairs.push(newItem);
    res.status(201).json(newItem);
});

// ==========================================
// 6. ACCOUNTING ROUTES (បន្ថែមថ្មីដើម្បីแก้ Error 404)
// ==========================================
app.get('/api/accounting', (req, res) => {
    res.json(accountingRecords);
});

app.get('/api/accounting/summary', (req, res) => {
    const totalIncome = accountingRecords
        .filter(r => r.type === 'Income')
        .reduce((sum, r) => sum + r.amount, 0);
    
    const totalExpense = accountingRecords
        .filter(r => r.type === 'Expense')
        .reduce((sum, r) => sum + r.amount, 0);

    res.json({
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense
    });
});

app.post('/api/accounting', (req, res) => {
    const newRecord = { id: Date.now(), ...req.body };
    accountingRecords.push(newRecord);
    res.status(201).json(newRecord);
});

// ==========================================
// 7. ACTIVITY LOG ROUTES
// ==========================================
app.get('/api/activity-log', (req, res) => {
    res.json(activityLogs);
});

app.post('/api/activity-log', (req, res) => {
    const log = { id: Date.now(), timestamp: new Date(), ...req.body };
    activityLogs.push(log);
    res.status(201).json(log);
});

// ==========================================
// START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`Server is running smoothly on port ${PORT}`);
});
