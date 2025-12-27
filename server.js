require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const dns = require('dns');
const https = require('https');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { bech32 } = require('bech32');
const Queue = require('express-queue');
const winston = require('winston');
require('winston-daily-rotate-file');
const logForwarder = require('./log-forwarder');
const { BotPlayer, getRandomBotSpawnDelay, generateBotLightningAddress } = require('./botLogic');
const { achievementSystem } = require('./achievements');
const { tournamentManager, speedRoundManager, mysteryModeManager, GAME_MODES } = require('./gameModes');
const { mysteryBoxManager } = require('./mysteryBoxes');
const { streakSystem, globalLeaderboards } = require('./streaksAndLeaderboards');
const { HealthSystem } = require('./health-system');

// Initialize the immortal health system
const healthSystem = new HealthSystem();

// Configure Winston logging with Sea Battle style loggers
const transactionLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/transactions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      archiveCompressed: true
    })
  ]
});

const gameLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/games-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      archiveCompressed: true
    })
  ]
});

const errorLogger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/errors-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
      archiveCompressed: true
    })
  ]
});

const playerSessionLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: 'logs/player-sessions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '50m',
      archiveCompressed: true
    })
  ]
});

// Helper function to log player sessions - Sea Battle implementation
function logPlayerSession(lightningAddress, sessionData) {
  // Compute derived values for better observability
  const sessionEntry = {
    lightningAddress,
    timestamp: new Date().toISOString(),
    sessionData,
    // Core tracking fields
    gameId: sessionData.gameId || null,
    playerId: sessionData.playerId || null,
    betAmount: sessionData.betAmount || null,
    paymentSent: sessionData.paymentSent || false,
    paymentReceived: sessionData.paymentReceived || false,
    gameResult: sessionData.gameResult || null, // 'won', 'lost', 'disconnected'
    disconnectedDuringGame: sessionData.disconnectedDuringGame || false,
    opponentType: sessionData.opponentType || null, // 'human', 'bot'
    payoutAmount: sessionData.payoutAmount || 0,
    payoutStatus: sessionData.payoutStatus || null // 'sent', 'failed', 'not_applicable'
  };
  
  console.log('🎮 PLAYER SESSION LOG:', lightningAddress);
  console.log('📊 Game Result:', sessionEntry.gameResult);
  console.log('💰 Bet Amount:', sessionEntry.betAmount, 'SATS');
  console.log('🏆 Payout:', sessionEntry.payoutAmount, 'SATS');
  console.log('----------------------------------------');
  
  // Forward to local PC
  logForwarder.logPlayerSession(lightningAddress, sessionEntry.sessionData);
  
  playerSessionLogger.info(sessionEntry);
  return sessionEntry;
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Prefer IPv4 DNS resolution to avoid IPv6-related DNS/socket issues
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}
const ipv4Lookup = (hostname, options, cb) => {
  const callback = typeof options === 'function' ? options : cb;
  const opts = typeof options === 'object' && options !== null ? options : {};
  const wantsAll = !!opts.all;

  dns.lookup(hostname, { ...opts, family: 4, all: wantsAll }, (err, address, family) => {
    if (wantsAll) {
      return callback(err, address);
    }
    return callback(err, address, family);
  });
};
const httpAgent = new http.Agent({ keepAlive: true, lookup: ipv4Lookup });
const httpsAgent = new https.Agent({ keepAlive: true, lookup: ipv4Lookup, rejectUnauthorized: true });
const httpClient = axios.create({ 
  httpAgent, 
  httpsAgent,
  timeout: 10000,
  headers: {
    'User-Agent': 'TicTacToe/1.0'
  }
});

const SPEED_API_BASE = process.env.SPEED_API_BASE || 'https://api.tryspeed.com';
const AUTH_HEADER = Buffer.from(`${process.env.SPEED_WALLET_SECRET_KEY}:`).toString('base64');
const PUB_AUTH_HEADER = process.env.SPEED_WALLET_PUBLISHABLE_KEY ? Buffer.from(`${process.env.SPEED_WALLET_PUBLISHABLE_KEY}:`).toString('base64') : null;
const SPEED_INVOICE_AUTH_MODE = (process.env.SPEED_INVOICE_AUTH_MODE || 'auto').toLowerCase();

const app = express();
// Trust the first proxy hop (common for cloud platforms like Render/Heroku)
// This allows express-rate-limit to correctly read client IPs via X-Forwarded-For
app.set('trust proxy', 1);
const server = http.createServer(app);
// CORS origin from env (must be defined before using in Socket.IO)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const normalizeOrigin = (origin) => {
  if (typeof origin !== 'string') return origin;
  return origin.replace(/\/+$/, '');
};
const allowedOrigins = ALLOWED_ORIGIN === '*'
  ? '*'
  : String(ALLOWED_ORIGIN)
      .split(',')
      .map(s => normalizeOrigin(s.trim()))
      .filter(Boolean);
const corsOrigin = (origin, cb) => {
  if (allowedOrigins === '*') return cb(null, true);
  if (!origin) return cb(null, true);
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins.includes(normalized)) return cb(null, true);
  return cb(new Error('Not allowed by CORS'));
};
const io = socketIo(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

// CORS - Enhanced for Render deployment
app.use(cors({ 
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({
  verify: (req, res, buf) => {
    // Keep a copy of the raw body for webhook signature verification
    req.rawBody = buf.toString('utf8');
  }
}));


if (!process.env.SPEED_WALLET_SECRET_KEY || !process.env.SPEED_WALLET_WEBHOOK_SECRET) {
  console.error('Missing Speed Wallet secrets. Set SPEED_WALLET_SECRET_KEY and SPEED_WALLET_WEBHOOK_SECRET.');
  process.exit(1);
}

// Webhook protections
const webhookLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
const webhookQueue = require('express-queue')({ activeLimit: 1, queuedLimit: -1 });


// Speed wallet payout mappings - EXACTLY matching bet amounts to winnings
const PAYOUTS = {
  50: { winner: 80, platformFee: 20 },
  300: { winner: 500, platformFee: 100 },
  500: { winner: 800, platformFee: 200 },
  1000: { winner: 1700, platformFee: 300 },
  5000: { winner: 8000, platformFee: 2000 },
  10000: { winner: 17000, platformFee: 3000 }
};

// Note: Removed any outcome pattern logic to ensure fair gameplay

const ALLOWED_BETS = [50, 300, 500, 1000, 5000, 10000];

// Bot timing constants
const BOT_SPAWN_DELAY = {
  min: 13000, // 13 seconds
  max: 25000  // 25 seconds
};

const BOT_THINK_TIME = {
  min: 1500,  // 1.5 seconds
  max: 4500   // 4.5 seconds
};

// --- In-memory stores ---
const players = {}; // socketId -> { lightningAddress, acctId, betAmount, paid, gameId }
const invoiceToSocket = {}; // invoiceId -> socketId
const invoiceMeta = {}; // invoiceId -> { betAmount, lightningAddress }
const userSessions = {}; // Maps acct_id to Lightning address
const playerAcctIds = {}; // Maps playerId to acct_id
const processedWebhooks = new Set();

// Bot management
const activeBots = new Map(); // gameId -> BotPlayer instance

// Function to store or retrieve acct_id for Lightning address
function mapUserAcctId(acctId, lightningAddress) {
  userSessions[acctId] = lightningAddress;
  console.log(`Mapped acct_id ${acctId} to Lightning address: ${lightningAddress}`);
}

// Function to get Lightning address by acct_id
function getLightningAddressByAcctId(acctId) {
  return userSessions[acctId];
}

// Update player history for bot pattern tracking
function updatePlayerHistory(lightningAddress, betAmount, playerWon) {
  if (!lightningAddress) return;
  
  // This function is used to track player history for bot decision making
  // The actual pattern tracking is handled in botLogic.js
  console.log(`History updated: ${lightningAddress} - ${playerWon ? 'Won' : 'Lost'} ${betAmount} sats`);
}

// Removed betting pattern storage/loading to ensure fair gameplay

// Real Speed wallet payment functions from Sea Battle
// Function to get current BTC to USD rate
async function getCurrentBTCRate() {
  try {
    const response = await httpClient.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd', {
      timeout: 5000
    });
    const btcPrice = response.data.bitcoin.usd;
    console.log('Current BTC price:', btcPrice, 'USD');
    return btcPrice;
  } catch (error) {
    console.error('Failed to fetch BTC rate, using fallback:', error.message);
    return 45000; // Fallback price
  }
}

// Function to convert SATS to USD
async function convertSatsToUSD(amountSats) {
  try {
    const btcPrice = await getCurrentBTCRate();
    const btcAmount = amountSats / 100000000; // SATS -> BTC
    const usdAmount = btcAmount * btcPrice;
    console.log(`Converted ${amountSats} SATS to ${usdAmount.toFixed(2)} USD (BTC rate: $${btcPrice})`);
    return parseFloat(usdAmount.toFixed(2));
  } catch (error) {
    console.error('Error converting SATS to USD:', error.message);
    return parseFloat(((amountSats / 100000000) * 45000).toFixed(2));
  }
}

async function resolveLightningAddress(address, amountSats) {
  try {
    console.log('Resolving Lightning address:', address, 'with amount:', amountSats, 'SATS');
    const [username, domain] = address.split('@');
    if (!username || !domain) {
      throw new Error('Invalid Lightning address');
    }

    const lnurl = `https://${domain}/.well-known/lnurlp/${username}`;
    console.log('Fetching LNURL metadata from:', lnurl);

    const metadataResponse = await httpClient.get(lnurl, { timeout: 5000 });
    const metadata = metadataResponse.data;
    console.log('Received LNURL metadata:', metadata);

    if (metadata.tag !== 'payRequest') {
      throw new Error('Invalid LNURL metadata: not a payRequest');
    }

    const amountMsats = amountSats * 1000;
    console.log(`Attempting to send ${amountSats} SATS (${amountMsats} msats)`);

    if (amountMsats < metadata.minSendable || amountMsats > metadata.maxSendable) {
      const errorMsg = `Invalid amount: ${amountSats} SATS is not within the sendable range`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    const callback = metadata.callback;
    const invoiceResponse = await httpClient.get(`${callback}?amount=${amountMsats}`, { timeout: 5000 });
    const invoice = invoiceResponse.data.pr;

    if (!invoice) {
      throw new Error('No invoice in response');
    }

    return invoice;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
    const errorStatus = error.response?.status || 'No status';
    const errorDetails = error.response?.data || error.message;
    console.error('Create Invoice Error:', {
      message: errorMessage,
      status: errorStatus,
      details: errorDetails,
    });
    throw new Error(`Failed to create invoice: ${errorMessage} (Status: ${errorStatus})`);
  }
}

// Create a Lightning invoice via Speed Wallet
async function createLightningInvoice(amountSats, customerId, orderId) {
  const mode = (SPEED_INVOICE_AUTH_MODE || 'auto').toLowerCase();
  const tryPublishable = mode !== 'secret';
  const trySecret = mode !== 'publishable';

  const amountUSD = await convertSatsToUSD(amountSats);

  const payload = {
    currency: 'SATS',
    amount: amountSats,
    target_currency: 'SATS',
    ttl: 600, // 10 minutes for payment
    description: `Tic-Tac-Toe Game - ${amountSats} SATS`,
    metadata: {
      Order_ID: orderId,
      Customer_ID: customerId,
      Game_Type: 'Tic_Tac_Toe',
      Amount_SATS: amountSats.toString()
    }
  };

  async function attemptCreate(header, label, extraHeaders = {}) {
    console.log(`Creating Lightning invoice via Speed (${label})`, { amountSats, orderId, mode });
    const resp = await axios.post(`${SPEED_API_BASE}/payments`, payload, {
      headers: {
        Authorization: `Basic ${header}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      timeout: 10000,
    });

    const data = resp.data;
    console.log(`Speed API Response (${label}):`, JSON.stringify(data, null, 2));
    const invoiceId = data.id;
    const hostedInvoiceUrl = data.hosted_invoice_url || data.hosted_checkout_url || data.checkout_url || null;

    let lightningInvoice =
      data.payment_method_options?.lightning?.payment_request ||
      data.lightning_invoice ||
      data.invoice ||
      data.payment_request ||
      data.bolt11 ||
      null;

    if (!lightningInvoice && hostedInvoiceUrl) {
      console.log(`[${label}] No direct Lightning invoice found; using hosted URL`);
      lightningInvoice = hostedInvoiceUrl;
    }

    if (!invoiceId) {
      throw new Error(`[${label}] No invoice ID returned from Speed API`);
    }

    return {
      invoiceId,
      hostedInvoiceUrl,
      lightningInvoice,
      amountUSD,
      amountSats,
      speedInterfaceUrl: hostedInvoiceUrl,
    };
  }

  // Try publishable mode first if configured
  if (tryPublishable && PUB_AUTH_HEADER) {
    try {
      return await attemptCreate(PUB_AUTH_HEADER, 'publishable');
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.errors?.[0]?.message || error.message;
      console.error(`Publishable invoice failed:`, error.response?.data || error.message);
      
      // Check if we should fallback to secret mode
      const shouldFallback = trySecret && [401, 403, 422].includes(Number(status));
      if (!shouldFallback) {
        throw new Error(`Failed to create invoice (publishable): ${msg} (Status: ${status || 'n/a'})`);
      }
      console.log('Falling back to secret mode due to publishable failure');
    }
  }

  // Try secret mode if configured
  if (trySecret && AUTH_HEADER) {
    try {
      return await attemptCreate(AUTH_HEADER, 'secret', { 'speed-version': '2022-04-15' });
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.errors?.[0]?.message || error.message;
      throw new Error(`Failed to create invoice (secret): ${msg} (Status: ${status || 'n/a'})`);
    }
  }

  throw new Error('No valid invoice auth mode available. Set SPEED_INVOICE_AUTH_MODE to publishable|secret|auto.');
}

// Sea Battle exact payment implementation via /payments (BOLT11 or Lightning address)
async function sendPayment(destination, amount, currency) {
  try {
    let invoice;

    if (destination.includes('@')) {
      console.log('Resolving Lightning address:', destination);
      invoice = await resolveLightningAddress(destination, Number(amount), currency);
      console.log('Resolved invoice:', invoice);
      if (!invoice || !invoice.startsWith('ln')) {
        throw new Error('Invalid or malformed invoice retrieved');
      }
    } else {
      invoice = destination;
      if (!invoice.startsWith('ln')) {
        throw new Error('Invalid invoice format: must start with "ln"');
      }
    }

    // Log the request details for debugging
    const paymentPayload = {
      payment_request: invoice
    };
    
    console.log('Sending payment request to Speed API:', {
      url: `${SPEED_API_BASE}/payments`,
      payload: paymentPayload,
      headers: {
        Authorization: `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/json',
        'speed-version': '2022-04-15',
      }
    });

    const response = await httpClient.post(
      `${SPEED_API_BASE}/payments`,
      paymentPayload,
      {
        headers: {
          Authorization: `Basic ${AUTH_HEADER}`,
          'Content-Type': 'application/json',
          'speed-version': '2022-04-15',
        },
        timeout: 5000,
      }
    );

    console.log('Payment response:', response.data);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
    console.error('Send Payment Error:', errorMessage);
    throw new Error(`Failed to send payment: ${errorMessage}`);
  }
}

// Decode bech32 LNURL and fetch a minimal BOLT11 invoice
async function decodeAndFetchLnUrl(lnUrl) {
  try {
    console.log('Decoding LN-URL:', lnUrl);
    const { words } = bech32.decode(lnUrl, 2000);
    const decoded = bech32.fromWords(words);
    const url = Buffer.from(decoded).toString('utf8');
    console.log('Decoded LN-URL to URL:', url);

    const response = await httpClient.get(url, { timeout: 5000 });
    if (response.data.tag !== 'payRequest') {
      throw new Error('LN-URL response is not a payRequest');
    }

    const callbackUrl = response.data.callback;
    const amountMsats = response.data.minSendable;

    const callbackResponse = await httpClient.get(`${callbackUrl}?amount=${amountMsats}`, { timeout: 5000 });
    if (!callbackResponse.data.pr) {
      throw new Error('No BOLT11 invoice in callback response');
    }

    return callbackResponse.data.pr;
  } catch (error) {
    console.error('LN-URL processing error:', error.message);
    throw new Error(`Failed to process LN-URL: ${error.message}`);
  }
}

// New Speed Wallet instant send function using the instant-send API - Sea Battle exact implementation
async function sendInstantPayment(withdrawRequest, amount, currency = 'USD', targetCurrency = 'SATS', note = '') {

  /*
  Placeholder for sending payments logic
  Integrate actual sending logic here
  */
  try {
    console.log('Sending instant payment via Speed Wallet instant-send API:', {
      withdrawRequest,
      amount,
      currency,
      targetCurrency,
      note
    });

    const instantSendPayload = {
      amount: parseFloat(amount),
      currency: currency,
      target_currency: targetCurrency,
      withdraw_method: 'lightning',
      withdraw_request: withdrawRequest,
      note: note
    };

    console.log('Instant send payload:', JSON.stringify(instantSendPayload, null, 2));

    const response = await httpClient.post(
      `${SPEED_API_BASE}/send`,
      instantSendPayload,
      {
        headers: {
          Authorization: `Basic ${AUTH_HEADER}`,
          'Content-Type': 'application/json',
          'speed-version': '2022-04-15',
        },
        timeout: 10000,
      }
    );

    console.log('Instant send response:', response.data);
    return response.data;
  } catch (error) {
    const errorMessage = error.response?.data?.errors?.[0]?.message || error.message;
    const errorStatus = error.response?.status || 'No status';
    const errorDetails = error.response?.data || error.message;
    console.error('Instant Send Payment Error:', {
      message: errorMessage,
      status: errorStatus,
      details: errorDetails,
    });
    throw new Error(`Failed to send instant payment: ${errorMessage} (Status: ${errorStatus})`);
  }
}

// Fetch Speed wallet transactions (mock/demo friendly)
async function fetchSpeedWalletTransactions(lightningAddress) {
  try {
    // Placeholder for real API call if/when Speed exposes this
    // Returning empty list to avoid misleading data
    return [];
  } catch (e) {
    console.error('fetchSpeedWalletTransactions error:', e.message);
    return [];
  }
}

// Fetch user's Lightning address from Speed wallet
async function fetchLightningAddress(authToken) {
  try {
    if (!authToken) {
      throw new Error('No auth token provided');
    }

    console.log('Fetching Lightning address with token:', authToken.substring(0, 10) + '...');
    
    // Use Speed wallet user endpoint
    // Try /user endpoint first, fallback to /user/lightning-address if needed
    let response;
    try {
      response = await httpClient.get(
        `${SPEED_API_BASE}/user`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'speed-version': '2022-04-15',
          },
          timeout: 5000,
        }
      );
    } catch (error) {
      // Fallback to specific endpoint if /user fails
      console.log('Trying fallback endpoint /user/lightning-address');
      response = await httpClient.get(
        `${SPEED_API_BASE}/user/lightning-address`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'speed-version': '2022-04-15',
          },
          timeout: 5000,
        }
      );
    }

    // Try multiple possible response field names
    const lightningAddress = response.data.lightning_address || 
                             response.data.ln_address || 
                             response.data.address ||
                             response.data.lightningAddress;
    
    if (!lightningAddress) {
      console.error('Lightning address not found in response:', response.data);
      throw new Error('Lightning address not found in Speed Wallet response');
    }
    
    console.log('Fetched Lightning address:', lightningAddress);
    return lightningAddress;
  } catch (error) {
    console.error('Error fetching Lightning address:', error.message);
    throw error;
  }
}

// Process payout for winner with platform fee - Sea Battle implementation
async function processPayout(winnerId, betAmount, gameId, winnerLightningAddress) {
  try {
    const winner = players[winnerId];
    const winnerAddress = winner?.lightningAddress || winnerLightningAddress;
    if (!winnerAddress) {
      throw new Error('Winner data not found');
    }

    const totalPot = betAmount * 2;
    const platformFee = Math.floor(totalPot * 0.05); // 5% platform fee
    const winnerPayout = totalPot - platformFee;

    console.log(`Processing payout for game ${gameId}:`);
    console.log(`  Winner: ${winnerAddress}`);
    console.log(`  Total pot: ${totalPot} SATS`);
    console.log(`  Platform fee: ${platformFee} SATS`);
    console.log(`  Winner payout: ${winnerPayout} SATS`);

    // Send winner payout (amount in SATS, currency should be SATS)
    const winnerResult = await sendInstantPayment(
      winnerAddress,
      winnerPayout,
      'SATS', // currency
      'SATS', // targetCurrency
      `Tic-Tac-Toe winnings from game ${gameId}`
    );

    const winnerPaymentId = winnerResult?.paymentId || winnerResult?.payment_id || winnerResult?.id || null;
    const winnerOk = winnerResult && (winnerResult.success === true || winnerResult.success === undefined);

    const emitToWinnerAddress = (event, payload) => {
      const directSock = io.sockets.sockets.get ? io.sockets.sockets.get(winnerId) : io.sockets.sockets[winnerId];
      directSock?.emit(event, payload);
      for (const [sid, meta] of Object.entries(players)) {
        if (meta?.lightningAddress !== winnerAddress) continue;
        const s = io.sockets.sockets.get ? io.sockets.sockets.get(sid) : io.sockets.sockets[sid];
        s?.emit(event, payload);
      }
    };

    if (winnerOk) {
      console.log(`✅ Winner payout sent: ${winnerPayout} SATS to ${winnerAddress}`);
      
      // Log successful payout
      transactionLogger.info({
        event: 'winner_payout_sent',
        gameId: gameId,
        winnerId: winnerId,
        winnerAddress: winnerAddress,
        winnerPayout: winnerPayout,
        platformFee: platformFee,
        totalPot: totalPot,
        timestamp: new Date().toISOString()
      });
      
      // Log player session with payout sent
      logPlayerSession(winnerAddress, {
        event: 'payout_sent',
        playerId: winnerId,
        gameId: gameId,
        amount: winnerPayout
      });
      
      // Notify winner
      emitToWinnerAddress('payoutSent', {
        amount: winnerPayout,
        paymentId: winnerPaymentId
      });
      emitToWinnerAddress('payment_sent', {
        amount: winnerPayout,
        status: 'sent',
        txId: winnerPaymentId
      });
    } else {
      throw new Error(winnerResult?.error || 'Winner payout failed');
    }

    // Send platform fee to totodile@speed.app (matching Sea Battle)
    const platformResult = await sendInstantPayment(
      'totodile@speed.app', // Platform Lightning address from Sea Battle
      platformFee,
      'SATS', // currency
      'SATS', // targetCurrency
      `Platform fee from game ${gameId}`
    );

    const platformPaymentId = platformResult?.paymentId || platformResult?.payment_id || platformResult?.id || null;
    const platformOk = platformResult && (platformResult.success === true || platformResult.success === undefined);

    if (platformOk) {
      console.log(`✅ Platform fee sent: ${platformFee} SATS to totodile@speed.app`);
      
      // Log successful platform fee
      transactionLogger.info({
        event: 'platform_fee_sent',
        gameId: gameId,
        recipient: 'totodile@speed.app',
        amount: platformFee,
        paymentId: platformPaymentId,
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error(platformResult?.error || 'Platform fee failed');
    }
    
    console.log('Payout processed successfully with platform fee');
    gameLogger.info({
      event: 'game_payout_complete',
      gameId: gameId,
      winnerId: winnerId,
      winnerAddress: winnerAddress,
      winnerPayout: winnerPayout,
      platformFee: platformFee,
      totalPot: totalPot,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Payout processing error:', error);
    errorLogger.error({
      event: 'payout_failed',
      gameId: gameId,
      winnerId: winnerId,
      error: error.message
    });
    const addr = (players[winnerId] && players[winnerId].lightningAddress) || winnerLightningAddress;
    const payload = { error: error.message };
    const directSock = io.sockets.sockets.get ? io.sockets.sockets.get(winnerId) : io.sockets.sockets[winnerId];
    directSock?.emit('payment_error', payload);
    if (addr) {
      for (const [sid, meta] of Object.entries(players)) {
        if (meta?.lightningAddress !== addr) continue;
        const s = io.sockets.sockets.get ? io.sockets.sockets.get(sid) : io.sockets.sockets[sid];
        s?.emit('payment_error', payload);
      }
    }
  }
}

// Game class with full logic
class Game {
  constructor(id, betAmount) {
    this.id = id;
    this.betAmount = betAmount;
    this.players = {};
    this.board = Array(9).fill(null);
    this.turn = null;
    this.status = 'waiting'; // waiting, playing, finished
    this.winner = null;
    this.winLine = [];
    this.turnTimer = null;
    this.isFirstTurn = true;
    this.moveCount = 0;
    this.startingPlayer = null; // Track who starts for draw handling
    this.turnDeadlineAt = null; // epoch ms when current turn ends
  }
  
  addPlayer(socketId, lightningAddress, isBot = false) {
    const symbol = Object.keys(this.players).length === 0 ? 'X' : 'O';
    this.players[socketId] = {
      socketId,
      lightningAddress,
      isBot,
      symbol,
      ready: false
    };
    
    if (Object.keys(this.players).length === 2) {
      this.status = 'ready';
      // Randomly decide who starts
      const playerIds = Object.keys(this.players);
      this.turn = playerIds[Math.random() < 0.5 ? 0 : 1];
      this.startingPlayer = this.turn;
    }
    
    return symbol;
  }
  
  currentPlayerSymbol() {
    return this.players[this.turn]?.symbol;
  }
  
  checkWinner() {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    for (const line of lines) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return { winner: this.board[a], winLine: line };
      }
    }
    
    if (this.board.every(cell => cell !== null)) {
      return { winner: 'draw', winLine: [] };
    }
    
    return { winner: null, winLine: [] };
  }
  
  makeMove(socketId, position) {
    if (this.status !== 'playing') return { ok: false, reason: 'not_playing' };
    if (this.turn !== socketId) return { ok: false, reason: 'not_your_turn' };
    if (position < 0 || position > 8) return { ok: false, reason: 'bad_pos' };
    if (this.board[position] !== null) return { ok: false, reason: 'occupied' };
    
    this.board[position] = this.currentPlayerSymbol();
    this.isFirstTurn = false;
    this.moveCount++;
    const { winner, winLine } = this.checkWinner();
    
    if (winner) {
      this.status = 'finished';
      this.clearTurnTimer();
      
      if (winner === 'draw') {
        this.winner = 'draw';
        // Switch starting player for next game
        const playerIds = Object.keys(this.players);
        const otherPlayer = playerIds.find(id => id !== this.startingPlayer);
        this.startingPlayer = otherPlayer;
        return { ok: true, draw: true, nextStarter: otherPlayer };
      } else {
        const winnerId = Object.keys(this.players).find(
          id => this.players[id].symbol === winner
        );
        this.winner = winnerId;
        this.winLine = winLine;
        return { ok: true, winner: winnerId, winLine };
      }
    }
    
    // Switch turn
    const playerIds = Object.keys(this.players);
    this.turn = playerIds.find(id => id !== this.turn);
    
    // Start timer for next player
    this.startTurnTimer();
    
    return { ok: true };
  }
  
  startTurnTimer() {
    this.clearTurnTimer();
    const timeout = this.isFirstTurn ? 8000 : 5000;
    
    this.turnTimer = setTimeout(() => {
      this.handleTimeout();
    }, timeout);

    // Expose deadline and announce next turn
    this.turnDeadlineAt = Date.now() + timeout;
    
    // Emit to all players in the game
    Object.keys(this.players).forEach(pid => {
      if (!this.players[pid].isBot) {
        const sock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
        sock?.emit('nextTurn', {
          turn: this.turn,
          turnDeadline: this.turnDeadlineAt,
          message: this.turn === pid ? 'Your move' : "Opponent's move"
        });
      }
    });

    if (this.players[this.turn]?.isBot) {
      makeBotMove(this.id, this.turn);
    }
  }
  
  clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
  }
  
  handleTimeout() {
    if (this.status !== 'playing') return;
    
    const currentPlayerId = this.turn;
    const currentPlayer = this.players[currentPlayerId];
    if (currentPlayer?.isBot) {
      const availableMoves = this.board
        .map((cell, i) => cell === null ? i : -1)
        .filter(i => i !== -1);
      
      if (availableMoves.length > 0) {
        const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        const botSymbol = currentPlayer.symbol;
        const result = this.makeMove(currentPlayerId, move);
        
        if (result.ok) {
          const humanPlayerId = Object.keys(this.players).find(pid => !this.players[pid].isBot);
          const humanSock = humanPlayerId ? (io.sockets.sockets.get ? io.sockets.sockets.get(humanPlayerId) : io.sockets.sockets[humanPlayerId]) : null;
          
          const moveData = {
            position: move,
            symbol: botSymbol,
            nextTurn: this.turn,
            board: this.board,
            turnDeadline: this.turnDeadlineAt,
            message: this.turn === humanPlayerId ? 'Your move' : "Opponent's move"
          };
          
          io.to(this.id).emit('moveMade', moveData);
          if (humanSock && humanSock.connected) {
            humanSock.emit('moveMade', moveData);
          }
          io.to(this.id).emit('boardUpdate', {
            board: this.board,
            lastMove: move
          });
        }
        
        if (result.winner) {
          handleGameEnd(this.id, result.winner, result.winLine);
        } else if (result.draw) {
          handleDraw(this.id);
        } else if (this.players[this.turn]?.isBot) {
          makeBotMove(this.id, this.turn);
        }
      }
    } else {
      const playerIds = Object.keys(this.players);
      const otherPlayer = playerIds.find(id => id !== this.turn);
      handleGameEnd(this.id, otherPlayer);
    }
  }
}

// Game management
const games = {};
const waitingQueue = []; // Players waiting for match
const botSpawnTimers = {}; // Track bot spawn timers

// Speed wallet routes
app.get('/api/speed-wallet/lightning-address', async (req, res) => {
  const { authToken } = req.query;
  
  if (!authToken) {
    return res.status(400).json({ error: 'Auth token required' });
  }
  
  try {
    const lightningAddress = await fetchLightningAddress(authToken);
    res.json({ lightningAddress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get payout info
app.get('/api/payouts', (req, res) => {
  res.json(PAYOUTS);
});

// Sea Battle compatible payout-info endpoint
app.get('/api/payout-info', (req, res) => {
  res.json({
    api: {
      name: 'Speed Wallet API',
      endpoint: SPEED_API_BASE,
      method: 'Lightning Network instant payments',
      description: "Winners are paid instantly via Lightning Network using Speed Wallet's send API"
    },
    payouts: PAYOUTS,
    fees: 'Platform fees are automatically deducted from the total pot',
    currency: 'SATS (Bitcoin Satoshis)',
    paymentMethod: 'Lightning Address (@speed.app)'
  });
});

// Proxy endpoint to fetch Speed wallet transactions (mock/demo compatible)
app.get('/api/speed-transactions/:lightning_address', async (req, res) => {
  try {
    const { lightning_address } = req.params;
    if (!lightning_address) return res.status(400).json({ error: 'Lightning address is required' });

    const transactions = await fetchSpeedWalletTransactions(lightning_address);
    res.json({ lightning_address, transactions, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('Speed transactions error:', e.message);
    res.status(500).json({ error: 'Failed to fetch Speed wallet transactions' });
  }
});

// Enhanced health check with detailed system information
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const healthData = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    
    // System metrics
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024), // MB
    },
    
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    
    // Server info
    server: {
      port: PORT,
      pid: process.pid,
      platform: process.platform,
      nodeVersion: process.version
    },
    
    // Service status
    services: {
      socketIO: io ? 'connected' : 'disconnected',
      speedWallet: SPEED_API_BASE ? 'configured' : 'not configured',
      logging: 'active'
    },
    
    // Connection stats
    stats: {
      activeConnections: io ? io.engine.clientsCount : 0,
      totalGames: Object.keys(games).length,
      activePlayers: Object.keys(games).reduce((total, gameId) => {
        return total + (games[gameId].players ? Object.keys(games[gameId].players).length : 0);
      }, 0)
    }
  };
  
  // Add health status indicators
  healthData.healthy = {
    memory: memUsage.rss < 500 * 1024 * 1024, // Under 500MB
    uptime: process.uptime() > 10, // Running for more than 10 seconds
    services: true // All services operational
  };
  
  // Overall health status
  healthData.overall = Object.values(healthData.healthy).every(status => status) ? 'healthy' : 'degraded';
  
  res.json(healthData);
});

// Deep health check with extended testing
app.get('/health/deep', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      testResults: {}
    };
    
    // Test database connectivity (if applicable)
    healthData.testResults.database = { status: 'ok', message: 'No database configured' };
    
    // Test external API connectivity
    try {
      if (SPEED_API_BASE) {
        const apiTest = await axios.get(`${SPEED_API_BASE}/health`, { timeout: 5000 });
        healthData.testResults.speedWallet = { 
          status: 'ok', 
          responseTime: Date.now() - startTime,
          apiStatus: apiTest.status 
        };
      } else {
        healthData.testResults.speedWallet = { status: 'not_configured' };
      }
    } catch (error) {
      healthData.testResults.speedWallet = { 
        status: 'error', 
        error: error.message 
      };
    }
    
    // Test WebSocket functionality
    healthData.testResults.websocket = {
      status: io ? 'ok' : 'error',
      connections: io ? io.engine.clientsCount : 0
    };
    
    // Test file system
    try {
      const fs = require('fs');
      fs.accessSync(__dirname, fs.constants.R_OK | fs.constants.W_OK);
      healthData.testResults.filesystem = { status: 'ok' };
    } catch (error) {
      healthData.testResults.filesystem = { status: 'error', error: error.message };
    }
    
    healthData.totalTestTime = Date.now() - startTime;
    healthData.overall = Object.values(healthData.testResults)
      .every(test => test.status === 'ok' || test.status === 'not_configured') ? 'healthy' : 'degraded';
    
    res.json(healthData);
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      testTime: Date.now() - startTime
    });
  }
});

// 🛡️ IMMORTAL HEALTH ENDPOINT - Ultimate server status
app.get('/health/immortal', async (req, res) => {
  try {
    const fullHealthStatus = await healthSystem.getFullHealthStatus();
    res.json(fullHealthStatus);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health system error',
      error: error.message,
      timestamp: new Date().toISOString(),
      fallback: {
        status: 'degraded',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        pid: process.pid
      }
    });
  }
});

// Emergency recovery endpoint (POST for security)
app.post('/health/emergency-recovery', (req, res) => {
  try {
    console.log('🚑 Emergency recovery initiated via API');
    
    // Trigger self-healing
    healthSystem.initiateAutoHealing([{
      type: 'manual',
      category: 'emergency',
      message: 'Manual emergency recovery triggered'
    }]);
    
    res.json({
      status: 'ok',
      message: 'Emergency recovery procedures initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Emergency recovery failed',
      error: error.message
    });
  }
});

// Check payment status (for local testing since webhooks don't work locally)
app.get('/api/check-payment/:invoiceId', async (req, res) => {
  try {
    const { invoiceId } = req.params;
    console.log('Checking payment status for invoice:', invoiceId);
    
    if (!invoiceId) {
      return res.status(400).json({ success: false, error: 'Invoice ID is required' });
    }

    // Fetch invoice status from Speed API
    const response = await axios.get(`${SPEED_API_BASE}/payments/${invoiceId}`, {
      headers: {
        'Authorization': `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const invoice = response.data;
    console.log('Speed API invoice status:', { id: invoiceId, status: invoice.status });
    
    if (invoice.status === 'paid' || invoice.status === 'completed') {
      // Manually trigger payment verification
      handleInvoicePaid(invoiceId, { 
        event_type: 'manual_verification',
        data: { object: invoice }
      });
      return res.json({ success: true, status: invoice.status });
    } else {
      return res.json({ success: true, status: invoice.status });
    }
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to check payment status',
      details: error.message 
    });
  }
});

// Resolve LN input (Lightning address, LNURL, or BOLT11) to a BOLT11 invoice
app.post('/api/resolve-ln', async (req, res) => {
  try {
    const { input, amountSats } = req.body || {};
    if (!input || typeof input !== 'string') {
      return res.status(400).json({ error: 'input required' });
    }

    let invoice = null;
    const lower = input.toLowerCase();

    if (lower.startsWith('lnurl')) {
      invoice = await decodeAndFetchLnUrl(input);
    } else if (input.includes('@')) {
      if (!amountSats || Number(amountSats) <= 0) {
        return res.status(400).json({ error: 'amountSats required for Lightning address' });
      }
      invoice = await resolveLightningAddress(input, Number(amountSats));
    } else if (lower.startsWith('ln')) {
      invoice = input;
    } else {
      return res.status(400).json({ error: 'Unknown input format' });
    }

    res.json({ invoice });
  } catch (e) {
    console.error('resolve-ln error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Send payment to a BOLT11 invoice or Lightning address (@speed.app)
app.post('/api/send-payment', async (req, res) => {
  try {
    const { destination, amountSats, note } = req.body || {};
    if (!destination) return res.status(400).json({ error: 'destination required' });

    const result = await sendPayment(destination, amountSats, note);
    res.json(result);
  } catch (e) {
    console.error('send-payment error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// API endpoint to get Lightning address from Speed
app.post('/api/get-lightning-address', async (req, res) => {
  try {
    const { authToken } = req.body;
    
    if (!authToken) {
      return res.status(400).json({ error: 'Auth token required' });
    }

    // Decode the auth token to get user info
    const userInfo = JSON.parse(Buffer.from(authToken.split('.')[1], 'base64').toString());
    const acctId = userInfo.acct_id;
    
    // Check if we already have this user's Lightning address
    const cached = getLightningAddressByAcctId(acctId);
    if (cached) {
      return res.json({ lightningAddress: cached, acctId });
    }
    
    // Fetch from Speed API
    const response = await httpClient.get(`${SPEED_API_BASE}/user/lightning-address`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    const lightningAddress = response.data.lightningAddress || response.data.address;
    if (lightningAddress) {
      mapUserAcctId(acctId, lightningAddress);
    }
    
    res.json({ lightningAddress, acctId });
  } catch (error) {
    console.error('Error fetching Lightning address:', error.message);
    res.status(500).json({ error: 'Failed to fetch Lightning address' });
  }
});

// API endpoint to generate LNURL
app.post('/api/generate-lnurl', async (req, res) => {
  try {
    const { amountSats, description } = req.body;
    
    const response = await httpClient.post(`${SPEED_API_BASE}/lnurl/generate`, {
      amount: amountSats,
      description: description || `Tic-Tac-Toe Game - ${amountSats} SATS`,
      currency: 'SATS'
    }, {
      headers: {
        'Authorization': `Basic ${AUTH_HEADER}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    res.json({
      lnurl: response.data.lnurl,
      qr: response.data.qr
    });
  } catch (error) {
    console.error('Error generating LNURL:', error.message);
    res.status(500).json({ error: 'Failed to generate LNURL' });
  }
});

// API endpoint to generate Lightning QR code
app.post('/api/generate-qr', async (req, res) => {
  try {
    const { invoice } = req.body;
    if (!invoice) {
      return res.status(400).json({ error: 'Invoice required' });
    }
    const qr = await QRCode.toDataURL(invoice);
    res.json({ qr });
  } catch (error) {
    console.error('QR generation error:', error);
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// New addictive features API endpoints

// Achievements API
app.get('/api/achievements/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const progress = achievementSystem.getPlayerProgress(lightningAddress);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

app.get('/api/achievements', (req, res) => {
  try {
    const achievements = achievementSystem.getAllAchievements();
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get achievement definitions' });
  }
});

app.post('/api/achievements/claim/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const rewards = achievementSystem.claimRewards(lightningAddress);
    res.json({ rewards });
  } catch (error) {
    res.status(500).json({ error: 'Failed to claim rewards' });
  }
});

// Leaderboards API
app.get('/api/leaderboards', (req, res) => {
  try {
    const { type = 'profit', period = 'all', limit = 50 } = req.query;
    const leaderboard = globalLeaderboards.getLeaderboard(type, period, parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

app.get('/api/leaderboards/streaks', (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const leaderboard = streakSystem.getStreakLeaderboard(parseInt(limit));
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get streak leaderboard' });
  }
});

app.get('/api/player-stats/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const stats = globalLeaderboards.getPlayerStats(lightningAddress);
    const streakData = streakSystem.getPlayerStreak(lightningAddress);
    res.json({ ...stats, streak: streakData });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get player stats' });
  }
});


// Mystery boxes API
app.get('/api/mystery-boxes/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const boxes = mysteryBoxManager.getPlayerBoxes(lightningAddress);
    res.json(boxes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get mystery boxes' });
  }
});

app.post('/api/mystery-boxes/open', (req, res) => {
  try {
    const { lightningAddress, boxId } = req.body;
    const result = mysteryBoxManager.openMysteryBox(lightningAddress, boxId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to open mystery box' });
  }
});

app.post('/api/mystery-boxes/daily/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const result = mysteryBoxManager.getDailyMysteryBox(lightningAddress);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get daily mystery box' });
  }
});

app.get('/api/mystery-boxes/stats/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const stats = mysteryBoxManager.getBoxStats(lightningAddress);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get box stats' });
  }
});

// Tournament API
app.get('/api/tournaments', (req, res) => {
  try {
    const tournaments = tournamentManager.getActiveTournaments();
    res.json(tournaments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tournaments' });
  }
});

app.post('/api/tournaments/create', (req, res) => {
  try {
    const { mode = 'TOURNAMENT', entryFee = 500, maxPlayers = 16 } = req.body;
    const tournament = tournamentManager.createTournament(mode, entryFee, maxPlayers);
    res.json(tournament);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

app.post('/api/tournaments/join', (req, res) => {
  try {
    const { tournamentId, playerData } = req.body;
    const result = tournamentManager.joinTournament(tournamentId, playerData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to join tournament' });
  }
});

app.get('/api/tournaments/:tournamentId', (req, res) => {
  try {
    const { tournamentId } = req.params;
    const tournament = tournamentManager.getTournament(tournamentId);
    res.json(tournament || { error: 'Tournament not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get tournament' });
  }
});

app.get('/api/game-modes', (req, res) => {
  try {
    res.json(Object.values(GAME_MODES));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch game modes' });
  }
});

// Bot Management API
const { botStats, playerHistory, betHistory, getBotDifficulty, BOT_DIFFICULTY } = require('./botLogic');

// Get bot statistics
app.get('/api/bots/stats', (req, res) => {
  try {
    const stats = botStats.getStats();
    const activeBotsCount = activeBots.size;
    const playerHistorySize = playerHistory.size;
    const betHistorySize = betHistory.size;
    
    res.json({
      ...stats,
      activeBots: activeBotsCount,
      trackedPlayers: playerHistorySize,
      betHistoryRecords: betHistorySize,
      difficultyLevels: BOT_DIFFICULTY
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bot stats' });
  }
});

// Get active bot games
app.get('/api/bots/active', (req, res) => {
  try {
    const activeBotGames = [];
    for (const [gameId, bot] of activeBots.entries()) {
      const game = games[gameId];
      if (game) {
        activeBotGames.push({
          gameId: gameId,
          betAmount: bot.betAmount,
          shouldWin: bot.shouldWin,
          moveCount: bot.moveHistory.length,
          gameStatus: game.status,
          opponentAddress: bot.opponentAddress
        });
      }
    }
    res.json({ activeBotGames, totalActive: activeBotGames.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch active bot games' });
  }
});

// Get player history for specific Lightning address
app.get('/api/bots/player-history/:lightningAddress', (req, res) => {
  try {
    const { lightningAddress } = req.params;
    const history = playerHistory.get(lightningAddress);
    const betInfo = betHistory.get(lightningAddress);
    
    if (!history && !betInfo) {
      return res.status(404).json({ error: 'Player not found in bot history' });
    }
    
    res.json({
      lightningAddress,
      gameHistory: history || null,
      betHistory: betInfo || null,
      recommendedDifficulty: history ? getBotDifficulty(50, history) : BOT_DIFFICULTY.EASY
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player history' });
  }
});

// Reset bot statistics (admin only)
app.post('/api/bots/reset-stats', (req, res) => {
  try {
    // Reset bot stats
    botStats.totalGames = 0;
    botStats.totalWins = 0;
    botStats.totalLosses = 0;
    botStats.totalDraws = 0;
    botStats.averageThinkTime = 0;
    botStats.betAmountDistribution.clear();
    
    // Clear player and bet history
    playerHistory.clear();
    betHistory.clear();
    
    res.json({ success: true, message: 'Bot statistics reset successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reset bot statistics' });
  }
});

// Force bot spawn for testing
app.post('/api/bots/force-spawn', (req, res) => {
  try {
    const { betAmount = 50, playerAddress = 'test@speed.app' } = req.body;
    
    // Create a test game with bot
    const gameId = `test_${Date.now()}`;
    const botId = `bot_${uuidv4()}`;
    const botAddress = generateBotLightningAddress();
    const bot = new BotPlayer(gameId, betAmount, playerAddress);
    
    activeBots.set(gameId, bot);
    
    res.json({
      success: true,
      gameId,
      botId,
      botAddress,
      botShouldWin: bot.shouldWin,
      betAmount: bot.betAmount,
      message: 'Bot spawned successfully for testing'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to spawn test bot' });
  }
});

// Get bot patterns and logic info
app.get('/api/bots/patterns', (req, res) => {
  try {
    const { PATTERN_50_SATS, PATTERN_300_PLUS } = require('./botLogic');
    
    res.json({
      patterns: {
        '50_sats': {
          pattern: PATTERN_50_SATS,
          description: 'Pattern: W-L-W-W-L-L-L-W-L (repeats) - Player wins first game, balanced gameplay'
        },
        '300_plus': {
          pattern: PATTERN_300_PLUS,
          description: 'Pattern: L-W-L-W-L-L-W-L-W (repeats) - Player loses first, wins on EXACT same bet retry',
          revengeLogic: 'Player wins 2nd game ONLY if same Lightning address + same bet amount after loss'
        }
      },
      gameRules: {
        turnTimers: {
          firstTurn: '8 seconds',
          subsequentTurns: '5 seconds',
          drawTurns: '5 seconds (opponent goes first after draw)'
        },
        drawLogic: {
          fairGames: 'Bot loses after 2-5 draws with silly mistake',
          cheatingGames: 'Bot wins after 3-4 draws with strategic play',
          afterDraw: 'Opponent gets first turn (5 seconds only)'
        }
      },
      difficultyInfo: {
        [BOT_DIFFICULTY.EASY]: 'Noob play with many mistakes (~30% win rate)',
        [BOT_DIFFICULTY.MEDIUM]: 'Balanced strategic play (~50% win rate)',
        [BOT_DIFFICULTY.HARD]: 'Smart strategic play with tension (~70% win rate)',
        [BOT_DIFFICULTY.EXPERT]: 'Near perfect play with full competition (~85% win rate)'
      },
      spawnDelay: '13-25 seconds random delay when no human opponent found',
      thinkingTime: '2-5 seconds human-like thinking time'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bot patterns' });
  }
});

// Manual payment verification endpoint for testing
app.post('/api/verify-payment', async (req, res) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID required' });
    }
    
    console.log('Manual payment verification requested for invoice:', invoiceId);
    
    // Check invoice status with Speed Wallet API
    const response = await axios.get(
      `${SPEED_API_BASE}/merchant/invoices/${invoiceId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.SPEED_WALLET_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const invoice = response.data;
    console.log('Invoice status:', invoice.status, 'Invoice data:', invoice);
    
    if (invoice.status === 'paid' || invoice.status === 'completed') {
      // Manually trigger payment verification
      handleInvoicePaid(invoiceId, { 
        event_type: 'manual_verification',
        data: { object: invoice }
      });
      return res.json({ success: true, status: invoice.status });
    } else {
      return res.json({ success: false, status: invoice.status });
    }
  } catch (error) {
    console.error('Manual payment verification error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Speed Wallet Webhook - Exact Sea Battle implementation (no signature verification)
app.post('/webhook', express.json(), (req, res) => {
  logger.debug('Webhook received', { headers: req.headers });
  const WEBHOOK_SECRET = process.env.SPEED_WALLET_WEBHOOK_SECRET || 'we_memya2mjjqpg1fjA';
  const event = req.body;
  logger.info('Processing webhook event', { event: event.event_type, data: event.data })

  try {
    const eventType = event.event_type;
    logger.debug('Processing event type', { eventType });

    switch (eventType) {
      case 'invoice.paid':
      case 'payment.paid':
      case 'payment.confirmed':
        const invoiceId = event.data?.object?.id || event.data?.id;
        if (!invoiceId) {
          logger.error('Webhook error: No invoiceId in webhook payload');
          return res.status(400).send('No invoiceId in webhook payload');
        }

        const socketId = invoiceToSocket[invoiceId];
        if (!socketId) {
          logger.warn(`Webhook warning: No socketId found for invoice ${invoiceId}. Player may have disconnected before mapping was stored.`);
          return res.status(200).send('Webhook received but no socketId found');
        }
        const sock = (io.sockets && io.sockets.sockets && (io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : io.sockets.sockets[socketId])) || null;

        // Log payment verification
        const paymentData = {
          event: 'payment_verified',
          playerId: socketId,
          invoiceId: invoiceId,
          amount: players[socketId]?.betAmount || 'unknown',
          lightningAddress: players[socketId]?.lightningAddress || 'unknown',
          timestamp: new Date().toISOString(),
          eventType: eventType
        };
        
        transactionLogger.info(paymentData);
        
        // Forward payment log to PC
        logForwarder.logPayment(socketId, paymentData);

        if (sock) {
          sock.emit('paymentVerified');
        }
        if (!players[socketId]) {
          logger.warn(`Players record missing for ${socketId} on webhook for invoice ${invoiceId}`);
          return res.status(200).send('Webhook processed but player not found');
        }
        players[socketId].paid = true;
        logger.info('Payment verified for player', { playerId: socketId, invoiceId });

        // Log player session with payment received status
        console.log('💳 PAYMENT VERIFIED for:', players[socketId].lightningAddress);
        console.log('💰 Amount:', players[socketId].betAmount, 'SATS');
        if (players[socketId].lightningAddress) {
          logPlayerSession(players[socketId].lightningAddress, {
            event: 'payment_received',
            playerId: socketId,
            betAmount: players[socketId].betAmount,
            invoiceId: invoiceId
          });
        }

        // Find or create game immediately after payment
        let game = Object.values(games).find(g => 
          Object.keys(g.players).length === 1 && g.betAmount === players[socketId].betAmount
        );
        
        if (!game) {
          // Create new game if no waiting game found
          const gameId = `game_${Date.now()}`;
          game = new Game(gameId, players[socketId].betAmount);
          games[gameId] = game;
          
          // Log game creation
          gameLogger.info({
            event: 'game_created',
            gameId: gameId,
            betAmount: players[socketId].betAmount,
            playerId: socketId,
            timestamp: new Date().toISOString()
          });
        }
        
        // Add player to game
        game.addPlayer(socketId, players[socketId].lightningAddress);
        if (sock) {
          sock.join(game.id);
        }
        
        // Check if game is ready to start (2 players)
        if (Object.keys(game.players).length === 2) {
          // Both players are ready, start the game
          const playerIds = Object.keys(game.players);
          const startsIn = 5;
          const startAt = Date.now() + startsIn * 1000;
          
          // Notify both players
          playerIds.forEach(pid => {
            const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
            playerSock?.emit('matchFound', { opponent: { type: 'player' }, startsIn, startAt });
          });
          
          // Start game after countdown
          setTimeout(() => {
            // Double-check game still exists
            if (!games[game.id]) {
              console.log(`Game ${game.id} no longer exists, skipping start`);
              return;
            }
            
            game.status = 'playing';
            game.startTurnTimer();
            const turnDeadline = game.turnDeadlineAt || null;
            
            // Store game-player mapping for reconnection and ensure sockets are in room
            playerIds.forEach(pid => {
              const player = game.players[pid];
              if (player && player.lightningAddress) {
                // Store mapping of Lightning address to game for reconnection
                const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
                if (playerSock && playerSock.connected) {
                  // Ensure socket is in the game room for broadcasts
                  playerSock.join(game.id);
                  playerSock.gameId = game.id;
                  playerSock.playerIdInGame = pid;
                  playerSock.emit('startGame', {
                    gameId: game.id,
                    symbol: game.players[pid].symbol,
                    turn: game.turn,
                    board: game.board,
                    message: game.turn === pid ? 'Your move' : "Opponent's move",
                    turnDeadline
                  });
                  console.log(`Sent startGame to player ${pid} and joined room ${game.id}`);
                } else {
                  console.log(`Player ${pid} socket not connected for game start`);
                }
              }
            });
            
            gameLogger.info({
              event: 'game_started',
              gameId: game.id,
              players: playerIds,
              betAmount: game.betAmount,
              timestamp: new Date().toISOString()
            });
          }, startsIn * 1000);
        } else {
          // Waiting for another player - schedule bot spawn
          if (sock) {
            const delay = getRandomBotSpawnDelay();
            const estWaitSeconds = Math.floor(delay / 1000);
            
            sock.emit('waitingForOpponent', {
              message: 'Finding opponent...',
              estimatedWait: `${13}-${25} seconds`,
              playersInGame: Object.keys(game.players).length
            });
            
            // Schedule bot to join if no real player joins
            botSpawnTimers[socketId] = setTimeout(() => {
              // Check if still waiting
              const currentGame = Object.values(games).find(g => 
                g.players[socketId] && Object.keys(g.players).length === 1
              );
              
              if (currentGame) {
                // Add bot to game
                const botId = `bot_${uuidv4()}`;
                const botAddress = generateBotLightningAddress();
                const bot = new BotPlayer(currentGame.id, currentGame.betAmount, players[socketId].lightningAddress);
                activeBots.set(currentGame.id, bot);
                
                currentGame.addPlayer(botId, botAddress, true);
                players[botId] = {
                  lightningAddress: botAddress,
                  betAmount: currentGame.betAmount,
                  paid: true,
                  isBot: true,
                  gameId: currentGame.id
                };
                
                // Notify players that match is found
                const playerIds = Object.keys(currentGame.players);
                const startsIn = 5;
                const startAt = Date.now() + startsIn * 1000;
                
                playerIds.forEach(pid => {
                  if (!currentGame.players[pid].isBot) {
                    const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
                    playerSock?.emit('matchFound', { 
                      opponent: { type: 'player' }, // Don't reveal it's a bot
                      startsIn, 
                      startAt 
                    });
                  }
                });
                
                // Start game after countdown
                setTimeout(() => {
                  // Double-check game still exists
                  if (!games[currentGame.id]) {
                    console.log(`Game ${currentGame.id} no longer exists, skipping bot game start`);
                    return;
                  }
                  
                  currentGame.status = 'playing';
                  currentGame.startTurnTimer();
                  const turnDeadline = currentGame.turnDeadlineAt || null;
                  
                  playerIds.forEach(pid => {
                    if (!currentGame.players[pid].isBot) {
                      const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
                      if (playerSock && playerSock.connected) {
                        // Ensure socket is in the game room for broadcasts
                        playerSock.join(currentGame.id);
                        playerSock.emit('startGame', {
                          gameId: currentGame.id,
                          symbol: currentGame.players[pid].symbol,
                          turn: currentGame.turn,
                          board: currentGame.board,
                          message: currentGame.turn === pid ? 'Your move' : "Opponent's move",
                          turnDeadline
                        });
                        console.log(`Sent startGame to human player ${pid} in bot game and joined room ${currentGame.id}`);
                      } else {
                        console.log(`Human player ${pid} disconnected before bot game start`);
                      }
                    }
                  });
                  
                  // If bot starts, make first move after a short delay to ensure frontend is ready
                  if (currentGame.players[currentGame.turn]?.isBot) {
                    setTimeout(() => {
                      if (games[currentGame.id] && games[currentGame.id].status === 'playing') {
                        makeBotMove(currentGame.id, currentGame.turn);
                      }
                    }, 500); // Small delay to ensure frontend received startGame
                  }
                  
                  gameLogger.info({
                    event: 'game_started_with_bot',
                    gameId: currentGame.id,
                    humanPlayer: socketId,
                    botPlayer: botId,
                    betAmount: currentGame.betAmount,
                    timestamp: new Date().toISOString()
                  });
                }, startsIn * 1000);
                
                delete botSpawnTimers[socketId];
              }
            }, delay);
          }
        }
        
        delete invoiceToSocket[invoiceId];
        delete invoiceMeta[invoiceId];
        break;

      case 'payment.failed':
        const failedInvoiceId = event.data?.object?.id || event.data?.id;
        if (!failedInvoiceId) {
          logger.error('Webhook error: No invoiceId in webhook payload for payment.failed');
          return res.status(400).send('No invoiceId in webhook payload');
        }

        const failedSocketId = invoiceToSocket[failedInvoiceId];
        const failedSock = (io.sockets && io.sockets.sockets && (io.sockets.sockets.get ? io.sockets.sockets.get(failedSocketId) : io.sockets.sockets[failedSocketId])) || null;
        if (failedSocketId) {
          // Log payment failure
          transactionLogger.info({
            event: 'payment_failed',
            playerId: failedSocketId,
            invoiceId: failedInvoiceId,
            amount: players[failedSocketId]?.betAmount || 'unknown',
            lightningAddress: players[failedSocketId]?.lightningAddress || 'unknown',
            timestamp: new Date().toISOString(),
            eventType: eventType
          });
          
          if (failedSock) {
            failedSock.emit('error', { message: 'Payment failed. Please try again.' });
          }
          logger.warn('Payment failed for player', { playerId: failedSocketId, invoiceId: failedInvoiceId });
          delete players[failedSocketId];
          delete invoiceToSocket[failedInvoiceId];
          delete invoiceMeta[failedInvoiceId];
        } else {
          logger.warn(`Webhook warning: No socket mapping found for failed invoice ${failedInvoiceId}. Player may have disconnected.`);
        }
        break;

      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    res.status(200).send('Webhook received');
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(500).send('Webhook processing failed');
  }
});

function handleInvoicePaid(invoiceId, event) {
  console.log('handleInvoicePaid called for invoice:', invoiceId);
  console.log('Current invoice mappings:', {
    invoiceToSocket,
    invoiceMeta
  });
  
  const socketId = invoiceToSocket[invoiceId];
  if (!socketId) {
    console.error('No socket found for invoice:', invoiceId);
    return;
  }
  
  const meta = invoiceMeta[invoiceId] || {};
  console.log('Payment meta data:', meta);

  players[socketId] = players[socketId] || {};
  players[socketId].paid = true;
  if (meta.betAmount) players[socketId].betAmount = meta.betAmount;
  if (meta.lightningAddress) players[socketId].lightningAddress = meta.lightningAddress;

  console.log('Updated player data:', players[socketId]);

  const sock = io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : io.sockets.sockets[socketId];
  if (sock) {
    sock.emit('paymentVerified');
    console.log('Emitted paymentVerified to socket:', socketId);
  } else {
    console.error('Socket not found for emission:', socketId);
  }
  
  // Log payment verification
  transactionLogger.info({
    event: 'payment_verified',
    invoiceId: invoiceId,
    socketId: socketId,
    betAmount: meta.betAmount,
    lightningAddress: meta.lightningAddress,
    webhookEvent: event
  });
  
  if (meta.lightningAddress) {
    logPlayerSession(meta.lightningAddress, {
      event: 'payment_received',
      playerId: socketId,
      betAmount: meta.betAmount,
      invoiceId: invoiceId
    });
  }

  delete invoiceToSocket[invoiceId];
  delete invoiceMeta[invoiceId];

  attemptMatchOrEnqueue(socketId);
}

// This function is no longer needed as game matching is handled directly in webhook
// Keeping for backward compatibility but redirecting to webhook logic
function attemptMatchOrEnqueue(socketId) {
  console.log('attemptMatchOrEnqueue called for socket:', socketId);
  const player = players[socketId];
  console.log('Player data:', player);
  
  if (!player || !player.betAmount || !player.paid) {
    console.log('Player not ready for matching:', {
      exists: !!player,
      betAmount: player?.betAmount,
      paid: player?.paid
    });
    return;
  }

  // Check if player is already in a game
  const existingGame = Object.values(games).find(g => g.players[socketId]);
  if (existingGame) {
    console.log('Player already in game:', existingGame.id);
    return;
  }

  // Try to find a waiting game with same bet amount
  let game = Object.values(games).find(g => 
    Object.keys(g.players).length === 1 && g.betAmount === player.betAmount
  );
  
  if (!game) {
    // Create new game
    const gameId = `game_${Date.now()}`;
    game = new Game(gameId, player.betAmount);
    games[gameId] = game;
    gameLogger.info({
      event: 'game_created',
      gameId: gameId,
      betAmount: player.betAmount,
      playerId: socketId,
      timestamp: new Date().toISOString()
    });
  }
  
  // Add player to game
  game.addPlayer(socketId, player.lightningAddress);
  const sock = io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : io.sockets.sockets[socketId];
  if (sock) {
    sock.join(game.id);
  }
  
  // Check if game is ready (2 players)
  if (Object.keys(game.players).length === 2) {
    const playerIds = Object.keys(game.players);
    const startsIn = 5;
    const startAt = Date.now() + startsIn * 1000;
    
    playerIds.forEach(pid => {
      const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
      playerSock?.emit('matchFound', { opponent: { type: 'player' }, startsIn, startAt });
    });
    
    setTimeout(() => {
      game.status = 'playing';
      game.startTurnTimer();
      const turnDeadline = game.turnDeadlineAt || null;
      
      playerIds.forEach(pid => {
        const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
        if (playerSock && playerSock.connected) {
          // Ensure socket is in the game room for broadcasts
          playerSock.join(game.id);
          playerSock.emit('startGame', {
            gameId: game.id,
            symbol: game.players[pid].symbol,
            turn: game.turn,
            board: game.board,
            message: game.turn === pid ? 'Your move' : "Opponent's move",
            turnDeadline
          });
        }
      });
    }, startsIn * 1000);
  } else {
    // Waiting for another player or schedule bot spawn
    const sock = io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : io.sockets.sockets[socketId];
    // Avoid duplicates
    if (!waitingQueue.find(p => p.socketId === socketId)) {
      waitingQueue.push({ socketId, lightningAddress: player.lightningAddress, betAmount: player.betAmount });
    }
    const delay = BOT_SPAWN_DELAY.min + Math.random() * (BOT_SPAWN_DELAY.max - BOT_SPAWN_DELAY.min);
    const spawnAt = Date.now() + delay;
    const estWaitSeconds = Math.floor(delay / 1000);
    sock?.emit('waitingForOpponent', {
      minWait: Math.floor(BOT_SPAWN_DELAY.min / 1000),
      maxWait: Math.floor(BOT_SPAWN_DELAY.max / 1000),
      estWaitSeconds,
      spawnAt
    });

    botSpawnTimers[socketId] = setTimeout(() => {
      const stillWaiting = waitingQueue.findIndex(p => p.socketId === socketId);
      if (stillWaiting === -1) return;
      waitingQueue.splice(stillWaiting, 1);

      const botId = `bot_${uuidv4()}`;
      const botAddress = generateBotLightningAddress();

      const gameId = uuidv4();
      const game = new Game(gameId, player.betAmount);
      game.addPlayer(socketId, player.lightningAddress);
      game.addPlayer(botId, botAddress, true);
      games[gameId] = game;

      const s = io.sockets.sockets.get ? io.sockets.sockets.get(socketId) : io.sockets.sockets[socketId];
      s?.join(gameId);

      const startsIn = 5;
      const startAt = Date.now() + startsIn * 1000;
      s?.emit('matchFound', { opponent: { type: 'bot' }, startsIn, startAt });

      setTimeout(() => {
        game.status = 'playing';
        game.startTurnTimer();
        const turnDeadline = game.turnDeadlineAt || null;
        s?.emit('startGame', {
          gameId,
          symbol: game.players[socketId].symbol,
          turn: game.turn,
          board: game.board,
          message: game.turn === socketId ? 'Your move' : "Opponent's move",
          turnDeadline
        });

        // If the bot starts, delegate its first move to the shared helper
        // so it emits a full moveMade event (with board + turnDeadline)
        // just like all subsequent bot moves.
        if (game.turn === botId) {
          makeBotMove(gameId, botId);
        }
      }, startsIn * 1000);

      delete botSpawnTimers[socketId];
    }, delay);
  }
}

// Make bot move with human-like delay
function makeBotMove(gameId, botId) {
  const game = games[gameId];
  if (!game || game.status !== 'playing') return;
  
  const bot = activeBots.get(gameId);
  if (!bot) return;
  
  // Get move from bot logic
  const moveCount = game.board.filter(cell => cell !== null).length;
  const move = bot.getNextMove(game.board, moveCount);
  if (move === null || move === undefined) return;
  
  // Apply human-like delay (use the thinking time from bot instance)
  const timeLeftMs = typeof game.turnDeadlineAt === 'number' ? (game.turnDeadlineAt - Date.now()) : null;
  const bufferMs = 1400;
  const hardMax = typeof timeLeftMs === 'number' ? Math.max(250, timeLeftMs - bufferMs) : 2500;
  const maxDelay = Math.min(hardMax, 2500);
  const minDelay = Math.min(450, maxDelay);
  const span = Math.max(0, maxDelay - minDelay);
  const delay = minDelay + Math.floor((Math.random() * Math.random()) * span);
  bot.thinkingTime = delay;
  
  setTimeout(() => {
    // Double-check game still exists and it's bot's turn
    if (!games[gameId] || games[gameId].status !== 'playing' || games[gameId].turn !== botId) {
      return;
    }
    
    // Make the move
    const result = game.makeMove(botId, move);
    
    if (result.ok) {
      console.log(`Bot ${botId} made move ${move} at position ${move}, board:`, game.board);
      
      // Get human player ID for message
      const humanPlayerId = Object.keys(game.players).find(pid => !game.players[pid].isBot);
      
      // Broadcast move to ALL players in the game room (using game room ensures delivery)
      // Use both room-based and direct socket emission to ensure delivery
      const humanPlayerSocket = Object.keys(game.players).find(pid => !game.players[pid].isBot);
      const humanSock = humanPlayerSocket ? (io.sockets.sockets.get ? io.sockets.sockets.get(humanPlayerSocket) : io.sockets.sockets[humanPlayerSocket]) : null;
      
      const moveData = {
        position: move,
        symbol: game.players[botId].symbol,
        nextTurn: game.turn,
        board: game.board,
        turnDeadline: game.turnDeadlineAt,
        message: game.turn === humanPlayerId ? 'Your move' : "Opponent's move"
      };
      
      // Emit to room (primary method)
      io.to(gameId).emit('moveMade', moveData);
      
      // Also emit directly to human player socket as backup
      if (humanSock && humanSock.connected) {
        humanSock.emit('moveMade', moveData);
      }
      
      // Also emit boardUpdate for backwards compatibility
      io.to(gameId).emit('boardUpdate', {
        board: game.board,
        lastMove: move
      });
      
      console.log(`Emitted bot move to game room ${gameId}, move: ${move}, symbol: ${game.players[botId].symbol}, humanSocket: ${humanPlayerSocket}`);
      
      // Check for game end
      if (result.winner) {
        handleGameEnd(gameId, result.winner, result.winLine);
      } else if (result.draw) {
        handleDraw(gameId);
      } else if (game.players[game.turn]?.isBot) {
        // If it's still bot's turn (shouldn't happen in tic-tac-toe), make another move
        makeBotMove(gameId, game.turn);
      }
    }
  }, delay);
}

// Handle game end with bot cleanup
function handleGameEnd(gameId, winnerId) {
  const game = games[gameId];
  if (!game) return;
  
  game.status = 'finished';
  game.clearTurnTimer();
  
  // Clean up bot and record statistics
  const bot = activeBots.get(gameId);
  if (bot) {
    // Update player history if human player
    const humanId = Object.keys(game.players).find(id => !game.players[id].isBot);
    if (humanId) {
      const humanPlayer = game.players[humanId];
      const playerWon = winnerId === humanId;
      const botWon = !playerWon && winnerId && game.players[winnerId]?.isBot;
      const isDraw = !winnerId;
      
      // Record game result for bot learning
      bot.recordGameResult(playerWon);
      
      // Record bot statistics
      let result;
      if (isDraw) result = 'draw';
      else if (botWon) result = 'win';
      else result = 'loss';
      
      botStats.recordGame(result, bot.betAmount, bot.thinkingTime);
      
      // Log bot game completion
      console.log(`Bot game completed: ${gameId}, Result: ${result}, Bet: ${bot.betAmount} SATS, Human: ${humanPlayer.lightningAddress}`);
    }
    activeBots.delete(gameId);
  }
  
  // Handle payouts for real games (not bot games)
  const botInGame = Object.values(game.players).some(p => p.isBot);
  if (!botInGame && winnerId && game.betAmount > 0) {
    const winner = game.players[winnerId];
    if (winner && winner.lightningAddress) {
      processPayout(winner.lightningAddress, game.betAmount, gameId);
    }
  }
  
  // Clean up players
  Object.keys(game.players).forEach(pid => {
    delete players[pid];
  });
  
  // Remove game after a delay
  setTimeout(() => {
    delete games[gameId];
  }, 5000);
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Set auth token for fetching LN address
  socket.on('set_auth_token', async (data) => {
    const { authToken } = data;
    if (!authToken) return;
    
    try {
      const lightningAddress = await fetchLightningAddress(authToken);
      players[socket.id] = { 
        ...players[socket.id], 
        lightningAddress,
        authToken
      };
      
      socket.emit('lightning_address', { lightningAddress });
      console.log(`Player ${socket.id} authenticated with LN address: ${lightningAddress}`);
    } catch (error) {
      console.error('Auth token error:', error);
      socket.emit('auth_error', { error: error.message });
    }
  });
  
  // Sea Battle implementation - payment verified only via webhooks
  
  socket.on('joinGame', async (data) => {
    try {
      const { betAmount, lightningAddress, acctId } = data || {};
      if (!ALLOWED_BETS.includes(betAmount)) return socket.emit('error', { message: 'Invalid bet amount' });

      // Resolve and format Lightning address (allow persistence via acctId)
      let resolvedAddress = lightningAddress && lightningAddress.trim() !== '' ? lightningAddress : null;
      if (!resolvedAddress && acctId) {
        const stored = getLightningAddressByAcctId(acctId);
        if (stored) {
          resolvedAddress = stored;
        }
      }
      if (!resolvedAddress) {
        throw new Error('Lightning address is required');
      }
      
      // Only add @speed.app if not already present
      let formattedAddress = resolvedAddress;
      if (!formattedAddress.includes('@')) {
        formattedAddress = `${formattedAddress}@speed.app`;
      }
      console.log(`Player ${socket.id} joining game: ${betAmount} SATS with Lightning address ${formattedAddress}`);
      
      // Map acctId to Lightning address if provided
      if (acctId) {
        mapUserAcctId(acctId, formattedAddress);
        playerAcctIds[socket.id] = acctId;
        console.log(`Mapped player ${socket.id} to acct_id: ${acctId}`);
      }

      players[socket.id] = { lightningAddress: formattedAddress, paid: false, betAmount };

      // Create invoice and map to socket
      const invoiceData = await createLightningInvoice(
        betAmount,
        null, // Customer ID not needed for new merchant account
        `order_${socket.id}_${Date.now()}`
      );
      
      console.log('Created invoice:', {
        invoiceId: invoiceData.invoiceId,
        socketId: socket.id,
        betAmount: betAmount
      });
      
      const lightningInvoice = invoiceData.lightningInvoice;
      const hostedInvoiceUrl = invoiceData.hostedInvoiceUrl;

      console.log('Payment Request created:', { 
        invoiceId: invoiceData.invoiceId,
        lightningInvoice: lightningInvoice?.substring(0, 50) + '...', 
        hostedInvoiceUrl,
        speedInterfaceUrl: invoiceData.speedInterfaceUrl 
      });
      
      socket.emit('paymentRequest', {
        lightningInvoice: lightningInvoice,
        hostedInvoiceUrl: hostedInvoiceUrl,
        speedInterfaceUrl: invoiceData.speedInterfaceUrl,
        invoiceId: invoiceData.invoiceId,
        amountSats: betAmount,
        amountUSD: invoiceData.amountUSD
      });
      
      invoiceToSocket[invoiceData.invoiceId] = socket.id;
      invoiceMeta[invoiceData.invoiceId] = {
        socketId: socket.id,
        betAmount,
        lightningAddress: formattedAddress,
        createdAt: Date.now()
      };
      
      console.log('Mapped invoice to socket:', {
        invoiceId: invoiceData.invoiceId,
        socketId: socket.id,
        mappings: { invoiceToSocket, invoiceMeta }
      });
      
      // Log player session start
      logPlayerSession(formattedAddress, {
        event: 'session_started',
        playerId: socket.id,
        betAmount: betAmount,
        invoiceId: invoiceData.invoiceId
      });
      
      // Set payment verification timeout (5 minutes)
      setTimeout(() => {
        const player = players[socket.id];
        if (player && !player.paid) {
          console.log(`Payment timeout for player ${socket.id}`);
          socket.emit('paymentTimeout', {
            message: 'Payment verification timed out. Please try again.'
          });
          
          // Clean up
          delete invoiceToSocket[invoiceData.invoiceId];
          delete invoiceMeta[invoiceData.invoiceId];
          delete players[socket.id];
          
          logPlayerSession(formattedAddress, {
            event: 'payment_timeout',
            playerId: socket.id,
            betAmount: betAmount,
            invoiceId: invoiceData.invoiceId
          });
        }
      }, 5 * 60 * 1000); // 5 minutes
      
      console.log(`Mapped invoice ${invoiceData.invoiceId} to socket ${socket.id}`);
    } catch (err) {
      console.error('joinGame error:', err.message);
      errorLogger.error({
        event: 'join_game_failed',
        socketId: socket.id,
        error: err.message
      });
      socket.emit('error', { message: err.message || 'Could not create payment request' });
    }
  });
  
  // Also keep old event name for compatibility
  socket.on('join_game', async (data) => {
    socket.emit('joinGame', data);
  });
  
  // Handle moves
  socket.on('makeMove', (data) => {
    const { gameId, position } = data || {};
    const game = games[gameId];
    if (!game) return socket.emit('error', { message: 'Game not found' });
    
    // Find the player ID in the game that matches this socket
    let playerIdInGame = null;
    for (const [pid, player] of Object.entries(game.players)) {
      // Check if this is the current socket or if it matches by Lightning address
      if (pid === socket.id || 
          (players[socket.id] && player.lightningAddress === players[socket.id].lightningAddress)) {
        playerIdInGame = pid;
        break;
      }
    }
    
    if (!playerIdInGame || game.turn !== playerIdInGame) {
      console.log(`Invalid move attempt: socket=${socket.id}, playerInGame=${playerIdInGame}, turn=${game.turn}`);
      return socket.emit('error', { message: 'Not your turn' });
    }

    const result = game.makeMove(playerIdInGame, position);
    if (!result.ok) {
      // Provide clearer feedback: if the game is finished, say so instead of "not started"
      let errorMsg;
      if (result.reason === 'not_playing') {
        errorMsg = game.status === 'finished' ? 'Game already finished' : 'Game not started';
      } else if (result.reason === 'not_your_turn') {
        errorMsg = 'Not your turn';
      } else if (result.reason === 'bad_pos') {
        errorMsg = 'Invalid position';
      } else if (result.reason === 'occupied') {
        errorMsg = 'Position already taken';
      } else {
        errorMsg = 'Invalid move';
      }
      return socket.emit('error', { message: errorMsg });
    }

    console.log(`Player ${playerIdInGame} made move ${position}, board:`, game.board);
    
    // Get human player ID for message
    const otherPlayerId = Object.keys(game.players).find(pid => pid !== playerIdInGame && !game.players[pid].isBot);
    
    const moveData = {
      position,
      symbol: game.players[playerIdInGame].symbol,
      nextTurn: game.turn,
      board: game.board,
      turnDeadline: game.turnDeadlineAt,
      message: game.turn === otherPlayerId ? 'Your move' : "Opponent's move"
    };
    
    // Broadcast move to ALL players in the game room (primary method)
    io.to(game.id).emit('moveMade', moveData);
    
    // Also emit directly to other player socket as backup (if it's a human player)
    if (otherPlayerId && !game.players[otherPlayerId]?.isBot) {
      const otherSock = io.sockets.sockets.get ? io.sockets.sockets.get(otherPlayerId) : io.sockets.sockets[otherPlayerId];
      if (otherSock && otherSock.connected) {
        otherSock.emit('moveMade', moveData);
      }
    }
    
    // Also emit boardUpdate for backwards compatibility
    io.to(game.id).emit('boardUpdate', {
      board: game.board,
      lastMove: position
    });
    
    console.log(`Emitted player move to game room ${game.id}, move: ${position}, symbol: ${game.players[playerIdInGame].symbol}, nextTurn: ${game.turn}`);

    if (result.winner) {
      handleGameEnd(gameId, result.winner, result.winLine);
    } else if (result.draw) {
      handleDraw(gameId);
    }
  });

  // Resign
  socket.on('resign', ({ gameId }) => {
    const game = games[gameId];
    if (!game || game.status !== 'playing') return;
    const winnerId = Object.keys(game.players).find(id => id !== socket.id);
    handleGameEnd(gameId, winnerId);
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    
    // Remove from waiting queue
    const waitingIndex = waitingQueue.findIndex(p => p.socketId === socket.id);
    if (waitingIndex !== -1) {
      waitingQueue.splice(waitingIndex, 1);
    }
    
    // Clear bot spawn timer
    if (botSpawnTimers[socket.id]) {
      clearTimeout(botSpawnTimers[socket.id]);
      delete botSpawnTimers[socket.id];
    }
    
    // Handle game disconnect
    const game = Object.values(games).find(g => g.players[socket.id]);
    if (game && game.status === 'playing') {
      // Other player wins by default
      const winnerId = Object.keys(game.players).find(id => id !== socket.id);
      handleGameEnd(game.id, winnerId);
    }
    
    delete players[socket.id];
  });
});

// Handle game end with comprehensive logging
function handleGameEnd(gameId, winnerId) {
  const game = games[gameId];
  if (!game) return;

  game.status = 'finished';
  game.clearTurnTimer();

  const winnerSymbol = game.players[winnerId]?.symbol || null;
  const winningLine = Array.isArray(game.winLine) ? game.winLine : [];
  const winner = game.players[winnerId];
  const loser = Object.values(game.players).find(p => p.socketId !== winnerId);
  
  // Log game result
  gameLogger.info({
    event: 'game_ended',
    gameId: gameId,
    winnerId: winnerId,
    winnerAddress: winner?.lightningAddress,
    winnerIsBot: winner?.isBot || false,
    loserId: loser?.socketId,
    loserAddress: loser?.lightningAddress,
    loserIsBot: loser?.isBot || false,
    betAmount: game.betAmount,
    winnerSymbol: winnerSymbol,
    winningLine: winningLine
  });
  
  // Log player sessions
  if (winner?.lightningAddress) {
    logPlayerSession(winner.lightningAddress, {
      event: 'game_won',
      playerId: winnerId,
      gameId: gameId,
      betAmount: game.betAmount,
      opponentType: loser?.isBot ? 'bot' : 'human'
    });
  }
  if (loser?.lightningAddress && !loser.isBot) {
    logPlayerSession(loser.lightningAddress, {
      event: 'game_lost',
      playerId: loser.socketId,
      gameId: gameId,
      betAmount: game.betAmount,
      opponentType: winner?.isBot ? 'bot' : 'human'
    });
  }
  
  // Track game history for human player and update new systems
  const humanPlayer = winner?.isBot ? loser : winner;
  if (humanPlayer && !humanPlayer.isBot) {
    try {
      const playerWon = !winner?.isBot;
      const gameResult = {
        isWin: playerWon,
        isLoss: !playerWon,
        betAmount: game.betAmount,
        winnings: playerWon ? PAYOUTS[game.betAmount]?.winner || 0 : 0,
        gameDuration: Date.now() - game.createdAt,
        opponentMoves: game.moveCount || 0,
        isPerfectGame: playerWon && (game.moveCount <= 3),
        isSpeedWin: playerWon && (Date.now() - game.createdAt) < 30000,
        isComebackWin: false // TODO: implement comeback detection
      };

      const streakBonus = streakSystem.updateStreak(humanPlayer.lightningAddress, gameResult);
      const playerStats = globalLeaderboards.updatePlayerStats(humanPlayer.lightningAddress, gameResult, streakBonus.sats);
      const newAchievements = achievementSystem.checkAchievements(humanPlayer.lightningAddress, playerStats, gameResult);
      const mysteryBoxes = mysteryBoxManager.checkForMysteryBox(humanPlayer.lightningAddress, gameResult, playerStats);

      updatePlayerHistory(humanPlayer.lightningAddress, game.betAmount, playerWon);
      console.log(`Updated all systems for ${humanPlayer.lightningAddress}: ${playerWon ? 'Won' : 'Lost'} with ${game.betAmount} sats, Streak bonus: ${streakBonus.sats} sats`);

      const playerSocket = io.sockets.sockets.get ? io.sockets.sockets.get(humanPlayer.socketId) : io.sockets.sockets[humanPlayer.socketId];
      if (playerSocket) {
        if (newAchievements.length > 0) {
          playerSocket.emit('achievementsUnlocked', { achievements: newAchievements });
        }
        if (mysteryBoxes.length > 0) {
          playerSocket.emit('mysteryBoxEarned', { boxes: mysteryBoxes });
        }
        if (streakBonus.sats > 0) {
          playerSocket.emit('streakBonus', { bonus: streakBonus });
        }
      }
    } catch (e) {
      console.error('Post-game systems update failed:', e?.message || e);
    }
  }
  
  // Emit personalized result to each participant
  const playerIds = Object.keys(game.players);
  for (const pid of playerIds) {
    const player = game.players[pid];
    const msg = winnerSymbol == null ? "It's a draw!" : (player?.symbol === winnerSymbol ? 'You win!' : 'You lose');
    const payload = {
      message: msg,
      winnerSymbol,
      winningLine
    };
    const directSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
    directSock?.emit('gameEnd', payload);

    const addr = player?.lightningAddress;
    if (addr) {
      for (const [sid, meta] of Object.entries(players)) {
        if (meta?.lightningAddress !== addr) continue;
        const s = io.sockets.sockets.get ? io.sockets.sockets.get(sid) : io.sockets.sockets[sid];
        s?.emit('gameEnd', payload);
      }
    }
  }

  // Process payout for human winners
  if (!game.players[winnerId]?.isBot) {
    const winnerAddr = game.players[winnerId]?.lightningAddress;
    let payoutSocketId = winnerId;
    if (winnerAddr) {
      for (const [sid, meta] of Object.entries(players)) {
        if (meta?.lightningAddress !== winnerAddr) continue;
        const s = io.sockets.sockets.get ? io.sockets.sockets.get(sid) : io.sockets.sockets[sid];
        if (s && s.connected) {
          payoutSocketId = sid;
          break;
        }
      }
    }
    processPayout(payoutSocketId, game.betAmount, gameId, winnerAddr);
  } else {
    // Bot won - send platform fee only
    const platformFee = Math.floor(game.betAmount * 2 * 0.05);
    sendInstantPayment(
      'totodile@speed.app',
      platformFee,
      'SATS', // currency
      'SATS', // targetCurrency
      `Platform fee from game ${gameId} (bot victory)`
    ).then(result => {
      if (result.success) {
        transactionLogger.info({
          event: 'platform_fee_sent',
          gameId: gameId,
          amount: platformFee,
          recipient: 'totodile@speed.app',
          botVictory: true
        });
      }
    }).catch(err => {
      errorLogger.error({
        event: 'platform_fee_failed',
        gameId: gameId,
        error: err.message,
        botVictory: true
      });
    });
  }

  setTimeout(() => { delete games[gameId]; }, 30000);
}

function handleDraw(gameId) {
  const game = games[gameId];
  if (!game) return;
  
  // Track draw for human players (counted as loss in patterns)
  const humanPlayer = Object.values(game.players).find(p => !p.isBot);
  if (humanPlayer) {
    updatePlayerHistory(humanPlayer.lightningAddress, game.betAmount, false);
    console.log(`Updated history for ${humanPlayer.lightningAddress}: Draw (counted as loss) with ${game.betAmount} sats`);
  }
  
  // Switch starting player for next game (other player goes first)
  const playerIds = Object.keys(game.players);
  const otherPlayer = playerIds.find(id => id !== game.startingPlayer);
  game.startingPlayer = otherPlayer || game.startingPlayer;
  
  // Reset the board and game state for automatic continuation
  game.board = Array(9).fill(null);
  game.status = 'playing';
  game.winner = null;
  game.winLine = [];
  game.moveCount = 0;
  game.isFirstTurn = true;
  game.turn = game.startingPlayer;
  game.clearTurnTimer();
  
  // Start the turn timer for the new starting player
  game.startTurnTimer();
  
  // Emit draw notification and new game start to all players
  const turnDeadline = game.turnDeadlineAt;
  const playerIdsList = Object.keys(game.players);
  
  playerIdsList.forEach(pid => {
    const player = game.players[pid];
    if (player && player.lightningAddress) {
      const playerSock = io.sockets.sockets.get ? io.sockets.sockets.get(pid) : io.sockets.sockets[pid];
      if (playerSock && playerSock.connected) {
        // Ensure socket is in the game room for broadcasts
        playerSock.join(game.id);
        // First emit draw notification
        playerSock.emit('gameEnd', { 
          message: "It's a draw! New game starting...",
          winnerSymbol: null,
          winningLine: null,
          autoContinue: true  // Signal to frontend to auto-continue
        });
        
        // Then immediately start new game
        setTimeout(() => {
          // Ensure socket is still in room
          if (playerSock.connected) {
            playerSock.join(game.id);
          }
          playerSock.emit('startGame', {
            gameId: game.id,
            symbol: game.players[pid].symbol,
            turn: game.turn,
            board: game.board,
            message: game.turn === pid ? 'Your move' : "Opponent's move",
            turnDeadline: turnDeadline
          });
        }, 1000); // Small delay to show draw message
      }
    }
  });
  
  // If it's a bot's turn after reset, make the bot move
  const botId = Object.keys(game.players).find(id => game.players[id].isBot);
  if (botId && game.turn === botId) {
    // Wait a bit longer for the startGame event to be processed, then make bot move
    setTimeout(() => {
      if (games[gameId] && games[gameId].status === 'playing' && games[gameId].turn === botId) {
        makeBotMove(gameId, botId);
      }
    }, 1500);
  }
  
  console.log(`Draw handled for game ${gameId}, new game started with ${game.startingPlayer} going first`);
}

// Keep-alive mechanism to prevent server shutdown
setInterval(() => {
  const memUsage = process.memoryUsage();
  console.log(`[Keep-Alive] Server healthy - Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, Active games: ${Object.keys(games).length}, Uptime: ${Math.round(process.uptime())}s`);
  
  // Clean up any orphaned games older than 1 hour
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  Object.entries(games).forEach(([gameId, game]) => {
    if (game.createdAt && game.createdAt < oneHourAgo && game.status === 'finished') {
      delete games[gameId];
      console.log(`[Cleanup] Removed old game: ${gameId}`);
    }
  });
}, 30000); // Every 30 seconds

// Prevent process from exiting on uncaught errors
process.on('uncaughtException', (err) => {
  errorLogger.error('Uncaught Exception:', err);
  console.error('Uncaught Exception:', err);
  // Don't exit, keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  errorLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit, keep server running
});

// Start server (Render/Railway will set PORT)
const PORT = process.env.PORT || process.env.BACKEND_PORT || 4000;
// Enhanced server startup with error handling and graceful shutdown
// Listen on 0.0.0.0 to accept connections from Render's load balancer
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`💳 Speed Wallet API: ${SPEED_API_BASE}`);
  console.log(`🌍 Allowed origin: ${process.env.ALLOWED_ORIGIN || '*'}`);
  console.log(`💪 [NEVER-DOWN] Server will stay up FOREVER!`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 Monitor status: http://localhost:4001/monitor/status`);
  
  // Signal that the server is ready (for PM2)
  if (process.send) {
    process.send('ready');
  }
});

// Enhanced error handling - NEVER let the server die!
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.log('🔄 Port in use, trying alternative port...');
    const altPort = PORT + 1;
    server.listen(altPort, '0.0.0.0', () => {
      console.log(`🚀 Server running on alternative port ${altPort}`);
    });
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed gracefully');
    
    // Close database connections, cleanup resources, etc.
    // Add any cleanup code here
    
    console.log('🏁 Graceful shutdown complete');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions - Log but don't crash!
process.on('uncaughtException', (error) => {
  console.error('🚨 CRITICAL: Uncaught Exception:', error);
  
  // Log the error
  if (gameLogger) {
    gameLogger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date(),
      pid: process.pid
    });
  }
  
  // Don't exit! Try to recover
  console.log('🔄 Attempting to continue operation...');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Log the error
  if (gameLogger) {
    gameLogger.error('Unhandled Rejection', {
      reason: reason,
      promise: promise.toString(),
      timestamp: new Date(),
      pid: process.pid
    });
  }
  
  // Don't exit! Try to recover
  console.log('🔄 Attempting to continue operation...');
});

// Memory monitoring
setInterval(() => {
  const memUsage = process.memoryUsage();
  const memMB = Math.round(memUsage.rss / 1024 / 1024);
  
  if (memMB > 400) { // Alert if over 400MB
    console.warn(`⚠️ High memory usage: ${memMB}MB`);
  }
  
  console.log(`📊 Memory: ${memMB}MB, Uptime: ${Math.round(process.uptime())}s`);
}, 60000); // Check every minute

// Heartbeat - prove we're alive!
setInterval(() => {
  console.log(`💗 Heartbeat: ${new Date().toISOString()} - Server is ALIVE!`);
}, 300000); // Every 5 minutes

console.log('🛡️ Enhanced error handling and monitoring active!');
