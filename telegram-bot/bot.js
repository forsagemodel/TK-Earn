require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Telegraf } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));

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
            referralHistory: [],
            referralCode: null
        };
        saveDatabase(db);
    }

    // Open Web App directly in Telegram
    const webUrl = `${process.env.RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.replyWithHTML(
        `Welcome! <b>Open your dashboard below:</b>`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Open Dashboard', web_app: { url: webUrl } }]
                ]
            }
        }
    );
});

// Endpoint to get user details
app.get('/api/user-details', (req, res) => {
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

// Endpoint to activate account and set referral code
app.post('/api/activate-account', (req, res) => {
    const { userId, referralCode } = req.body;
    const db = loadDatabase();
    const user = db.users[userId];

    if (!user || user.active) {
        return res.json({ success: false, message: 'Invalid or already active user.' });
    }

    if (!referralCode) {
        return res.json({ success: false, message: 'Referral code is required.' });
    }

    const referer = db.users[referralCode];
    if (!referer || !referer.active) {
        return res.json({ success: false, message: 'Invalid referral code.' });
    }

    // Activate account and assign referral code
    user.active = true;
    user.referer = referralCode;
    user.referralCode = String(userId); // Use user ID as referral code
    saveDatabase(db);

    // Add $2 to referer's balance and notify them
    referer.dummyBalance += 2;
    referer.referralHistory.push({
        referredUser: userId,
        amountEarned: 2
    });
    saveDatabase(db);

    bot.telegram.sendMessage(
        referralCode,
        `🎉 You earned $2! Someone used your referral code!`
    );

    res.json({ success: true, message: 'Account activated successfully!' });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
