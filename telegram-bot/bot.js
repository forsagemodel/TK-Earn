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
        db.users[userId] = { active: false, referer: null, dummyBalance: 0, referralHistory: [] };
        saveDatabase(db);
    }

    const webUrl = `${process.env.RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.reply(
        'Welcome! Your account is not activated. Click below to proceed:',
        Markup.inlineKeyboard([
            [Markup.button.url('Open Activation Page', webUrl)]
        ])
    );
});

// Notify the referrer about earnings
const notifyReferrer = (referrerId, userId) => {
    const db = loadDatabase();
    const referer = db.users[referrerId];

    if (referer) {
        referer.dummyBalance += 2;
        referer.referralHistory.push({ earnedFrom: userId, amount: 2 });
        saveDatabase(db);

        bot.telegram.sendMessage(
            referrerId,
            `🎉 You earned $2 from a referral! Total Balance: $${referer.dummyBalance}.`
        );
    }
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
        referralCode: user.active ? userId : null,
        referralHistory: user.referralHistory,
    });
});

app.post('/api/submit-referral', (req, res) => {
    const { userId, referralCode } = req.body;

    const db = loadDatabase();
    const user = db.users[userId];
    const referer = db.users[referralCode];

    if (!user || user.active) {
        return res.json({ success: false, message: 'Invalid or already active user.' });
    }

    if (!referer || !referer.active) {
        return res.json({ success: false, message: 'Invalid referral code.' });
    }

    user.referer = referralCode;
    user.active = true;
    saveDatabase(db);

    // Notify the referrer and update their balance
    notifyReferrer(referralCode, userId);

    res.json({ success: true, message: 'Account activated successfully!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
