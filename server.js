// 🚀 INDIA TIMEZONE FIX
process.env.TZ = 'Asia/Kolkata';

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
    .then(() => {
        console.log("✅ MongoDB Asli Database Connect Ho Gaya!");
    })
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
    date: String, time: String, nv: String, rr: String, ry: String, ch: String
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
        const existingUser = await User.findOne({ phone });
        if (existingUser) return res.json({ success: false, message: "User ID already exists!" });
        const newUser = new User({ phone, password, role: "user", balance: 0 });
        await newUser.save(); 
        res.json({ success: true, message: "Account Created! Please Login." });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user || user.password !== password) return res.json({ success: false, message: "Invalid Phone/Password!" });
        res.json({ success: true, role: user.role, balance: user.balance });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/get-balance', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone });
        res.json(user ? { success: true, balance: user.balance } : { success: false });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/buy', async (req, res) => {
    // 🚀 TIME LOCK SECURITY SYSTEM
    let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    let now = new Date(nowStr);
    let currentMins = now.getHours() * 60 + now.getMinutes();
    
    // Subah 8:30 (510 minutes) se Raat 11:00 (1380 minutes) tak ka Time Lock
    if (currentMins < 510 || currentMins >= 1380) {
        return res.json({ success: false, message: "❌ Game Band Hai! Khulne ka samay Subah 8:30 se Raat 11:00 baje tak hai." });
    }

    const { phone, totalCost, cartData } = req.body; 
    try {
        const user = await User.findOne({ phone });
        if (!user) return res.json({ success: false, message: "User not found!" });
        if (user.balance < totalCost) return res.json({ success: false, message: "Insufficient Balance!" });
        user.balance -= totalCost; await user.save(); 
        const newTicket = new Ticket({ phone, tickets: cartData, totalCost });
        await newTicket.save();
        res.json({ success: true, newBalance: user.balance, message: "Tickets Purchased Successfully!" });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/cancel', async (req, res) => {
    try {
        let user = await User.findOne({ phone: req.body.phone });
        let lastTicket = await Ticket.findOne({ phone: req.body.phone }).sort({ date: -1 });
        if (!lastTicket) return res.json({ success: false, message: "Koi ticket nahi mili!" });
        if (lastTicket.status === 'Cancelled') return res.json({ success: false, message: "Pehle hi cancel ho chuki hai!" });

        user.balance += lastTicket.totalCost; await user.save();
        lastTicket.status = 'Cancelled'; await lastTicket.save();
        res.json({ success: true, newBalance: user.balance, message: "Ticket cancel ho gayi!" });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/history', async (req, res) => {
    try {
        const tickets = await Ticket.find({ phone: req.body.phone }).sort({ date: -1 });
        res.json({ success: true, tickets });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/purchase-summary', async (req, res) => {
    try {
        const tickets = await Ticket.find({ phone: req.body.phone });
        let totalSpent = 0, todaySpent = 0;
        
        let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        let today = new Date(nowStr); today.setHours(0, 0, 0, 0);
        
        tickets.forEach(t => { totalSpent += t.totalCost; if (new Date(t.date) >= today) todaySpent += t.totalCost; });
        res.json({ success: true, totalTickets: tickets.length, todaySpent, totalSpent });
    } catch (error) { res.json({ success: false }); }
});

// 🚀 ADMIN RESULT CONTROL (Prize money updated to 90 multiplier)
app.post('/api/admin/result', async (req, res) => {
    const { nv, rr, ry, ch, customDate, customTime } = req.body;
    try {
        let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        let d = new Date(nowStr);
        let dd = String(d.getDate()).padStart(2, '0'); let mm = String(d.getMonth() + 1).padStart(2, '0');
        let finalDate = customDate ? customDate : `${dd}/${mm}/${d.getFullYear()}`; 
        
        let finalTime = customTime;
        if (!finalTime) {
            let hh = String(d.getHours()).padStart(2, '0');
            let mns = d.getMinutes();
            let slotMns = String(mns - (mns % 15)).padStart(2, '0');
            finalTime = `${hh}:${slotMns}`;
        }

        let existing = await Result.findOne({ date: finalDate, time: finalTime });
        if (existing) {
            existing.nv = nv; existing.rr = rr; existing.ry = ry; existing.ch = ch;
            await existing.save();
        } else {
            const newResult = new Result({ date: finalDate, time: finalTime, nv, rr, ry, ch });
            await newResult.save();
        }

        let isFuture = false;
        let currentMinutes = d.getHours() * 60 + d.getMinutes();
        let timeParts = finalTime.split(':');
        let resultMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

        if (finalDate === `${dd}/${mm}/${d.getFullYear()}` && resultMinutes > currentMinutes) {
            isFuture = true;
        }

        if (isFuture) {
            return res.json({ success: true, message: `✅ Advance Result Saved for Time: ${finalTime}.\nJab time aayega, tabhi result game me dikhega!` });
        }

        const pendingTickets = await Ticket.find({ status: 'Pending' });
        const resultsDict = { "NV": nv, "RR": rr, "RY": ry, "CH": ch };

        for (let ticket of pendingTickets) {
            let totalWinningAmount = 0;
            ticket.tickets.forEach(bet => {
                let winningNumber = resultsDict[bet.group]; 
                if (winningNumber && bet.number.includes("-")) {
                    let winNum = parseInt(winningNumber);
                    let minVal = parseInt(bet.number.split("-")[0]); let maxVal = parseInt(bet.number.split("-")[1]);
                    // 🚀 CHANGED TO 90
                    if (winNum >= minVal && winNum <= maxVal) totalWinningAmount += (bet.points * 90);
                }
            });
            if (totalWinningAmount > 0) {
                ticket.status = 'Won';
                const user = await User.findOne({ phone: ticket.phone });
                if (user) { user.balance += totalWinningAmount; await user.save(); }
            } else { ticket.status = 'Lost'; }
            await ticket.save(); 
        }
        res.json({ success: true, message: `✅ Result Saved & Tickets Settled for Time: ${finalTime}` });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/results', async (req, res) => {
    try {
        let query = req.body.date ? { date: req.body.date } : {}; 
        const results = await Result.find(query).sort({ _id: -1 }).limit(100);
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
    try {
        const user = await User.findOne({ phone: req.body.targetPhone });
        if (!user) return res.json({ success: false, message: "User nahi mila!" });
        let amount = parseFloat(req.body.points);
        if (req.body.action === 'add') user.balance += amount;
        else if (req.body.action === 'deduct') { if (user.balance < amount) return res.json({ success: false, message: "Insufficient balance!" }); user.balance -= amount; }
        await user.save(); 
        res.json({ success: true, newBalance: user.balance, message: `Points update ho gaye!` });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/deposit', async (req, res) => {
    try {
        await new Deposit(req.body).save();
        res.json({ success: true, message: "Request Bhej Di Gayi Hai!" });
    } catch (error) { res.json({ success: false }); }
});
app.get('/api/admin/pending-deposits', async (req, res) => { res.json({ success: true, deposits: await Deposit.find({ status: 'Pending' }) }); });
app.post('/api/admin/handle-deposit', async (req, res) => {
    try {
        const deposit = await Deposit.findById(req.body.depositId);
        if (!deposit || deposit.status !== 'Pending') return res.json({ success: false });
        deposit.status = req.body.action; await deposit.save();
        if (req.body.action === 'Approved') {
            const user = await User.findOne({ phone: deposit.phone });
            if (user) { user.balance += deposit.amount; await user.save(); }
        }
        res.json({ success: true, message: `Payment ${req.body.action}!` });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/withdraw', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone });
        if (user.balance < req.body.amount) return res.json({ success: false, message: "Balance kam hai!" });
        user.balance -= req.body.amount; await user.save();
        await new Withdraw(req.body).save();
        res.json({ success: true, message: "Withdrawal request bheji gayi!" });
    } catch (error) { res.json({ success: false }); }
});
app.get('/api/admin/pending-withdrawals', async (req, res) => { res.json({ success: true, withdrawals: await Withdraw.find({ status: 'Pending' }) }); });
app.post('/api/admin/handle-withdrawal', async (req, res) => {
    try {
        const request = await Withdraw.findById(req.body.withdrawId);
        if (!request || request.status !== 'Pending') return res.json({ success: false });
        request.status = req.body.action; await request.save();
        if (req.body.action === 'Rejected') {
            const user = await User.findOne({ phone: request.phone });
            if (user) { user.balance += request.amount; await user.save(); }
        }
        res.json({ success: true, message: `Withdrawal ${req.body.action} ho gaya!` });
    } catch (error) { res.json({ success: false }); }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).sort({ _id: -1 });
        res.json({ success: true, users });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/admin/delete-user', async (req, res) => {
    try {
        const deletedUser = await User.findOneAndDelete({ phone: req.body.phone });
        if (deletedUser) {
            res.json({ success: true, message: `User ID ${req.body.phone} hamesha ke liye delete kar diya gaya hai.` });
        } else {
            res.json({ success: false, message: "User nahi mila." });
        }
    } catch (error) {
        res.json({ success: false, message: "Server error" });
    }
});

let aakhiriAutoSlot = ""; 
setInterval(async () => {
    let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    let now = new Date(nowStr);
    
    let min = now.getMinutes();
    let lastSlotMinutes = min - (min % 15);
    
    let hh = String(now.getHours()).padStart(2, '0');
    let mm = String(lastSlotMinutes).padStart(2, '0');
    let currentSlotTime = `${hh}:${mm}`; 
    
    let dd = String(now.getDate()).padStart(2, '0');
    let mo = String(now.getMonth() + 1).padStart(2, '0');
    let yyyy = now.getFullYear();
    let todayStr = `${dd}/${mo}/${yyyy}`;
    
    let uniqueSlotCheck = todayStr + " " + currentSlotTime;

    if (aakhiriAutoSlot !== uniqueSlotCheck) {
        try {
            let existingResult = await Result.findOne({ date: todayStr, time: currentSlotTime });
            
            if (existingResult) {
                const pendingTickets = await Ticket.find({ status: 'Pending' });
                const resultsDict = { "NV": existingResult.nv, "RR": existingResult.rr, "RY": existingResult.ry, "CH": existingResult.ch };

                for (let ticket of pendingTickets) {
                    let totalWinningAmount = 0;
                    ticket.tickets.forEach(bet => {
                        let winningNumber = resultsDict[bet.group]; 
                        if (winningNumber && bet.number.includes("-")) {
                            let winNum = parseInt(winningNumber);
                            let minVal = parseInt(bet.number.split("-")[0]);
                            let maxVal = parseInt(bet.number.split("-")[1]);
                            // 🚀 CHANGED TO 90
                            if (winNum >= minVal && winNum <= maxVal) totalWinningAmount += (bet.points * 90); 
                        }
                    });
                    if (totalWinningAmount > 0) {
                        ticket.status = 'Won';
                        const user = await User.findOne({ phone: ticket.phone });
                        if (user) { user.balance += totalWinningAmount; await user.save(); }
                    } else { ticket.status = 'Lost'; }
                    await ticket.save(); 
                }
                aakhiriAutoSlot = uniqueSlotCheck; 
            }
        } catch (err) {}
    }
}, 5000);

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'login.html')); });
app.listen(3000, () => {
    console.log("=======================================");
    console.log("🚀 YANTRA GAME SERVER IS RUNNING!");
    console.log("=======================================");
});
