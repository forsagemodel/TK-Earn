require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN; // Bot Token from BotFather
const bot = new Telegraf(BOT_TOKEN);

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static frontend files

// User Database
const dbFile = './db.json';
const loadDatabase = () => JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
const saveDatabase = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
if (!fs.existsSync(dbFile)) saveDatabase({ users: {} });

// Telegram Bot
bot.start((ctx) => {
    const userId = ctx.from.id;

    const db = loadDatabase();
    if (!db.users[userId]) {
        db.users[userId] = { 
            active: false, 
            referer: null, 
            dummyBalance: 0, 
            referralCode: `${userId}`, // Use user ID as referral code
            referralHistory: [] // Track referrals
        };
        saveDatabase(db);
    }

    const webUrl = `${process.env.RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.reply(
        'Welcome! You can earn money:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('Start Earning', webUrl)] // WebApp button for inline functionality
        ])
    );
});

// Notify user of referral earnings
const notifyUser = (userId, amount) => {
    bot.telegram.sendMessage(userId, `🎉 You earned $${amount} from a referral!`);
};

// Backend API Endpoints
app.get('/api/user-status', (req, res) => {
    const userId = req.query.userId;
    const db = loadDatabase();
    const user = db.users[userId];

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ 
        active: user.active, 
        dummyBalance: user.dummyBalance, 
        referralCode: user.referralCode, 
        referralHistory: user.referralHistory 
    });
});

app.post('/api/submit-referral', (req, res) => {
    const { userId, referralCode } = req.body;

    const db = loadDatabase();
    const user = db.users[userId];
    const referer = Object.values(db.users).find(user => user.referralCode === referralCode);

    if (!user || user.active) {
        return res.json({ success: false, message: 'Invalid or already active user.' });
    }

    if (!referer || !referer.active) {
        return res.json({ success: false, message: 'Invalid referral code.' });
    }

    user.referer = referer.referralCode;
    saveDatabase(db);

    res.json({ success: true, message: 'Referral code accepted. Proceed with payment!' });
});

// Payment Activation Endpoint
app.post('/api/activate-account', (req, res) => {
    const { userId } = req.body;

    const db = loadDatabase();
    const user = db.users[userId];

    if (!user || user.active) {
        return res.json({ success: false, message: 'User already activated or invalid user.' });
    }

    // Activate the user
    user.active = true;
    saveDatabase(db);

    // Update referrer's balance and history
    if (user.referer) {
        const referrer = Object.values(db.users).find(u => u.referralCode === user.referer);
        if (referrer) {
            referrer.dummyBalance += 2; // Add $2 to referrer's balance
            referrer.referralHistory.push(userId); // Add user to referral history
            saveDatabase(db);
            notifyUser(referrer.referralCode, 2); // Notify referrer
        }
    }

    res.json({ success: true, message: 'Account activated successfully!' });
});

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

bot.launch();
