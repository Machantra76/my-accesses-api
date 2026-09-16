const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// API សម្រាប់ទទួល Data ពី MS Access (POST)
app.post('/api/users', (req, res) => {
    const { username, role } = req.body;
    
    console.log("---------------------------------");
    console.log("Data received from MS Access:");
    console.log(`Username: ${username}`);
    console.log(`Role: ${role}`);
    console.log("---------------------------------");

    res.status(201).json({
        status: "Success",
        message: "Data received successfully by Web API!",
        data: { username, role }
    });
});

// API សម្រាប់ផ្ញើ Data ទៅ MS Access (GET)
app.get('/api/users', (req, res) => {
    res.status(200).json([
        { id: 1, username: "admin", role: "ADMIN" },
        { id: 2, username: "chantra", role: "SUPERVISOR" }
    ]);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});