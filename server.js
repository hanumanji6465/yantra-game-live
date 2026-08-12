// 🚀 INDIA TIMEZONE FIX
process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());
app.use(express.static(__dirname));

// ==========================================
// 🗄️ DATABASE CONNECTION 
// ==========================================
const DB_LINK = "mongodb://ranjay222_db_user:Ranjay8303@ac-w5tcwg9-shard-00-00.oxuypkt.mongodb.net:27017,ac-w5tcwg9-shard-00-01.oxuypkt.mongodb.net:27017,ac-w5tcwg9-shard-00-02.oxuypkt.mongodb.net:27017/?ssl=true&replicaSet=atlas-k0tlsu-shard-0&authSource=admin&appName=Cluster0"; 

mongoose.connect(DB_LINK, { family: 4, serverSelectionTimeoutMS: 10000 })
    .then(() => console.log("✅ MongoDB Database Connect Ho Gaya!"))
    .catch((err) => console.log("❌ Database Error: ", err.message));

// ==========================================
// 📝 DATABASE SCHEMAS
// ==========================================
const userSchema = new mongoose.Schema({
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
    balance: { type: Number, default: 0 },
    status: { type: String, default: "Active" }
});
const User = mongoose.model('User', userSchema);

const resultSchema = new mongoose.Schema({
    date: String, time: String, nv: String, rr: String, ry: String, ch: String
});
const Result = mongoose.model('Result', resultSchema);

const ticketSchema = new mongoose.Schema({
    phone: String, tickets: Array, totalCost: Number,
    wonAmount: { type: Number, default: 0 }, 
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
        const newUser = new User({ phone, password, role: "user", balance: 0, status: "Active" });
        await newUser.save(); 
        res.json({ success: true, message: "Account Created!" });
    } catch (error) { res.json({ success: false }); }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const user = await User.findOne({ phone });
        if (!user || user.password !== password) return res.json({ success: false, message: "Invalid Phone/Password!" });
        if (user.status === 'Blocked') return res.json({ success: false, message: "🚫 Aapka account Admin dwara BLOCK kar diya gaya hai!" });
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
    let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
    let now = new Date(nowStr);
    let currentMins = now.getHours() * 60 + now.getMinutes();
    
    if (currentMins < 510 || currentMins >= 1380) {
        return res.json({ success: false, message: "❌ Game Band Hai! Khulne ka samay Subah 8:30 se Raat 11:00 baje tak hai." });
    }

    const { phone, totalCost, cartData } = req.body; 
    try {
        const user = await User.findOne({ phone });
        if (!user || user.status === 'Blocked') return res.json({ success: false, message: "User blocked or not found!" });
        if (user.balance < totalCost) return res.json({ success: false, message: "Insufficient Balance!" });
        
        user.balance -= totalCost; await user.save(); 
        const newTicket = new Ticket({ phone, tickets: cartData, totalCost, wonAmount: 0 });
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
        const tickets = await Ticket.find({ phone: req.body.phone, status: { $ne: 'Cancelled' } });
        let totalSpent = 0, todaySpent = 0;
        let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        let today = new Date(nowStr); today.setHours(0, 0, 0, 0);
        tickets.forEach(t => { totalSpent += t.totalCost; if (new Date(t.date) >= today) todaySpent += t.totalCost; });
        res.json({ success: true, totalTickets: tickets.length, todaySpent, totalSpent });
    } catch (error) { res.json({ success: false }); }
});

// 🚀 ADMIN RESULT CONTROL (TIME LOCK KE SATH)
app.post('/api/admin/result', async (req, res) => {
    const { nv, rr, ry, ch, customDate, customTime } = req.body;
    try {
        let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        let d = new Date(nowStr);
        let dd = String(d.getDate()).padStart(2, '0'); let mm = String(d.getMonth() + 1).padStart(2, '0');
        let yyyy = d.getFullYear();
        let finalDate = customDate ? customDate : `${dd}/${mm}/${yyyy}`; 
        let finalTime = customTime;

        let existing = await Result.findOne({ date: finalDate, time: finalTime });
        if (existing) {
            existing.nv = nv; existing.rr = rr; existing.ry = ry; existing.ch = ch; await existing.save();
        } else {
            const newResult = new Result({ date: finalDate, time: finalTime, nv, rr, ry, ch }); await newResult.save();
        }

        let currentMinutes = d.getHours() * 60 + d.getMinutes();
        let timeParts = finalTime.split(':');
        let resultMinutes = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);

        let rParts = finalDate.split('/');
        let rDateObj = new Date(rParts[2], rParts[1] - 1, rParts[0]);
        let todayObj = new Date(yyyy, d.getMonth(), d.getDate());

        // 🔒 TIME LOCK: Agar future time ka result dala gaya hai, toh ticket settle matt karo.
        if (rDateObj > todayObj || (rDateObj.getTime() === todayObj.getTime() && resultMinutes > currentMinutes)) {
            return res.json({ success: true, message: `✅ Advance Result Saved! Waqt aane par automatically logo ko dikhega aur paise milenge.` });
        }

        // Agar purana/current waqt ka hai toh turant settle karo
        const pendingTickets = await Ticket.find({ status: 'Pending' });
        const resultsDict = { "NV": nv, "RR": rr, "RY": ry, "CH": ch };

        for (let ticket of pendingTickets) {
            let totalWinningAmount = 0;
            ticket.tickets.forEach(bet => {
                let winningNumber = resultsDict[bet.group]; 
                if (winningNumber && bet.number.includes("-")) {
                    let winNum = parseInt(winningNumber);
                    let minVal = parseInt(bet.number.split("-")[0]); let maxVal = parseInt(bet.number.split("-")[1]);
                    if (winNum >= minVal && winNum <= maxVal) totalWinningAmount += (bet.points * 100);
                }
            });
            if (totalWinningAmount > 0) {
                ticket.status = 'Won';
                ticket.wonAmount = totalWinningAmount; 
                const user = await User.findOne({ phone: ticket.phone });
                if (user) { user.balance += totalWinningAmount; await user.save(); }
            } else { ticket.status = 'Lost'; ticket.wonAmount = 0; }
            await ticket.save(); 
        }
        res.json({ success: true, message: `✅ Result Saved & Tickets Settled!` });
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

// 🚀 DAILY CYCLE SHIFT WISE PROFIT & LOSS (8:30 AM to 8:00 AM)
app.get('/api/admin/profit-loss', async (req, res) => {
    try {
        let now = new Date();
        
        // India Time (IST) nikalne ka sabse safe tarika
        let options = { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false };
        let formatter = new Intl.DateTimeFormat('en-US', options);
        let parts = formatter.formatToParts(now);
        let p = {};
        parts.forEach(part => p[part.type] = part.value);
        
        let currentTotalMins = parseInt(p.hour) * 60 + parseInt(p.minute);

        // Shift ke Start aur End ka waqt set kar rahe hain
        let shiftStartIST = new Date(`${p.year}-${p.month}-${p.day}T08:30:00+05:30`);
        let shiftEndIST = new Date(`${p.year}-${p.month}-${p.day}T08:00:00+05:30`);

        if (currentTotalMins < 480) { 
            // Raat 12:00 se Subah 8:00 baje tak (Pichhle din ki shift chal rahi hai)
            shiftStartIST.setDate(shiftStartIST.getDate() - 1);
        } else if (currentTotalMins >= 480 && currentTotalMins < 510) { 
            // ⚠️ Subah 8:00 se 8:30 baje tak (RESET TIME - Yahan sab 0 ho jayega)
            return res.json({ success: true, totalBets: 0, totalWins: 0, netProfit: 0 });
        } else { 
            // Subah 8:30 se Raat 12:00 baje tak (Aaj ki naye shift)
            shiftEndIST.setDate(shiftEndIST.getDate() + 1);
        }

        // Database se sirf is particular shift ke tickets nikalenge
        const tickets = await Ticket.find({ 
            status: { $ne: 'Cancelled' },
            date: { $gte: shiftStartIST, $lte: shiftEndIST } 
        });

        let totalBets = 0, totalWins = 0;
        
        tickets.forEach(t => {
            totalBets += (t.totalCost || 0); 
            totalWins += (t.wonAmount || 0);
        });

        let netProfit = totalBets - totalWins; 
        
        // Final hisab bhejo
        res.json({ success: true, totalBets, totalWins, netProfit });
    } catch(e) { 
        res.json({ success: false }); 
    }
});

app.post('/api/admin/toggle-block', async (req, res) => {
    try {
        const user = await User.findOne({ phone: req.body.phone });
        if(!user) return res.json({ success: false, message: "User nahi mila!" });
        user.status = user.status === 'Blocked' ? 'Active' : 'Blocked';
        await user.save();
        res.json({ success: true, message: `User ID ${user.phone} ab ${user.status} ho gaya hai.` });
    } catch (error) { res.json({ success: false }); }
});

// 🚀 RESULTS API (HIDE FUTURE RESULTS FROM USERS)
app.post('/api/results', async (req, res) => {
    try {
        let query = req.body.date ? { date: req.body.date } : {}; 
        const results = await Result.find(query).sort({ _id: -1 }).limit(100);

        let nowStr = new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"});
        let d = new Date(nowStr);
        let currentMinutes = d.getHours() * 60 + d.getMinutes();
        let yyyy = d.getFullYear();

        // 🔒 TIME LOCK: Agar slot ka waqt nahi aaya hai toh user ko number nahi dikhega
        let safeResults = results.map(r => {
            let rTimeParts = r.time.split(':');
            let rMinutes = parseInt(rTimeParts[0]) * 60 + parseInt(rTimeParts[1]);
            
            let rDateParts = r.date.split('/');
            let rDateObj = new Date(rDateParts[2], rDateParts[1] - 1, rDateParts[0]);
            let todayObj = new Date(yyyy, d.getMonth(), d.getDate());

            // Agar future date hai, ya aaj ki date hai par future time hai
            if (rDateObj > todayObj || (rDateObj.getTime() === todayObj.getTime() && rMinutes > currentMinutes)) {
                // Result empty bhejo (Frontend apne aap '-' dikhayega)
                return { date: r.date, time: r.time, nv: '', rr: '', ry: '', ch: '' }; 
            }
            return r; // Waqt ho gaya hai, normal result bhejo
        });

        res.json({ success: true, results: safeResults });
    } catch (error) { res.json({ success: false }); }
});

// 🚀 POINTS MODIFY API (WITH PASSWORD SECURITY)
app.post('/api/admin/modify-points', async (req, res) => {
    const { targetPhone, points, action, adminPin } = req.body;
    
    // 🔒 YAHAN APNA SECRET ADMIN PASSWORD SET KAREIN
    const SECRET_PASSWORD = "123456"; 

    if (adminPin !== SECRET_PASSWORD) {
        return res.json({ success: false, message: "❌ Galat Password! Access Denied." });
    }

    try {
        const user = await User.findOne({ phone: targetPhone });
        if (!user) return res.json({ success: false, message: "User nahi mila!" });
        
        let amount = parseFloat(points);
        if (action === 'add') {
            user.balance += amount;
        } else if (action === 'deduct') { 
            if (user.balance < amount) return res.json({ success: false, message: "Insufficient balance!" }); 
            user.balance -= amount; 
        }
        
        await user.save(); 
        res.json({ success: true, newBalance: user.balance, message: `✅ Points update ho gaye!` });
    } catch (error) { 
        res.json({ success: false, message: "Server error!" }); 
    }
});

// 🚀 NAYA: DELETE USER API (WITH PASSWORD SECURITY)
app.post('/api/admin/delete-user', async (req, res) => {
    const { phone, adminPin } = req.body;
    
    // 🔒 YAHAN APNA SECRET ADMIN PASSWORD SET KAREIN
    const SECRET_PASSWORD = "123456"; 

    if (adminPin !== SECRET_PASSWORD) {
        return res.json({ success: false, message: "❌ Galat Password! Access Denied." });
    }

    try {
        const deletedUser = await User.findOneAndDelete({ phone: phone });
        if (!deletedUser) {
            return res.json({ success: false, message: "User nahi mila!" });
        }
        res.json({ success: true, message: `✅ User ID ${phone} hamesha ke liye Delete ho gaya!` });
    } catch (error) {
        res.json({ success: false, message: "Server error!" });
    }
});

app.post('/api/deposit', async (req, res) => {
    try { await new Deposit(req.body).save(); res.json({ success: true, message: "Request Bhej Di Gayi Hai!" }); } catch (error) { res.json({ success: false }); }
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
    try { res.json({ success: true, users: await User.find({ role: 'user' }).sort({ _id: -1 }) }); } catch (error) { res.json({ success: false }); }
});

// 🚀 AUTO-SETTLE SCRIPT (Jo theek waqt par tickets settle karegi)
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
                // Time aa gaya hai, ab advance save kiye hue result par tickets ko won/loss karo
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
                            if (winNum >= minVal && winNum <= maxVal) totalWinningAmount += (bet.points * 100); 
                        }
                    });
                    if (totalWinningAmount > 0) {
                        ticket.status = 'Won';
                        ticket.wonAmount = totalWinningAmount;
                        const user = await User.findOne({ phone: ticket.phone });
                        if (user) { user.balance += totalWinningAmount; await user.save(); }
                    } else { ticket.status = 'Lost'; ticket.wonAmount = 0; }
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
