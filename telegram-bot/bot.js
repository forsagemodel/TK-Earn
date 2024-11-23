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
        db.users[userId] = { active: false, referer: null, dummyBalance: 0 };
        saveDatabase(db);
    }

    const webUrl = `${process.env.RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.reply(
        'Welcome! Your account is not activated. Click below to proceed:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('Open Activation Page', webUrl)] // WebApp button for inline functionality
        ])
    );
});

bot.launch();

// Backend API Endpoints
app.get('/api/user-status', (req, res) => {
    const userId = req.query.userId;
    const db = loadDatabase();
    const user = db.users[userId];

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ active: user.active, dummyBalance: user.dummyBalance });
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
    saveDatabase(db);

    res.json({ success: true, message: 'Referral code accepted. Proceed with payment!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
