require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN; // Bot Token from BotFather
const CALLBACK_URL = process.env.CALLBACK_URL; // Callback URL for Cryptonomus
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
        db.users[userId] = { active: false, referer: null, dummyBalance: 0, referrals: [] };
        saveDatabase(db);
    }

    const webUrl = `${process.env.RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.reply(
        'Welcome! You can earn money:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('Start Bot', webUrl)] // WebApp button for inline functionality
        ])
    );
});

// Notify the referrer about earnings
const notifyReferrer = (referrerId, amount) => {
    bot.telegram.sendMessage(referrerId, `🎉 You earned $${amount} from a referral!`);
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
        referrals: user.referrals,
        referralCode: user.active ? userId : null,
    });
});

app.post('/api/create-payment', (req, res) => {
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

    // Generate a Cryptonomus payment link
    const cryptonomusPaymentUrl = `https://cryptonomus.com/pay?amount=3&currency=USDT&callback_url=${CALLBACK_URL}&custom_field=userId=${userId},referralCode=${referralCode}`;

    res.json({ success: true, paymentUrl: cryptonomusPaymentUrl });
});

// Cryptonomus Payment Callback
app.post('/payment-callback', (req, res) => {
    const { amount, custom_field } = req.body;

    // Parse custom fields
    const params = Object.fromEntries(
        custom_field.split(',').map((pair) => pair.split('=').map(decodeURIComponent))
    );
    const { userId, referralCode } = params;

    const db = loadDatabase();
    const user = db.users[userId];
    const referer = db.users[referralCode];

    if (amount !== '3' || !user || user.active || !referer || !referer.active) {
        return res.status(400).json({ message: 'Invalid payment or user data.' });
    }

    // Activate the user's account
    user.active = true;
    user.referer = referralCode;

    // Add referral bonus to the referrer
    referer.dummyBalance += 2;
    referer.referrals.push(userId);

    saveDatabase(db);

    // Notify the referrer
    notifyReferrer(referralCode, 2);

    res.json({ success: true });
});

app.post('/api/activate-account', (req, res) => {
    const { userId } = req.body;

    const db = loadDatabase();
    const user = db.users[userId];

    if (!user || user.active) {
        return res.json({ success: false, message: 'Invalid or already active user.' });
    }

    user.active = true;
    const referrerId = user.referer;

    if (referrerId) {
        const referrer = db.users[referrerId];
        referrer.dummyBalance += 2; // Add $2 to referrer balance
        referrer.referrals.push(userId); // Add to referral history
        saveDatabase(db);
        notifyReferrer(referrerId, 2); // Notify referrer via Telegram
    } else {
        saveDatabase(db);
    }

    res.json({ success: true, message: 'Account activated successfully!' });
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

bot.launch();
