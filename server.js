const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 🗄️ ASLI DATABASE CONNECTION (MongoDB Cloud)
// ==========================================
const DB_LINK = "mongodb://ranjay222_db_user:Ranjay8303@ac-w5tcwg9-shard-00-00.oxuypkt.mongodb.net:27017,ac-w5tcwg9-shard-00-01.oxuypkt.mongodb.net:27017,ac-w5tcwg9-shard-00-02.oxuypkt.mongodb.net:27017/?ssl=true&replicaSet=atlas-k0tlsu-shard-0&authSource=admin&appName=Cluster0"; 

mongoose.connect(DB_LINK, { family: 4, serverSelectionTimeoutMS: 10000 })
    .then(() => console.log("✅ MongoDB Asli Database Connect Ho Gaya!"))
    .catch((err) => console.log("❌ Database Error: ", err.message));

// ==========================================
// 📝 DATABASE SCHEMAS
// ==========================================
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    balance: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const resultSchema = new mongoose.Schema({
    time: String, nv: String, rr: String, ry: String, ch: String
});
const Result = mongoose.model('Result', resultSchema);

const ticketSchema = new mongoose.Schema({
    phone: String, tickets: Array, totalCost: Number,
    date: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' } 
});
const Ticket = mongoose.model('Ticket', ticketSchema);

const depositSchema = new mongoose.Schema({
    phone: String, amount: Number, utr: String,
    status: { type: String, default: 'Pending' }, date: { type: Date, default: Date.now }
});
const Deposit = mongoose.model('Deposit', depositSchema);

const withdrawSchema = new mongoose.Schema({
    phone: String, amount: Number, bankDetails: String,
    status: { type: String, default: 'Pending' }, date: { type: Date, default: Date.now }
});
const Withdraw = mongoose.model('Withdraw', withdrawSchema);

// ==========================================
// 🌐 API ROUTES 
// ==========================================

app.post('/api/register', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const existingUser = await User.findOne({ phone: phone });
        if (existingUser) return res.json({ success: false, message: "User ID already exists!" });
        const newUser = new User({ phone, password, role: "user", balance: 0 });
        await newUser.save(); 
        res.json({ success: true, message: "Account Created! Please Login." });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ phone: phone });
        if (!user || user.password !== password) return res.json({ success: false, message: "Invalid Phone or Password!" });
        res.json({ success: true, role: user.role, balance: user.balance });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

app.post('/api/get-balance', async (req, res) => {
    const { phone } = req.body;
    try {
        const user = await User.findOne({ phone: phone });
        if (user) { res.json({ success: true, balance: user.balance }); } 
        else { res.json({ success: false }); }
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/buy', async (req, res) => {
    const { phone, totalCost, cartData } = req.body; 
    try {
        const user = await User.findOne({ phone: phone });
        if (!user) return res.json({ success: false, message: "User not found!" });
        if (user.balance < totalCost) return res.json({ success: false, message: "Insufficient Balance!" });
        user.balance -= totalCost; await user.save(); 
        const newTicket = new Ticket({ phone: phone, tickets: cartData, totalCost: totalCost });
        await newTicket.save();
        res.json({ success: true, newBalance: user.balance, message: "Tickets Purchased Successfully!" });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

// --- CANCEL TICKET API (UPDATED FOR MONGODB) ---
app.post('/api/cancel', async (req, res) => {
    const { phone } = req.body;
    try {
        // 1. Asli MongoDB Database se User ko dhundo
        let user = await User.findOne({ phone: phone });
        if (!user) {
            return res.json({ success: false, message: "User nahi mila!" });
        }

        // 2. Database se is user ki aakhiri (latest) ticket nikalo (date ke hisaab se reverse sort karke)
        let lastTicket = await Ticket.findOne({ phone: phone }).sort({ date: -1 });
        
        if (!lastTicket) {
            return res.json({ success: false, message: "Aapne abhi tak koi ticket nahi kharidi hai!" });
        }

        // 3. Agar ticket pehle hi cancel ho chuki hai
        if (lastTicket.status === 'Cancelled') {
            return res.json({ success: false, message: "Aakhiri ticket pehle se hi cancel ho chuki hai!" });
        }

        // 4. User ke account me paise wapas dalo
        user.balance += lastTicket.totalCost;
        await user.save(); // User ka naya balance database me save karo

        // 5. Ticket ka status 'Cancelled' kar do
        lastTicket.status = 'Cancelled';
        await lastTicket.save(); // Ticket ka naya status database me save karo

        res.json({ 
            success: true, 
            newBalance: user.balance, 
            message: "Aakhiri ticket successfully cancel ho gayi aur paise wallet me wapas aa gaye!" 
        });
    } catch (error) {
        console.log("Cancel API Error:", error);
        res.json({ success: false, message: "Server error" });
    }
});

app.post('/api/history', async (req, res) => {
    const { phone } = req.body;
    try {
        const tickets = await Ticket.find({ phone: phone }).sort({ date: -1 }).limit(20);
        res.json({ success: true, tickets });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

// 🚀 NAYA API: P.SUM (Purchase Summary) Ke Liye
app.post('/api/purchase-summary', async (req, res) => {
    const { phone } = req.body;
    try {
        const tickets = await Ticket.find({ phone: phone });
        let totalSpent = 0;
        let todaySpent = 0;
        let totalTickets = tickets.length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        tickets.forEach(t => {
            totalSpent += t.totalCost;
            if (new Date(t.date) >= today) {
                todaySpent += t.totalCost;
            }
        });

        res.json({ success: true, totalTickets, todaySpent, totalSpent });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

app.post('/api/admin/result', async (req, res) => {
    const { nv, rr, ry, ch } = req.body;
    try {
        const newResult = new Result({ time: new Date().toLocaleTimeString(), nv, rr, ry, ch });
        await newResult.save();

        const pendingTickets = await Ticket.find({ status: 'Pending' });
        const resultsDict = { "NV": nv, "RR": rr, "RY": ry, "CH": ch };

        for (let ticket of pendingTickets) {
            let totalWinningAmount = 0;
            ticket.tickets.forEach(bet => {
                let winningNumber = resultsDict[bet.group]; 
                if (winningNumber && bet.number.includes("-")) {
                    let winNum = parseInt(winningNumber);
                    let min = parseInt(bet.number.split("-")[0]);
                    let max = parseInt(bet.number.split("-")[1]);
                    if (winNum >= min && winNum <= max) totalWinningAmount += (bet.points * 9);
                }
            });

            if (totalWinningAmount > 0) {
                ticket.status = 'Won';
                const user = await User.findOne({ phone: ticket.phone });
                if (user) { user.balance += totalWinningAmount; await user.save(); }
            } else { ticket.status = 'Lost'; }
            await ticket.save(); 
        }
        res.json({ success: true, message: "Result Declared & Winners Paid Automatically!" });
    } catch (error) { res.json({ success: false, message: "Server error" }); }
});

app.get('/api/results', async (req, res) => {
    try {
        const results = await Result.find().sort({ _id: -1 }).limit(10);
        res.json({ success: true, results });
    } catch (error) { res.json({ success: false }); }
});

app.get('/api/admin/live-bets', async (req, res) => {
    try {
        const pendingTickets = await Ticket.find({ status: 'Pending' });
        let liveData = { "NV": {}, "RR": {}, "RY": {}, "CH": {} };
        pendingTickets.forEach(ticket => {
            ticket.tickets.forEach(bet => {
                if(liveData[bet.group]) {
                    if(!liveData[bet.group][bet.number]) liveData[bet.group][bet.number] = 0;
                    liveData[bet.group][bet.number] += bet.points;
                }
            });
        });
        res.json({ success: true, liveData });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/admin/modify-points', async (req, res) => {
    const { targetPhone, points, action } = req.body;
    try {
        const user = await User.findOne({ phone: targetPhone });
        if (!user) return res.json({ success: false, message: "User nahi mila!" });
        let amount = parseFloat(points);
        if (action === 'add') user.balance += amount;
        else if (action === 'deduct') {
            if (user.balance < amount) return res.json({ success: false, message: "Insufficient balance!" });
            user.balance -= amount;
        }
        await user.save(); 
        res.json({ success: true, newBalance: user.balance, message: `Points ${action}ed!` });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/deposit', async (req, res) => {
    const { phone, amount, utr } = req.body;
    try {
        const newDeposit = new Deposit({ phone, amount, utr });
        await newDeposit.save();
        res.json({ success: true, message: "Request Bhej Di Gayi Hai!" });
    } catch (error) { res.json({ success: false }); }
});

app.get('/api/admin/pending-deposits', async (req, res) => {
    try { res.json({ success: true, deposits: await Deposit.find({ status: 'Pending' }) });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/admin/handle-deposit', async (req, res) => {
    const { depositId, action } = req.body; 
    try {
        const deposit = await Deposit.findById(depositId);
        if (!deposit || deposit.status !== 'Pending') return res.json({ success: false });
        deposit.status = action; await deposit.save();
        if (action === 'Approved') {
            const user = await User.findOne({ phone: deposit.phone });
            if (user) { user.balance += deposit.amount; await user.save(); }
        }
        res.json({ success: true, message: `Payment ${action}!` });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/withdraw', async (req, res) => {
    const { phone, amount, bankDetails } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user) return res.json({ success: false, message: "User nahi mila!" });
        if (user.balance < amount) return res.json({ success: false, message: "Balance kam hai!" });
        user.balance -= amount; await user.save();
        const newWithdraw = new Withdraw({ phone, amount, bankDetails });
        await newWithdraw.save();
        res.json({ success: true, newBalance: user.balance, message: "Withdrawal request bheji gayi!" });
    } catch (error) { res.json({ success: false, message: "Error" }); }
});

app.get('/api/admin/pending-withdrawals', async (req, res) => {
    try { res.json({ success: true, withdrawals: await Withdraw.find({ status: 'Pending' }) });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/admin/handle-withdrawal', async (req, res) => {
    const { withdrawId, action } = req.body;
    try {
        const request = await Withdraw.findById(withdrawId);
        if (!request || request.status !== 'Pending') return res.json({ success: false, message: "Pehle hi process ho chuka hai." });
        request.status = action; await request.save();
        if (action === 'Rejected') {
            const user = await User.findOne({ phone: request.phone });
            if (user) { user.balance += request.amount; await user.save(); }
        }
        res.json({ success: true, message: `Withdrawal ${action} kar diya gaya!` });
    } catch (error) { res.json({ success: false }); }
});

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.listen(3000, () => {
    console.log("=======================================");
    console.log("🚀 YANTRA GAME SERVER IS RUNNING!");
    console.log("=======================================");
});
