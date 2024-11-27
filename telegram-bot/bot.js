require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios'); // For API calls

// Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN; // Telegram Bot Token
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY; // NOWPayments API Key
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL; // Render App External URL

// Initialize Telegram Bot
const bot = new Telegraf(BOT_TOKEN);

// Initialize Express Server
const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files if needed

// User Database Management
const dbFile = './db.json';
const loadDatabase = () => JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
const saveDatabase = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
if (!fs.existsSync(dbFile)) saveDatabase({ users: {} }); // Initialize database if not present

// Telegram Bot Commands
bot.start((ctx) => {
    const userId = ctx.from.id;

    const db = loadDatabase();
    if (!db.users[userId]) {
        db.users[userId] = { active: false, referer: null, dummyBalance: 0, referrals: [] };
        saveDatabase(db);
    }

    const webUrl = `${RENDER_EXTERNAL_URL}?userId=${userId}`;
    ctx.reply(
        'Welcome! You can earn money:',
        Markup.inlineKeyboard([
            [Markup.button.webApp('Start Bot', webUrl)] // Button to open web app
        ])
    );
});

// Notify Referrer About Earnings
const notifyReferrer = (referrerId, amount) => {
    bot.telegram.sendMessage(referrerId, `🎉 You earned $${amount} from a referral!`);
};

// API Endpoints

// Create Payment
app.post('/api/create-payment', async (req, res) => {
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

    try {
        // Create payment using NOWPayments API
        const response = await axios.post(
            'https://api.nowpayments.io/v1/full-currencies',
            {
                price_amount: 10, // Amount in USD
                price_currency: 'USD',
                pay_currency: 'BTC', // Cryptocurrency for payment
                order_id: `${userId}_${referralCode}`, // Order ID for tracking
                ipn_callback_url: `${RENDER_EXTERNAL_URL}/api/payment-callback`, // Callback URL
                success_url: `${RENDER_EXTERNAL_URL}/success`, // Success redirect
                cancel_url: `${RENDER_EXTERNAL_URL}/cancel`, // Cancel redirect
            },
            { headers: { 'x-api-key': NOWPAYMENTS_API_KEY } }
        );

        res.json({ success: true, paymentUrl: response.data.invoice_url });
    } catch (error) {
        console.error('Error creating payment:', error.response?.data || error.message);
        res.status(500).json({ success: false, message: 'Failed to create payment.' });
    }
});

// Handle Payment Callback
app.post('/api/payment-callback', (req, res) => {
    const { payment_status, price_amount, order_id } = req.body;

    if (payment_status !== 'finished' || price_amount < 3) {
        return res.status(400).json({ message: 'Invalid or incomplete payment.' });
    }

    const [userId, referralCode] = order_id.split('_');
    const db = loadDatabase();
    const user = db.users[userId];
    const referer = db.users[referralCode];

    if (!user || user.active || !referer || !referer.active) {
        return res.status(400).json({ message: 'Invalid payment or user data.' });
    }

    // Activate User Account
    user.active = true;
    user.referer = referralCode;

    // Update Referrer Balance
    referer.dummyBalance += 2;
    referer.referrals.push(userId);

    saveDatabase(db);

    // Notify Referrer
    notifyReferrer(referralCode, 2);

    res.json({ success: true });
});

// Get User Status
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

// Submit Referral Code
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

// Start Express Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Launch Telegram Bot
bot.launch();
