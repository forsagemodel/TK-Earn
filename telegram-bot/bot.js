require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN; // Bot Token from BotFather
if (!BOT_TOKEN) {
    console.error('BOT_TOKEN is missing in .env file!');
    process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// Load or Initialize Database
const dbFile = './db.json';
const loadDatabase = () => {
    if (fs.existsSync(dbFile)) {
        return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    } else {
        const initialData = { users: {} };
        fs.writeFileSync(dbFile, JSON.stringify(initialData, null, 2));
        return initialData;
    }
};
const saveDatabase = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

// Start Command Handler
bot.start((ctx) => {
    try {
        console.log('Bot received /start command');
        const userId = ctx.from.id;

        // Load database and check user
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
    } catch (error) {
        console.error('Error handling /start command:', error);
        ctx.reply('An error occurred. Please try again later.');
    }
});

// Launch Bot
bot.launch()
    .then(() => console.log('Bot started successfully!'))
    .catch((err) => console.error('Error launching bot:', err));

// Express Setup for Backend
const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static frontend files

// API Endpoints and Logic (unchanged from previous example)
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
    const notifyReferrer = (referrerId, userId) => {
        const db = loadDatabase();
        const referer = db.users[referrerId];
        if (referer) {
            referer.dummyBalance += 2;
            referer.referralHistory.push({ earnedFrom: userId, amount: 2 });
            saveDatabase(db);
            bot.telegram.sendMessage(referrerId, `🎉 You earned $2 from a referral! Total Balance: $${referer.dummyBalance}.`);
        }
    };
    notifyReferrer(referralCode, userId);

    res.json({ success: true, message: 'Account activated successfully!' });
});

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
