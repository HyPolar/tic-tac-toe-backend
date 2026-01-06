import React, { useEffect, useMemo, useRef, useState } from 'react';
import io from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';

import PracticeBoard from './components/PracticeBoard';
import StartScreen from './components/StartScreen';
import PaymentScreen from './components/PaymentScreen';
import WaitingScreen from './components/WaitingScreen';
import GameScreen from './components/GameScreen';
import AchievementSystem from './components/AchievementSystem';
import MysteryBoxes from './components/MysteryBoxes';
import LeaderboardSystem from './components/LeaderboardSystem';
import './styles.css';
import './components/NewFeatures.css';
const PAYOUTS = {
  50: { winner: 80 },
  300: { winner: 500 },
  500: { winner: 800 },
  1000: { winner: 1700 },
  5000: { winner: 8000 },
  10000: { winner: 17000 },
};
const BET_OPTIONS = Object.keys(PAYOUTS).map(k => ({ amount: parseInt(k, 10), winnings: PAYOUTS[k].winner }));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function App() {
  const [activeTab, setActiveTab] = useState('Menu');
  const [gameState, setGameState] = useState('menu');
  const [currentScreen, setCurrentScreen] = useState('menu'); // 'menu', 'start', 'payment', 'waiting', 'game'
  const [socket, setSocket] = useState(null);
  const [socketId, setSocketId] = useState(null);
  // Track live gameState inside socket event handlers created once
  const gameStateRef = useRef('menu');

  const [betAmount, setBetAmount] = useState(() => localStorage.getItem('ttt_lastBet') || '50');
  const [payoutAmount, setPayoutAmount] = useState(() => {
    const saved = localStorage.getItem('ttt_lastBet');
    const opt = BET_OPTIONS.find(o => o.amount === parseInt(saved || '50'));
    return opt ? String(opt.winnings) : '80';
  });
  const [lightningAddress, setLightningAddress] = useState('');
  const [acctId, setAcctId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [lnurl, setLnurl] = useState('');
  const [addressLocked, setAddressLocked] = useState(false);

  // Payment state
  const [paymentInfo, setPaymentInfo] = useState(null); // { invoiceId, lightningInvoice, hostedInvoiceUrl, amountSats, amountUSD }
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);

  // Game state
  const [gameId, setGameId] = useState(null);
  const [symbol, setSymbol] = useState(null); // 'X' | 'O'
  const [opponent, setOpponent] = useState(null); // opponent info
  const [turn, setTurn] = useState(null); // socketId whose turn
  const [board, setBoard] = useState(Array(9).fill(null));
  const [message, setMessage] = useState('');
  const [lastMove, setLastMove] = useState(null);
  const [winningLine, setWinningLine] = useState(null);
  const [turnDeadline, setTurnDeadline] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null); // seconds
  const [connected, setConnected] = useState(false);
  const [showHowToModal, setShowHowToModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('ttt_theme');
    return saved || 'blue'; // Default to blue theme instead of simple (green)
  });
  const [turnDuration, setTurnDuration] = useState(null); // seconds for current turn
  const confettiRef = useRef(null);
  const [showSettings, setShowSettings] = useState(false);
  const [sfxEnabled, setSfxEnabled] = useState(() => localStorage.getItem('ttt_sfx') !== '0');
  const [hapticsEnabled, setHapticsEnabled] = useState(() => localStorage.getItem('ttt_haptics') !== '0');
  const [tiltEnabled, setTiltEnabled] = useState(() => localStorage.getItem('ttt_tilt') !== '0');
  const boardRef = useRef(null);
  const audioCtxRef = useRef(null);
  const touchStartRef = useRef(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [moveLocked, setMoveLocked] = useState(false);

  // Calculate turn progress for timer visualization
  const turnProgress = useMemo(() => {
    if (typeof turnDuration !== 'number' || typeof timeLeft !== 'number') return 0;
    if (turnDuration <= 0) return 0;
    // Return a 0..1 fraction; the visual component clamps to [0,1]
    return (turnDuration - timeLeft) / turnDuration;
  }, [turnDuration, timeLeft]);
  const [waitingInfo, setWaitingInfo] = useState(null); // { minWait, maxWait, estWaitSeconds, spawnAt }
  const waitingIntervalRef = useRef(null);
  const [waitingSecondsLeft, setWaitingSecondsLeft] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null); // { opponent, startsIn, startAt }
  const matchIntervalRef = useRef(null);
  const [matchSecondsLeft, setMatchSecondsLeft] = useState(null);

  // New addictive features state
  const [showAchievements, setShowAchievements] = useState(false);
  const [showMysteryBoxes, setShowMysteryBoxes] = useState(false);
  const [showLeaderboards, setShowLeaderboards] = useState(false);
  const [playerSats, setPlayerSats] = useState(0);
  const [newAchievement, setNewAchievement] = useState(null);
  const [newMysteryBox, setNewMysteryBox] = useState(null);
  const [streakBonus, setStreakBonus] = useState(0);

  // History
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ttt_history') || '[]'); } catch { return []; }
  });

  const stats = useMemo(() => {
    let wins = 0, losses = 0, net = 0, streak = 0, cur = 0;
    for (const h of history) {
      if (h.outcome === 'win') { wins++; net += h.amount; cur = cur >= 0 ? cur + 1 : 1; }
      else { losses++; net += h.amount; cur = cur <= 0 ? cur - 1 : -1; }
    }
    streak = cur;
    const total = wins + losses;
    const wr = total ? Math.round((wins / total) * 100) : 0;
    return { wins, losses, net, streak, winrate: wr };
  }, [history]);

  useEffect(() => {
    const wake = () => {
      fetch(`${BACKEND_URL}/health`, { cache: 'no-store' }).catch(() => {});
    };
    wake();
    const interval = setInterval(wake, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // keep ref in sync for handlers
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 25000,
    });
    setSocket(s);

    const lastConnectErrorAtRef = { current: 0 };
    const connectErrorCountRef = { current: 0 };

    const handlers = {
      connect: () => {
        setSocketId(s.id);
        setConnected(true);
        setMoveLocked(false);
        connectErrorCountRef.current = 0;
      },
      disconnect: () => {
        setConnected(false);
        setMoveLocked(false);
        setMessage('Disconnected. Retrying...');
      },
      connect_error: (err) => {
        setConnected(false);
        setMoveLocked(false);
        const now = Date.now();
        // Avoid spamming the UI; Socket.IO can emit frequent connect_error events while reconnecting.
        if (now - lastConnectErrorAtRef.current > 1500) {
          lastConnectErrorAtRef.current = now;
          connectErrorCountRef.current += 1;
          if (connectErrorCountRef.current >= 6) {
            setMessage(`Cannot reach server at ${BACKEND_URL}`);
          } else {
            setMessage('Connecting...');
          }
        }
        // Keep detailed error in console for debugging.
        if (err) console.warn('Socket connect_error:', err);
      },
      error: (payload) => {
        const msg = typeof payload === 'string' ? payload : (payload?.message || 'Error');
        setMoveLocked(false);
        // Suppress noisy errors during/after a game that can be caused by late clicks/race conditions
        if ((msg === 'Game not started' || msg === 'Game not found' || msg === 'Invalid move' || msg === 'Game already finished')
            && (gameStateRef.current === 'playing' || gameStateRef.current === 'finished')) {
          return;
        }
        setMessage(msg);
      },
      paymentRequest: async ({ lightningInvoice, hostedInvoiceUrl, amountSats, amountUSD, invoiceId, speedInterfaceUrl }) => {
        const data = { lightningInvoice, hostedInvoiceUrl, amountSats, amountUSD, invoiceId, speedInterfaceUrl };
        setPaymentInfo(data);
        setLnurl(lightningInvoice || hostedInvoiceUrl);
        setQrCode('');
        setMessage(`Pay ${amountSats} SATS (~$${amountUSD})`);
        setGameState('awaitingPayment');
        setCurrentScreen('payment');
        setIsWaitingForPayment(true);

        // Generate QR code for Lightning invoice
        if (lightningInvoice) {
          try {
            const response = await fetch(`${BACKEND_URL}/api/generate-qr`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ invoice: lightningInvoice })
            });
            const qrData = await response.json();
            if (qrData.qr) {
              setQrCode(qrData.qr);
            }
          } catch (error) {
            console.error('Failed to generate QR code:', error);
          }
        }

        // Store Speed interface URL if available
        if (speedInterfaceUrl) {
          localStorage.setItem('speedInterfaceUrl', speedInterfaceUrl);
        }

        // Start polling payment status for local testing (since webhooks don't work locally)
        const pollInterval = setInterval(async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/check-payment/${invoiceId}`);
            const result = await response.json();
            if (result.success && (result.status === 'paid' || result.status === 'completed')) {
              clearInterval(pollInterval);
              // Payment verified - this will trigger the paymentVerified socket event from backend
            }
          } catch (error) {
            console.error('Payment polling error:', error);
          }
        }, 3000); // Check every 3 seconds

        // Stop polling after 10 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
        }, 600000);
      },
      payment_sent: ({ amount, status, txId }) => {
        setMessage(`Payout sent: ${amount} SATS${txId ? ` (tx: ${txId})` : ''}`);
      },
      payment_error: ({ error }) => {
        setMessage(`Payout error: ${error || 'Unknown error'}`);
      },
      paymentVerified: () => {
        setIsWaitingForPayment(false);
        setMessage('Payment verified! Waiting for opponent...');
        setGameState('waiting');
        setCurrentScreen('waiting');
      },
      paymentTimeout: ({ message }) => {
        // Stop waiting and prompt user to retry
        setIsWaitingForPayment(false);
        setPaymentInfo(null);
        setMessage(message || 'Payment verification timed out. Please try again.');
        setGameState('splash');
        setCurrentScreen('start');
        setWaitingInfo(null);
        setWaitingSecondsLeft(null);
        setMatchInfo(null);
        setMatchSecondsLeft(null);
        setAddressLocked(false);
        if (waitingIntervalRef.current) { clearInterval(waitingIntervalRef.current); waitingIntervalRef.current = null; }
        if (matchIntervalRef.current) { clearInterval(matchIntervalRef.current); matchIntervalRef.current = null; }
      },
      paymentStatus: ({ status, message }) => {
        console.log('Payment status:', status, message);
        if (status === 'pending' || status === 'unpaid') {
          setMessage('Payment pending... Please complete the payment');
        } else if (status === 'error') {
          setMessage(`Payment check error: ${message || 'Unknown error'}`);
        }
      },
      transaction: ({ message }) => {
        setMessage(message);
      },
      waitingForOpponent: (payload) => {
        // Start waiting countdown until potential bot spawn or human arrival
        const { message, estimatedWait, playersInGame } = payload || {};
        setGameState('waiting');
        setCurrentScreen('waiting');
        setMessage(message || 'Finding opponent...');
        
        // Set estimated wait time: 13-25 seconds
        const minWait = 13;
        const maxWait = 25;
        setWaitingInfo({ minWait, maxWait, estimatedWait: '13-25 seconds' });
        // Start countdown from max wait time
        setWaitingSecondsLeft(maxWait);
        
        if (waitingIntervalRef.current) { 
          clearInterval(waitingIntervalRef.current); 
        }
        
        const startTime = Date.now();
        waitingIntervalRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTime) / 1000);
          const remaining = Math.max(0, maxWait - elapsed);
          setWaitingSecondsLeft(remaining);
        }, 1000);
        
        setMatchInfo(null);
      },
      matchFound: ({ opponent, startsIn, startAt }) => {
        // Switch to pre-game countdown: "Opponent found, starting in 5..."
        if (waitingIntervalRef.current) { clearInterval(waitingIntervalRef.current); waitingIntervalRef.current = null; }
        setWaitingInfo(null);
        const countdownStart = Date.now() + 5000;
        setMatchInfo({ opponent, startsIn: 5, startAt: countdownStart });
        setGameState('waiting');
        setMessage('Opponent found! Starting game in...');
        
        // Start countdown from 5
        setMatchSecondsLeft(5);
        if (matchIntervalRef.current) { clearInterval(matchIntervalRef.current); }
        const tick = () => {
          const secs = Math.max(0, Math.ceil((countdownStart - Date.now()) / 1000));
          setMatchSecondsLeft(secs);
          // Clear interval when countdown reaches 0
          if (secs <= 0 && matchIntervalRef.current) {
            clearInterval(matchIntervalRef.current);
            matchIntervalRef.current = null;
          }
        };
        tick();
        matchIntervalRef.current = setInterval(tick, 250);
      },
      startGame: ({ gameId, symbol, turn, board, message, turnDeadline }) => {
        console.log('startGame event received:', { gameId, symbol, turn, board, message });
        setMoveLocked(false);
        // Clear waiting/match timers on actual game start
        if (waitingIntervalRef.current) { clearInterval(waitingIntervalRef.current); waitingIntervalRef.current = null; }
        if (matchIntervalRef.current) { clearInterval(matchIntervalRef.current); matchIntervalRef.current = null; }
        setWaitingInfo(null);
        setMatchInfo(null);
        setWaitingSecondsLeft(null);
        setMatchSecondsLeft(null);
        setGameId(gameId);
        setSymbol(symbol);
        setTurn(turn);
        // Force board reset with new array reference
        const newBoard = board && Array.isArray(board) ? [...board] : Array(9).fill(null);
        setBoard(newBoard);
        setLastMove(null);
        setWinningLine(null);
        setTurnDeadline(turnDeadline || null);
        const ttl = turnDeadline ? Math.max(1, Math.ceil((Number(turnDeadline) - Date.now()) / 1000)) : null;
        setTurnDuration(ttl);
        setGameState('playing');
        setCurrentScreen('game');
        setShowStartModal(false);
        setMessage(message || (turn === s.id ? 'Your move' : "Opponent's move"));
      },
      boardUpdate: ({ board, lastMove }) => {
        // Force immediate board update
        console.log('boardUpdate event received:', { board, lastMove });
        setBoard([...board]); // Create new array to force React re-render
        setLastMove(typeof lastMove === 'number' ? lastMove : null);
      },
      moveMade: ({ position, symbol, nextTurn, board, turnDeadline, message }) => {
        // Force immediate board update - don't wait for any conditions
        console.log('moveMade event received:', { position, symbol, nextTurn, board, message });
        setMoveLocked(false);
        // Always update board immediately when move is received
        if (board && Array.isArray(board)) {
          setBoard([...board]); // Create new array to force React re-render
        }
        setLastMove(position);
        setTurn(nextTurn);
        setTurnDeadline(turnDeadline || null);
        const ttl = turnDeadline ? Math.max(1, Math.ceil((Number(turnDeadline) - Date.now()) / 1000)) : null;
        setTurnDuration(ttl);
        setMessage(message || (nextTurn === s.id ? 'Your move' : "Opponent's move"));
      },
      nextTurn: ({ turn, turnDeadline, message }) => {
        setMoveLocked(false);
        setTurn(turn);
        setTurnDeadline(turnDeadline || null);
        const ttl = turnDeadline ? Math.max(1, Math.ceil((Number(turnDeadline) - Date.now()) / 1000)) : null;
        setTurnDuration(ttl);
        setMessage(message || (turn === s.id ? 'Your move' : "Opponent's move"));
      },
      gameEnd: ({ message, winnerSymbol, winningLine, streakBonus: bonus, autoContinue }) => {
        setMoveLocked(false);
        // Save to history
        const isWin = !!(winnerSymbol && symbol && winnerSymbol === symbol);
        const isDraw = winnerSymbol == null;
        const entry = {
          id: `g_${Date.now()}`,
          ts: new Date().toISOString(),
          bet: parseInt(betAmount, 10),
          outcome: isDraw ? 'draw' : (isWin ? 'win' : 'loss'),
          amount: isDraw ? 0 : (isWin ? (PAYOUTS[betAmount]?.winner - parseInt(betAmount,10)) : -parseInt(betAmount,10)),
        };
        const newHist = [entry, ...history].slice(0, 100);
        setHistory(newHist);
        localStorage.setItem('ttt_history', JSON.stringify(newHist));
        
        // If autoContinue is true (draw with automatic new game), don't set to finished
        // Just show the message and wait for startGame event
        if (autoContinue && isDraw) {
          console.log('Draw detected with autoContinue, clearing board and waiting for startGame');
          setMessage(message);
          setWinningLine(null);
          // Clear the board immediately to avoid showing stale data
          setBoard(Array(9).fill(null));
          setLastMove(null);
          setTurn(null);
          setTurnDeadline(null);
          setTimeLeft(null);
          // Don't set gameState to 'finished' - keep it playing so startGame can reset it
          // The startGame event will reset everything properly
          return; // Exit early, startGame will handle the reset
        }
        
        // Normal game end (win/loss or draw without autoContinue)
        setGameState('finished');
        setMessage(message);
        setWinningLine(Array.isArray(winningLine) ? winningLine : null);
        setTurnDeadline(null);
        setTimeLeft(null);
        if (bonus) {
          setStreakBonus(bonus);
          setTimeout(() => setStreakBonus(0), 5000);
        }
        if (isWin) {
          launchConfetti();
          sfxPlay('win');
          triggerHaptic([30, 40, 30]);
        } else if (isDraw) {
          // no-op for draw
        } else {
          sfxPlay('lose');
          triggerHaptic([15, 25]);
        }
      },
      // New addictive features events
      newAchievement: ({ achievement, reward }) => {
        setNewAchievement({ achievement, reward });
        setTimeout(() => setNewAchievement(null), 5000);
      },
      mysteryBoxAwarded: ({ boxType, reason }) => {
        setNewMysteryBox({ boxType, reason });
        setTimeout(() => setNewMysteryBox(null), 5000);
      },
      playerStatsUpdate: ({ sats, stats }) => {
        setPlayerSats(sats || 0);
      },
    };

    for (const [event, handler] of Object.entries(handlers)) {
      s.on(event, handler);
    }

    return () => {
      Object.entries(handlers).forEach(([evt, fn]) => s.off(evt, fn));
      s.disconnect();
    };
  }, []);

  // Update payout when bet changes
  useEffect(() => {
    const opt = BET_OPTIONS.find(o => o.amount === parseInt(betAmount, 10));
    setPayoutAmount(String(opt?.winnings || 0));
  }, [betAmount]);

  // Persist toggles
  useEffect(() => {
    localStorage.setItem('ttt_sfx', sfxEnabled ? '1' : '0');
    localStorage.setItem('ttt_haptics', hapticsEnabled ? '1' : '0');
    localStorage.setItem('ttt_tilt', tiltEnabled ? '1' : '0');
  }, [sfxEnabled, hapticsEnabled, tiltEnabled]);

  // Fetch player stats when connected
  useEffect(() => {
    if (connected && lightningAddress && socket) {
      socket.emit('requestPlayerStats', { lightningAddress });
    }
  }, [connected, lightningAddress, socket]);
  useEffect(() => { localStorage.setItem('ttt_tilt', tiltEnabled ? '1' : '0'); }, [tiltEnabled]);
  useEffect(() => { 
    localStorage.setItem('ttt_theme', theme);
    // Apply theme to body element
    document.body.className = theme !== 'simple' ? `theme-${theme}` : 'theme-simple';
  }, [theme]);

  // Game join handler
  const handleJoinGame = () => {
    console.log('handleJoinGame called');
    console.log('Socket:', socket, 'Connected:', connected);
    console.log('Lightning Address:', lightningAddress);
    console.log('Accepted Terms:', acceptedTerms);
    console.log('Bet Amount:', betAmount);
    
    if (!socket || !connected) {
      setMessage('Not connected to server');
      console.log('Not connected to server');
      return;
    }
    
    if (!lightningAddress) {
      setMessage('Please enter your Lightning address');
      console.log('Lightning address missing');
      return;
    }

    if (!acceptedTerms) {
      setMessage('Please accept the terms and conditions');
      console.log('Terms not accepted');
      return;
    }

    // Emit join game event
    console.log('Emitting joinGame event');
    socket.emit('joinGame', {
      lightningAddress,
      betAmount: parseInt(betAmount, 10)
    });

    setMessage('Joining game...');
    setAddressLocked(true);
  };

  // Auto-fetch Lightning address from Speed Wallet URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    
    // Speed Wallet passes p_add (Lightning address) or acct_id
    const pAdd = urlParams.get('p_add') || hashParams.get('p_add');
    const acctId = urlParams.get('acct_id') || hashParams.get('acct_id');
    const authToken = urlParams.get('auth_token') || hashParams.get('auth_token');
    
    // If Lightning address is provided directly, use it
    if (pAdd && !lightningAddress) {
      setLightningAddress(pAdd);
      setAddressLocked(true);
      console.log('Auto-filled Lightning address from URL:', pAdd);
    }
    
    // If acct_id or auth_token provided, fetch Lightning address from backend
    if ((acctId || authToken) && !lightningAddress && socket && connected) {
      if (acctId) {
        setAcctId(acctId);
      }
      if (authToken) {
        socket.emit('set_auth_token', { authToken });
      }
    }
  }, [lightningAddress, socket, connected]);

  // Game timer for turn countdown
  useEffect(() => {
    if (!turnDeadline) {
      setTimeLeft(null);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.max(0, Math.ceil((Number(turnDeadline) - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 100);
    return () => clearInterval(interval);
  }, [turnDeadline]);

  // Sound effects
  const sfxPlay = (type) => {
    if (!sfxEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'click') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      } else if (type === 'lose') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      }
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + (type === 'click' ? 0.1 : 0.4));
    } catch (err) {
      console.warn('Audio failed:', err);
    }
  };

  // Haptic feedback
  const triggerHaptic = (pattern) => {
    if (!hapticsEnabled || !navigator.vibrate) return;
    try {
      navigator.vibrate(pattern);
    } catch (err) {
      console.warn('Vibrate failed:', err);
    }
  };

  // Confetti animation
  const launchConfetti = () => {
    if (!confettiRef.current) return;
    const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6'];
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.animationDelay = Math.random() * 3 + 's';
      confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
      confettiRef.current.appendChild(confetti);
      setTimeout(() => confetti.remove(), 5000);
    }
  };

  // Handle cell click in game
  const onCellClick = (index) => {
    if (!socket || !connected) {
      setMessage('Not connected to server');
      return;
    }
    
    if (gameState !== 'playing') {
      setMessage('Game not active');
      return;
    }
    
    if (turn !== socketId) {
      setMessage('Not your turn');
      return;
    }
    
    if (board[index] !== null) {
      setMessage('Cell already taken');
      return;
    }

    if (moveLocked) {
      return;
    }
    
    // Play sound and haptics
    sfxPlay('click');
    triggerHaptic([10]);
    
    // Send move to server
    setMoveLocked(true);
    socket.emit('makeMove', { gameId, position: index });
  };

  // Handle game resignation
  const doResign = () => {
    if (!socket || !connected) {
      setMessage('Not connected to server');
      return;
    }
    
    if (gameState !== 'playing') {
      setMessage('No active game to resign from');
      return;
    }
    
    if (confirm('Are you sure you want to resign? You will lose the game.')) {
      socket.emit('resign', { gameId });
      setMessage('You resigned from the game');
    }
  };

  // Share game result
  const shareResult = () => {
    if (!gameId) return;
    
    const resultText = message.includes('You win') ? 'won' : message.includes('draw') ? 'drew' : 'lost';
    const shareText = `I just ${resultText} a Lightning Network Tic-Tac-Toe game! ⚡️🎮`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Lightning Tic-Tac-Toe Result',
        text: shareText,
        url: window.location.href
      }).catch(err => console.log('Share failed:', err));
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(shareText + ' ' + window.location.href)
        .then(() => setMessage('Result copied to clipboard!'))
        .catch(() => setMessage('Share failed'));
    }
  };

  // Handle board pointer movement for 3D tilt effect
  const handleBoardPointer = (e) => {
    if (!tiltEnabled || !boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / (rect.width / 2);
    const deltaY = (e.clientY - centerY) / (rect.height / 2);
    
    const rotateX = deltaY * 10; // Max 10 degrees
    const rotateY = deltaX * 10;
    
    boardRef.current.style.transform = `perspective(1000px) rotateX(${-rotateX}deg) rotateY(${rotateY}deg)`;
  };

  // Reset board tilt
  const resetBoardTilt = () => {
    if (!boardRef.current) return;
    boardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
  };

  // Copy payment invoice to clipboard
  const copyPayment = () => {
    if (!paymentInfo?.lightningInvoice) {
      alert('No invoice available to copy');
      return;
    }
    
    try {
      navigator.clipboard.writeText(paymentInfo.lightningInvoice).then(() => {
        alert('Invoice copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy invoice:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = paymentInfo.lightningInvoice;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Invoice copied to clipboard!');
      });
    } catch (err) {
      console.error('Copy failed:', err);
      alert('Failed to copy invoice. Please copy manually.');
    }
  };

  // Reset to menu and clean up game state
  const resetToMenu = () => {
    setCurrentScreen('menu');
    setActiveTab('Menu');
    setGameState('menu');
    setPaymentInfo(null);
    setIsWaitingForPayment(false);
    setMoveLocked(false);
    setBoard(Array(9).fill(null));
    setSymbol(null);
    setOpponent(null);
    setTurn(null);
    setWinningLine(null);
    setTurnDeadline(null);
    setTimeLeft(null);
    setMessage('');
    setQrCode('');
    setLnurl('');
    
    // Clear any intervals
    if (waitingIntervalRef.current) {
      clearInterval(waitingIntervalRef.current);
      waitingIntervalRef.current = null;
    }
    if (matchIntervalRef.current) {
      clearInterval(matchIntervalRef.current);
      matchIntervalRef.current = null;
    }
    
    setWaitingInfo(null);
    setWaitingSecondsLeft(null);
    setMatchInfo(null);
    setMatchSecondsLeft(null);
  };

  return (
    <div className={`app ${theme}`} ref={boardRef}>
      {(currentScreen === 'menu' || currentScreen === 'history') && (
        <div className="header">
          <div className="tabs">
            {['Menu', 'History'].map(tab => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab);
                  if (tab === 'History') {
                    setCurrentScreen('history');
                  } else {
                    setCurrentScreen('menu');
                  }
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Menu' && currentScreen === 'menu' && (
        <div className="panel">
          <div className="main-header">
            <h1>Tic‑Tac‑Toe</h1>
            <p className="subtitle">Lightning ⚡ Multiplayer</p>
          </div>
          
          {/* Player Stats Summary */}
          {lightningAddress && (
            <div className="player-summary">
              <div className="stat-card">
                <span className="stat-value">{playerSats?.toLocaleString() || 0}</span>
                <span className="stat-label">Sats</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.wins}</span>
                <span className="stat-label">Wins</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.winrate}%</span>
                <span className="stat-label">Win Rate</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{stats.streak}</span>
                <span className="stat-label">Streak</span>
              </div>
            </div>
          )}

          {/* Main Action */}
          <div className="main-action">
            <button
              className="neo-btn cta-main primary hero-btn"
              onClick={() => {
                console.log('Main menu Start Game clicked - currentScreen:', currentScreen);
                console.log('Setting currentScreen to start');
                setCurrentScreen('start');
                console.log('currentScreen should now be start');
              }}
              disabled={gameState==='playing'}
              aria-label={`Start Game — Win ${payoutAmount} SATS`}
              style={{
                position: 'relative',
                zIndex: 9999,
                pointerEvents: 'auto',
                cursor: 'pointer'
              }}
            >
              ⚡ Start Game
              <small>Win {payoutAmount} SATS</small>
            </button>
          </div>

          {/* Quick Features */}
          <div className="quick-features">
            <button 
              className="feature-quick"
              onClick={() => setShowAchievements(true)}
              title="Achievements"
            >
              🏆
              {newAchievement && <span className="notification-dot"></span>}
            </button>
            <button 
              className="feature-quick"
              onClick={() => setShowLeaderboards(true)}
              title="Leaderboards"
            >
              📊
            </button>
            <button 
              className="feature-quick"
              onClick={() => setShowMysteryBoxes(true)}
              title="Mystery Boxes"
            >
              🎁
              {newMysteryBox && <span className="notification-dot"></span>}
            </button>
            <button 
              className="feature-quick"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              ⚙️
            </button>
          </div>

          {/* Secondary Actions */}
          <div className="secondary-actions">
            <button
              className="link-btn"
              onClick={() => setShowHowToModal(true)}
            >How to Play</button>
            <button
              className="link-btn"
              onClick={() => setShowSupportModal(true)}
            >Support</button>
          </div>

          <PracticeBoard />
        </div>
      )}

      {currentScreen === 'start' && (
        <StartScreen
          lightningAddress={lightningAddress}
          setLightningAddress={setLightningAddress}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          acceptedTerms={acceptedTerms}
          setAcceptedTerms={setAcceptedTerms}
          onStart={handleJoinGame}
          connected={connected}
          onOpenTerms={() => setShowTerms(true)}
          onOpenPrivacy={() => setShowPrivacy(true)}
          addressLocked={addressLocked}
          noticeMessage={message}
          onBack={() => setCurrentScreen('menu')}
        />
      )}

      {currentScreen === 'payment' && (
        <PaymentScreen
          paymentInfo={paymentInfo}
          message={message}
          onCopyPayment={copyPayment}
          onCancel={resetToMenu}
          qrCode={qrCode}
        />
      )}

      {currentScreen === 'waiting' && (
        <WaitingScreen
          waitingInfo={waitingInfo}
          waitingSecondsLeft={waitingSecondsLeft}
          matchInfo={matchInfo}
          matchSecondsLeft={matchSecondsLeft}
        />
      )}

      {currentScreen === 'game' && (
        <GameScreen
          board={board}
          symbol={symbol}
          turn={turn}
          socketId={socketId}
          lastMove={lastMove}
          winningLine={winningLine}
          message={message}
          gameState={gameState}
          onCellClick={onCellClick}
          onResign={doResign}
          onReturnToMenu={resetToMenu}
          onShareResult={shareResult}
          moveLocked={moveLocked}
          tiltEnabled={tiltEnabled}
          boardRef={boardRef}
          onBoardPointerMove={handleBoardPointer}
          onBoardPointerLeave={resetBoardTilt}
          timeLeft={timeLeft}
          turnDuration={turnDuration}
          turnProgress={turnProgress}
        />
      )}


      {currentScreen === 'history' && (
        <div className="panel neo-panel glass full-screen-panel">
          <div className="screen-header">
            <button 
              className="back-btn neo-btn"
              onClick={() => {
                setCurrentScreen('menu');
                setActiveTab('Menu');
              }}
            >
              ← Back to Menu
            </button>
            <h2>Game History</h2>
          </div>
          
          <div className="stats-chips" aria-label="Your stats">
            <span className="chip">Wins: {stats.wins}</span>
            <span className="chip">Losses: {stats.losses}</span>
            <span className="chip">Win rate: {stats.winrate}%</span>
            <span className="chip">Streak: {stats.streak}</span>
            <span className="chip">Net: {stats.net} SATS</span>
          </div>
          
          <div className="history-content">
            <h3>Recent Games</h3>
            {history.length === 0 ? (
              <div className="empty-state">
                <p>No games yet.</p>
                <p>Start playing to build your game history!</p>
              </div>
            ) : (
              <ul className="history">
                {history.map(h => (
                  <li key={h.id} className={`history-item outcome-${h.outcome}`}>
                    <div className="game-info">
                      <span className="game-date">{new Date(h.ts).toLocaleString()}</span>
                      <span className="game-outcome">{h.outcome.toUpperCase()}</span>
                    </div>
                    <div className="game-details">
                      <span className="game-bet">Bet: {h.bet} SATS</span>
                      <span className={`game-amount ${h.amount >= 0 ? 'positive' : 'negative'}`}>
                        {h.amount >= 0 ? '+' : ''}{h.amount} SATS
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <div ref={confettiRef} className="confetti-layer" />

      {/* Achievement Notification */}
      {newAchievement && (
        <div className="achievement-notification">
          <div className="achievement-content">
            <span className="achievement-icon">🏆</span>
            <div className="achievement-text">
              <h4>Achievement Unlocked!</h4>
              <p>{newAchievement.achievement.name}</p>
              <span className="reward">+{newAchievement.reward} sats</span>
            </div>
          </div>
        </div>
      )}

      {/* Mystery Box Notification */}
      {newMysteryBox && (
        <div className="mysterybox-notification">
          <div className="mysterybox-content">
            <span className="mysterybox-icon">🎁</span>
            <div className="mysterybox-text">
              <h4>Mystery Box Earned!</h4>
              <p>{newMysteryBox.boxType} Box</p>
              <span className="reason">{newMysteryBox.reason}</span>
            </div>
          </div>
        </div>
      )}

      {/* Streak Bonus Notification */}
      {streakBonus > 0 && (
        <div className="streak-notification">
          <div className="streak-content">
            <span className="streak-icon">🔥</span>
            <div className="streak-text">
              <h4>Streak Bonus!</h4>
              <p>+{streakBonus} sats bonus</p>
            </div>
          </div>
        </div>
      )}

      {/* Feature Modals */}
      {showAchievements && (
        <AchievementSystem 
          lightningAddress={lightningAddress}
          isOpen={showAchievements}
          onClose={() => setShowAchievements(false)}
          socket={socket}
        />
      )}
      
      {showMysteryBoxes && (
        <MysteryBoxes 
          lightningAddress={lightningAddress}
          isOpen={showMysteryBoxes}
          onClose={() => setShowMysteryBoxes(false)}
          socket={socket}
        />
      )}
      
      {showLeaderboards && (
        <LeaderboardSystem 
          lightningAddress={lightningAddress}
          isOpen={showLeaderboards}
          onClose={() => setShowLeaderboards(false)}
        />
      )}

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Settings</h3>
            <div className="section">
              <label><input type="checkbox" checked={sfxEnabled} onChange={(e)=>setSfxEnabled(e.target.checked)} /> Sound effects</label>
              <label><input type="checkbox" checked={hapticsEnabled} onChange={(e)=>setHapticsEnabled(e.target.checked)} /> Haptics (vibration)</label>
              <label><input type="checkbox" checked={tiltEnabled} onChange={(e)=>setTiltEnabled(e.target.checked)} /> 3D board tilt</label>
            </div>
            <div className="section">
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {[['simple', 'Green'], ['blue', 'Monochrome'], ['pink', 'Red']].map(([key, label]) => (
                  <button key={key} className={`neo-btn ${theme===key?'primary':''}`} onClick={()=>setTheme(key)} style={{textTransform: 'capitalize'}}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="neo-btn" onClick={() => setShowSettings(false)}>Close</button>
            </div>
          </div>
        </div>
      )}


      {showHowToModal && (
        <div className="modal-backdrop" onClick={() => setShowHowToModal(false)}>
          <div className="modal how-to-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎯 How to Play: Your Guide to Bitcoin-Powered Tic-Tac-Toe Mastery</h3>
              <p className="subtitle">Because apparently, regular tic-tac-toe wasn't stressful enough without money involved 💸</p>
            </div>
            
            <div className="how-to-content">
              <div className="game-overview">
                <div className="overview-text">
                  <h4>🧠 The Genius Concept</h4>
                  <p>It's tic-tac-toe, but with Lightning Network payments. Yes, we took a game that 5-year-olds master and added cryptocurrency. Revolutionary? Probably not. Fun? Absolutely! 🚀</p>
                  
                  <div className="feature-highlights">
                    <span className="highlight">⚡ Lightning Fast Payments</span>
                    <span className="highlight">🎮 Real-Time Multiplayer</span>
                    <span className="highlight">🏆 Achievement System</span>
                    <span className="highlight">🎁 Mystery Boxes</span>
                    <span className="highlight">📊 Leaderboards</span>
                  </div>
                </div>
                
                <div className="game-preview">
                  <div className="preview-board">
                    <div className="preview-cell">X</div>
                    <div className="preview-cell">O</div>
                    <div className="preview-cell">X</div>
                    <div className="preview-cell">O</div>
                    <div className="preview-cell win">X</div>
                    <div className="preview-cell">O</div>
                    <div className="preview-cell">X</div>
                    <div className="preview-cell"></div>
                    <div className="preview-cell"></div>
                  </div>
                  <p className="preview-caption">↑ Actual game footage (results may vary based on skill level)</p>
                </div>
              </div>

              <div className="rules-section">
                <h4>📜 The Sacred Rules (Please Don't Break Them)</h4>
                
                <div className="rule-card">
                  <div className="rule-number">1️⃣</div>
                  <div className="rule-content">
                    <h5>Getting Started (The Easy Part)</h5>
                    <ul>
                      <li>Enter your Lightning address (e.g., yourname@speed.app) - Yes, that @ symbol is important</li>
                      <li>Choose your bet amount (Start small, your ego will thank you later)</li>
                      <li>Accept terms (The legal stuff nobody reads but everyone agrees to)</li>
                      <li>Click "⚡ Start Game" like you mean it</li>
                    </ul>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-number">2️⃣</div>
                  <div className="rule-content">
                    <h5>Payment Time (Where Your Money Goes Bye-Bye)</h5>
                    <ul>
                      <li>You'll get a Lightning invoice - pay it or forever hold your peace</li>
                      <li>Scan the QR code with your Lightning wallet (or copy-paste like a caveman)</li>
                      <li>Payment confirmed? Great! Payment failed? Try again (and check your wallet balance) 💸</li>
                    </ul>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-number">3️⃣</div>
                  <div className="rule-content">
                    <h5>Matchmaking (Finding Your Opponent)</h5>
                    <ul>
                      <li>We'll search for a human opponent for 13-25 seconds</li>
                      <li>Opponent found = 5-second countdown = Game time! 🎮</li>
                    </ul>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-number">4️⃣</div>
                  <div className="rule-content">
                    <h5>Gameplay (The Moment of Truth)</h5>
                    <ul>
                      <li><strong>Objective:</strong> Get 3 in a row (horizontal, vertical, or diagonal) - kindergarten rules apply</li>
                      <li><strong>First Move:</strong> 8 seconds to think (use them wisely)</li>
                      <li><strong>Subsequent Moves:</strong> 5 seconds each (no pressure, just your money on the line)</li>
                      <li><strong>Draw Handling:</strong> If game draws, opponent gets first turn in next game (5 seconds only)</li>
                      <li><strong>Timeout:</strong> Take too long = you forfeit your turn (tough love)</li>
                      <li><strong>Winning:</strong> Three in a row = victory dance time 🕺💃</li>
                      <li><strong>Draw:</strong> Nobody wins = game continues with opponent going first</li>
                    </ul>
                  </div>
                </div>

                <div className="rule-card">
                  <div className="rule-number">5️⃣</div>
                  <div className="rule-content">
                    <h5>Victory & Rewards (The Good Stuff)</h5>
                    <ul>
                      <li><strong>Win:</strong> Instant payout to your Lightning address (cha-ching! 💰)</li>
                      <li><strong>Lose:</strong> Character building experience (priceless, but you still lost money)</li>
                      <li><strong>Achievements:</strong> Unlock badges for various accomplishments</li>
                      <li><strong>Mystery Boxes:</strong> Earn them through gameplay (it's like gambling within gambling)</li>
                      <li><strong>Streaks:</strong> Win multiple games in a row for bonus rewards</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="features-section">
                <h4>🎮 Extra Features (Because Why Not?)</h4>
                
                <div className="feature-grid">
                  <div className="feature-item">
                    <span className="feature-icon">🏆</span>
                    <div>
                      <strong>Achievements</strong>
                      <p>Collect badges like "First Win", "Comeback King", and "Lightning Fast" (some easier than others)</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <span className="feature-icon">🎁</span>
                    <div>
                      <strong>Mystery Boxes</strong>
                      <p>Earn boxes through gameplay. Open them for surprise sat rewards (surprises not guaranteed to be pleasant)</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <span className="feature-icon">📊</span>
                    <div>
                      <strong>Leaderboards</strong>
                      <p>See how you rank against other players (prepare your ego accordingly)</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <span className="feature-icon">📈</span>
                    <div>
                      <strong>Game History</strong>
                      <p>Track your wins, losses, and net earnings (or losses - no judgment here)</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <span className="feature-icon">🔥</span>
                    <div>
                      <strong>Streak Bonuses</strong>
                      <p>Win consecutively for extra sats (because winning once just isn't enough)</p>
                    </div>
                  </div>
                  
                  <div className="feature-item">
                    <span className="feature-icon">⚙️</span>
                    <div>
                      <strong>Settings</strong>
                      <p>Customize sounds, haptics, and themes (make your losses look prettier)</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="tips-section">
                <h4>💡 Pro Tips (From the Slightly Less Amateur Players)</h4>
                <div className="tips-grid">
                  <div className="tip">
                    <strong>🎯 Corner Strategy:</strong> Start with corners, they're involved in more winning combinations
                  </div>
                  <div className="tip">
                    <strong>🛡️ Defense First:</strong> Always block your opponent's potential winning move
                  </div>
                  <div className="tip">
                    <strong>⏰ Time Management:</strong> Don't overthink it - it's still just tic-tac-toe
                  </div>
                  <div className="tip">
                    <strong>💰 Bankroll:</strong> Don't bet your life savings (this should go without saying, but here we are)
                  </div>
                  <div className="tip">
                    <strong>🎯 Stay Focused:</strong> Keep your strategy simple and stay alert to your opponent's moves
                  </div>
                  <div className="tip">
                    <strong>🔄 Streaks:</strong> Momentum is real - ride those winning streaks (while they last)
                  </div>
                </div>
              </div>

              <div className="disclaimer-section">
                <h4>⚠️ The Fine Print (Read This or Regret It Later)</h4>
                <div className="disclaimer-content">
                  <p><strong>Gambling Responsibly:</strong> Only wager what you can afford to lose. This is entertainment, not a retirement plan.</p>
                  <p><strong>Technical Issues:</strong> Network problems happen. We're not liable for your WiFi deciding to take a coffee break.</p>
                  <p><strong>Fair Play:</strong> All matches are against real players in fair, competitive gameplay.</p>
                  <p><strong>Fairness:</strong> Games use standard tic-tac-toe logic. No rigging, no shenanigans, just good old-fashioned skill (or lack thereof).</p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <div className="footer-message">
                <p>🎭 <em>Remember: This is a game of skill wrapped in childhood nostalgia, powered by internet money. What could go wrong?</em></p>
              </div>
              <button className="neo-btn primary" onClick={() => setShowHowToModal(false)}>
                Got It! Let's Play 🚀
              </button>
            </div>
          </div>
        </div>
      )}

      {showSupportModal && (
        <div className="modal-backdrop" onClick={() => setShowSupportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Contact Support</h3>
            <div className="section">
              <p>Chat with us on Telegram:</p>
              <p><a className="neo-btn outline" href="https://t.me/ThunderSlate" target="_blank" rel="noreferrer">Open Telegram @ThunderSlate</a></p>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end' }}>
              <button className="neo-btn" onClick={() => setShowSupportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTerms && (
        <div className="modal-backdrop" onClick={() => setShowTerms(false)}>
          <div className="modal terms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="terms-header">
              <h3>Terms & Conditions</h3>
              <p className="terms-subtitle">Lightning Network Tic-Tac-Toe Game Service</p>
              <p className="last-updated">Last Updated: {new Date().toLocaleDateString()}</p>
            </div>
            
            <div className="terms-content scrollable">
              <div className="terms-section">
                <h4>1. ACCEPTANCE OF TERMS</h4>
                <p>By accessing, using, or playing this Lightning Network Tic-Tac-Toe game ("Service"), you ("User", "Player", "You") agree to be bound by these Terms & Conditions ("Terms"). If you do not agree to all terms, do not use this Service.</p>
                <p><strong>IMPORTANT:</strong> This Service involves real money wagering using Bitcoin Lightning Network. Only use this Service if you understand the risks and can afford to lose your wagers.</p>
              </div>

              <div className="terms-section">
                <h4>2. ELIGIBILITY AND LEGAL REQUIREMENTS</h4>
                <ul>
                  <li><strong>Age Requirement:</strong> You must be at least 18 years old or the legal gambling age in your jurisdiction, whichever is higher.</li>
                  <li><strong>Jurisdiction Compliance:</strong> You are responsible for ensuring online gambling/gaming is legal in your location. We do not provide legal advice.</li>
                  <li><strong>Prohibited Jurisdictions:</strong> This Service is not available to residents of countries where Bitcoin or online gambling is prohibited.</li>
                  <li><strong>Identity Verification:</strong> We reserve the right to request identity verification at any time. Failure to provide requested information may result in account suspension and forfeiture of funds.</li>
                  <li><strong>One Account Policy:</strong> One account per person. Multiple accounts will result in permanent ban and fund forfeiture.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>3. GAME RULES AND MECHANICS</h4>
                <ul>
                  <li><strong>Game Type:</strong> Standard 3x3 Tic-Tac-Toe with monetary wagers using Bitcoin Lightning Network.</li>
                  <li><strong>Turn Timers:</strong> First move: 8 seconds maximum. Subsequent moves: 5 seconds maximum. Exceeding time limits forfeits your turn.</li>
                  <li><strong>Winning Conditions:</strong> First player to achieve three marks in a row (horizontal, vertical, or diagonal) wins.</li>
                  <li><strong>Draw Games:</strong> If the board is full without a winner, the game is a draw and wagers are returned (minus any network fees). After a draw, opponent gets first turn in next game.</li>
                  <li><strong>Draw Turn Priority:</strong> After any draw game, the opponent gets the first turn with 5 seconds (not 8 seconds).</li>
                  <li><strong>Game Integrity:</strong> All moves are recorded with timestamps. Games cannot be reversed once completed.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>4. PAYMENT TERMS AND WAGERS</h4>
                <ul>
                  <li><strong>Currency:</strong> All wagers and payouts are in Bitcoin Satoshis (SATS) via Lightning Network.</li>
                  <li><strong>Wallet Requirements:</strong> You must provide a valid Lightning Network address for payouts. Invalid addresses may result in permanent fund loss.</li>
                  <li><strong>Wager Processing:</strong> Wagers are debited immediately upon joining a game. No refunds for completed games.</li>
                  <li><strong>Payout Processing:</strong> Winnings are automatically sent to your provided Lightning address within 60 seconds of game completion.</li>
                  <li><strong>Network Fees:</strong> Lightning Network transaction fees are deducted from payouts. Fees typically range from 0-10 SATS.</li>
                  <li><strong>Minimum/Maximum Wagers:</strong> Wager limits are displayed in-game and may change without notice.</li>
                  <li><strong>Failed Transactions:</strong> We are not liable for failed Lightning transactions due to network issues, invalid addresses, or insufficient channel liquidity.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>5. LIMITATION OF LIABILITY</h4>
                <p><strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong></p>
                <ul>
                  <li><strong>Service "As-Is":</strong> This Service is provided "AS-IS" without warranties of any kind, express or implied.</li>
                  <li><strong>Technical Issues:</strong> We are not liable for losses due to internet outages, server downtime, wallet malfunctions, Lightning Network failures, or any technical problems.</li>
                  <li><strong>Maximum Liability:</strong> Our total liability to you cannot exceed the amount of your wagers in the past 30 days.</li>
                  <li><strong>Consequential Damages:</strong> We are not liable for indirect, incidental, special, or consequential damages.</li>
                  <li><strong>Force Majeure:</strong> We are not liable for delays or failures due to circumstances beyond our reasonable control.</li>
                  <li><strong>Third-Party Services:</strong> We are not responsible for failures of third-party services including Lightning Network, wallet providers, or payment processors.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>6. PROHIBITED CONDUCT</h4>
                <p>The following activities are strictly prohibited and may result in immediate account termination and fund forfeiture:</p>
                <ul>
                  <li><strong>Cheating:</strong> Using bots, scripts, exploits, or any automated tools to gain unfair advantage.</li>
                  <li><strong>Collusion:</strong> Coordinating with other players to manipulate game outcomes.</li>
                  <li><strong>Multiple Accounts:</strong> Creating or using multiple accounts to circumvent limits or policies.</li>
                  <li><strong>Bug Exploitation:</strong> Intentionally exploiting software bugs or vulnerabilities.</li>
                  <li><strong>Harassment:</strong> Abusive, threatening, or inappropriate behavior toward other users.</li>
                  <li><strong>Fraud:</strong> Using stolen funds, fake identities, or engaging in any fraudulent activity.</li>
                  <li><strong>Money Laundering:</strong> Using the Service to disguise the source of illegal funds.</li>
                  <li><strong>Reverse Engineering:</strong> Attempting to decompile, reverse engineer, or extract source code.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>7. ACCOUNT TERMINATION AND ENFORCEMENT</h4>
                <ul>
                  <li><strong>Immediate Termination:</strong> We may terminate your access immediately for violations of these Terms.</li>
                  <li><strong>Fund Forfeiture:</strong> Serious violations may result in permanent forfeiture of deposited and won funds.</li>
                  <li><strong>Investigation Rights:</strong> We may investigate suspicious activity and freeze accounts pending investigation.</li>
                  <li><strong>Law Enforcement:</strong> We cooperate with law enforcement and may report illegal activity.</li>
                  <li><strong>No Refund Policy:</strong> Terminated accounts are not entitled to refunds of wagers or deposits.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>8. PRIVACY AND DATA COLLECTION</h4>
                <ul>
                  <li><strong>Minimal Data:</strong> We collect only data necessary for game operation and fraud prevention.</li>
                  <li><strong>Game Records:</strong> All games, moves, timestamps, and wager amounts are permanently recorded.</li>
                  <li><strong>Payment Data:</strong> Lightning addresses and transaction IDs are stored for payout processing and dispute resolution.</li>
                  <li><strong>No Personal Information:</strong> We do not require or store personal identification information unless legally required.</li>
                  <li><strong>Data Retention:</strong> Game and payment data may be retained indefinitely for legal and operational purposes.</li>
                  <li><strong>Third-Party Sharing:</strong> Data may be shared with law enforcement, regulators, or service providers as required.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>9. SERVICE AVAILABILITY</h4>
                <ul>
                  <li><strong>No Guaranteed Uptime:</strong> We do not guarantee continuous service availability.</li>
                  <li><strong>Maintenance:</strong> Scheduled maintenance may temporarily interrupt service.</li>
                  <li><strong>Emergency Shutdowns:</strong> We may suspend service immediately for security or legal reasons.</li>
                  <li><strong>Permanent Closure:</strong> We reserve the right to permanently close the Service with 30 days notice.</li>
                  <li><strong>Final Settlement:</strong> Upon permanent closure, all outstanding wagers will be settled and funds returned where possible.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>10. DISPUTE RESOLUTION AND ARBITRATION</h4>
                <ul>
                  <li><strong>Arbitration Agreement:</strong> All disputes must be resolved through binding arbitration, not court proceedings.</li>
                  <li><strong>Individual Claims Only:</strong> No class action lawsuits are permitted under these Terms.</li>
                  <li><strong>Governing Law:</strong> These Terms are governed by the laws of [YOUR JURISDICTION] without regard to conflict of law principles.</li>
                  <li><strong>Dispute Process:</strong> Contact support first for dispute resolution. Unresolved disputes proceed to arbitration.</li>
                  <li><strong>Limitation Period:</strong> All claims must be brought within 1 year of the event giving rise to the claim.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>11. INTELLECTUAL PROPERTY</h4>
                <ul>
                  <li><strong>Our Rights:</strong> All game software, designs, and content are our exclusive property.</li>
                  <li><strong>Limited License:</strong> You receive only a limited, revocable license to use the Service.</li>
                  <li><strong>No Copying:</strong> Reproduction, distribution, or modification of our content is prohibited.</li>
                  <li><strong>Trademark:</strong> All trademarks and logos are our property and may not be used without permission.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>12. AUTOMATED OPPONENTS (BOTS)</h4>
                <p><strong>BOT USAGE:</strong> This service may utilize computer-controlled opponents ("Bots") when insufficient human players are available.</p>
                <ul>
                  <li><strong>Bot Deployment:</strong> Bots may be used at our discretion to maintain game availability and reduce wait times.</li>
                  <li><strong>No Identification Required:</strong> We are not obligated to identify whether your opponent is human or automated.</li>
                  <li><strong>Payout Equality:</strong> Winning against bots pays the same as winning against human opponents.</li>
                  <li><strong>Player Acceptance:</strong> By using this service, you acknowledge and accept that you may play against automated opponents without prior notice or identification.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>13. RESPONSIBLE GAMBLING</h4>
                <ul>
                  <li><strong>Risk Warning:</strong> Gambling involves risk of monetary loss. Never wager more than you can afford to lose.</li>
                  <li><strong>Addiction Resources:</strong> If you have gambling problems, seek help from appropriate organizations.</li>
                  <li><strong>Self-Exclusion:</strong> Contact support to permanently close your account if needed.</li>
                  <li><strong>Cooling-Off Periods:</strong> We may implement cooling-off periods for heavy users.</li>
                  <li><strong>No Credit:</strong> We do not extend credit or loans for gambling purposes.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>14. MODIFICATIONS TO TERMS</h4>
                <ul>
                  <li><strong>Update Rights:</strong> We may modify these Terms at any time without prior notice.</li>
                  <li><strong>Effective Date:</strong> Changes take effect immediately upon posting.</li>
                  <li><strong>Continued Use:</strong> Your continued use constitutes acceptance of modified Terms.</li>
                  <li><strong>Material Changes:</strong> Significant changes may be announced via the Service interface.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>15. SEVERABILITY AND ENTIRE AGREEMENT</h4>
                <ul>
                  <li><strong>Severability:</strong> If any provision is found invalid, the remaining Terms remain in effect.</li>
                  <li><strong>Entire Agreement:</strong> These Terms constitute the complete agreement between you and us.</li>
                  <li><strong>No Waiver:</strong> Failure to enforce any provision does not constitute a waiver of that provision.</li>
                  <li><strong>Survival:</strong> Provisions regarding liability, disputes, and intellectual property survive termination.</li>
                </ul>
              </div>

              <div className="terms-section">
                <h4>16. CONTACT INFORMATION</h4>
                <p>For support, legal notices, or questions about these Terms:</p>
                <ul>
                  <li><strong>Email:</strong> support@[yourgame].com</li>
                  <li><strong>Legal Department:</strong> legal@[yourgame].com</li>
                  <li><strong>Mailing Address:</strong> [Your Business Address]</li>
                  <li><strong>Response Time:</strong> We aim to respond within 48 hours for support requests, 7 days for legal matters.</li>
                </ul>
                <p className="terms-footer">Last Updated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="terms-footer">
              <button className="neo-btn primary" onClick={() => setShowTerms(false)}>
                I Accept These Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacy && (
          <div className="modal-backdrop" onClick={() => setShowPrivacy(false)}>
            <div className="modal privacy-policy" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>🔒 Privacy Policy</h3>
                <button className="modal-close" onClick={() => setShowPrivacy(false)}>×</button>
              </div>
              
              <div className="modal-content">
                <p className="privacy-intro">
                  <strong>Effective Date:</strong> {new Date().toLocaleDateString()}<br/>
                  This Privacy Policy explains how we collect, use, protect, and share your information when you use our Bitcoin-powered Tic-Tac-Toe gaming service ("Service").
                </p>

                <div className="privacy-section">
                  <h4>1. INFORMATION WE COLLECT</h4>
                  
                  <h5>1.1 Automatically Collected Data</h5>
                  <ul>
                    <li><strong>Game Session Data:</strong> Game moves, timestamps, turn durations, game outcomes, wager amounts</li>
                    <li><strong>Technical Data:</strong> IP addresses, browser type, device information, operating system, screen resolution</li>
                    <li><strong>Usage Analytics:</strong> Pages visited, features used, session duration, click patterns, error logs</li>
                    <li><strong>Performance Data:</strong> Loading times, network latency, connection quality, server response times</li>
                    <li><strong>Socket Connection Data:</strong> Connection timestamps, disconnection events, reconnection attempts</li>
                  </ul>

                  <h5>1.2 User-Provided Data</h5>
                  <ul>
                    <li><strong>Lightning Address:</strong> Your Bitcoin Lightning Network address for receiving payouts</li>
                    <li><strong>Payment Information:</strong> Transaction IDs, invoice details, payment confirmation data</li>
                    <li><strong>Game Preferences:</strong> Theme settings, sound preferences, haptic feedback settings, notification preferences</li>
                    <li><strong>Account Settings:</strong> Display preferences, timezone settings, language preferences</li>
                    <li><strong>Communication Data:</strong> Support messages, feedback, bug reports, feature requests</li>
                  </ul>

                  <h5>1.3 Generated Gaming Data</h5>
                  <ul>
                    <li><strong>Achievement Records:</strong> Unlocked achievements, progress tracking, completion timestamps</li>
                    <li><strong>Statistics:</strong> Win/loss ratios, total games played, earning history, streak records</li>
                    <li><strong>Mystery Box Data:</strong> Box opening history, reward distributions, probability calculations</li>
                    <li><strong>Leaderboard Information:</strong> Rankings, scores, competitive performance metrics</li>
                    <li><strong>Behavioral Patterns:</strong> Playing habits, preferred game times, betting patterns, strategy analysis</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>2. HOW WE USE YOUR INFORMATION</h4>
                  
                  <h5>2.1 Core Game Operations</h5>
                  <ul>
                    <li><strong>Game Functionality:</strong> Process moves, determine winners, manage game state, enforce rules</li>
                    <li><strong>Matchmaking:</strong> Pair players with similar skill levels, manage waiting queues, balance game difficulty</li>
                    <li><strong>Payment Processing:</strong> Execute Lightning Network transactions, verify payments, distribute winnings</li>
                    <li><strong>Anti-Fraud Protection:</strong> Detect suspicious activity, prevent cheating, identify bot usage</li>
                    <li><strong>Game Integrity:</strong> Maintain fair play, prevent exploitation, ensure random outcomes</li>
                  </ul>

                  <h5>2.2 User Experience Enhancement</h5>
                  <ul>
                    <li><strong>Personalization:</strong> Customize interface themes, remember preferences, suggest optimal bet amounts</li>
                    <li><strong>Performance Optimization:</strong> Improve loading times, reduce latency, enhance stability</li>
                    <li><strong>Feature Development:</strong> Analyze usage patterns to develop new features and improvements</li>
                    <li><strong>Achievement Systems:</strong> Track progress, unlock rewards, calculate bonuses and streaks</li>
                    <li><strong>Leaderboards:</strong> Rank players, display statistics, create competitive environments</li>
                  </ul>

                  <h5>2.3 Business Operations</h5>
                  <ul>
                    <li><strong>Analytics:</strong> Understand user behavior, measure engagement, identify popular features</li>
                    <li><strong>Technical Support:</strong> Diagnose issues, provide assistance, improve service quality</li>
                    <li><strong>Legal Compliance:</strong> Maintain records for regulatory requirements, respond to legal requests</li>
                    <li><strong>Security Monitoring:</strong> Detect threats, prevent attacks, maintain system integrity</li>
                    <li><strong>Service Improvement:</strong> Identify bugs, optimize performance, enhance user satisfaction</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>3. AUTOMATED OPPONENT (BOT) DATA USAGE</h4>
                  <p><strong>AI and Machine Learning:</strong> We use your gameplay data to improve our automated opponents and game algorithms:</p>
                  <ul>
                    <li><strong>Strategy Analysis:</strong> Your moves and strategies may be analyzed to improve bot behavior and create more challenging opponents</li>
                    <li><strong>Difficulty Adjustment:</strong> Your skill level and performance data helps calibrate bot difficulty for balanced gameplay</li>
                    <li><strong>Pattern Recognition:</strong> Your playing patterns contribute to machine learning models that enhance game AI</li>
                    <li><strong>Behavioral Training:</strong> Your interaction data helps train bots to exhibit more human-like gameplay characteristics</li>
                    <li><strong>No Personal Identification:</strong> Bot training uses anonymized gameplay data without linking to your personal identity</li>
                    <li><strong>Opt-Out Not Available:</strong> Participation in AI improvement through gameplay data is mandatory for service usage</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>4. LIGHTNING NETWORK AND BITCOIN DATA</h4>
                  
                  <h5>4.1 Payment Data Collection</h5>
                  <ul>
                    <li><strong>Lightning Addresses:</strong> Stored securely for payout processing and verification</li>
                    <li><strong>Transaction Records:</strong> Complete history of all payments, winnings, and fees for accounting and legal purposes</li>
                    <li><strong>Invoice Data:</strong> Payment requests, confirmation codes, settlement information</li>
                    <li><strong>Network Fees:</strong> Tracking of Lightning Network fees deducted from payouts</li>
                    <li><strong>Failed Transactions:</strong> Records of failed payments for troubleshooting and resolution</li>
                  </ul>

                  <h5>4.2 Financial Data Protection</h5>
                  <ul>
                    <li><strong>Encryption:</strong> All payment data encrypted using AES-256 encryption standards</li>
                    <li><strong>Limited Access:</strong> Payment data accessible only to authorized personnel for processing</li>
                    <li><strong>Audit Trails:</strong> Complete logs of all access to financial data for security monitoring</li>
                    <li><strong>Compliance:</strong> Financial data handling complies with applicable cryptocurrency regulations</li>
                    <li><strong>Retention:</strong> Financial records retained for minimum 7 years for legal and tax purposes</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>5. DATA SHARING AND THIRD PARTIES</h4>
                  
                  <h5>5.1 Service Providers</h5>
                  <ul>
                    <li><strong>Lightning Network Nodes:</strong> Payment routing requires sharing transaction data with network participants</li>
                    <li><strong>Hosting Services:</strong> Server providers may have access to encrypted data for infrastructure maintenance</li>
                    <li><strong>Analytics Platforms:</strong> Anonymized usage data shared with analytics services for insights</li>
                    <li><strong>Security Services:</strong> Fraud detection and security monitoring services receive relevant threat data</li>
                    <li><strong>Support Tools:</strong> Customer service platforms access support communications and relevant account data</li>
                  </ul>

                  <h5>5.2 Legal and Regulatory Sharing</h5>
                  <ul>
                    <li><strong>Law Enforcement:</strong> Data shared when legally required by valid court orders or subpoenas</li>
                    <li><strong>Regulatory Compliance:</strong> Financial data provided to regulators as required by applicable laws</li>
                    <li><strong>Tax Authorities:</strong> Transaction records shared with tax authorities when legally mandated</li>
                    <li><strong>Legal Proceedings:</strong> Data disclosed as necessary for legal defense or compliance with litigation</li>
                    <li><strong>Safety Investigations:</strong> Information shared to investigate potential fraud, money laundering, or other crimes</li>
                  </ul>

                  <h5>5.3 Business Transfers</h5>
                  <ul>
                    <li><strong>Mergers and Acquisitions:</strong> Data may be transferred as part of business sale or merger</li>
                    <li><strong>Asset Sales:</strong> Customer data included in sale of business assets</li>
                    <li><strong>Bankruptcy:</strong> Data may be transferred to creditors or purchasers in bankruptcy proceedings</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>6. DATA SECURITY AND PROTECTION</h4>
                  
                  <h5>6.1 Technical Safeguards</h5>
                  <ul>
                    <li><strong>Encryption:</strong> All data encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
                    <li><strong>Access Controls:</strong> Multi-factor authentication and role-based access controls for all systems</li>
                    <li><strong>Network Security:</strong> Firewalls, intrusion detection systems, and DDoS protection</li>
                    <li><strong>Data Backups:</strong> Regular encrypted backups stored in geographically distributed locations</li>
                    <li><strong>Vulnerability Management:</strong> Regular security audits, penetration testing, and patch management</li>
                  </ul>

                  <h5>6.2 Operational Security</h5>
                  <ul>
                    <li><strong>Employee Training:</strong> Regular security awareness training for all personnel</li>
                    <li><strong>Background Checks:</strong> Security screening for employees with data access</li>
                    <li><strong>Incident Response:</strong> Comprehensive breach response procedures and notification protocols</li>
                    <li><strong>Monitoring:</strong> 24/7 security monitoring and automated threat detection</li>
                    <li><strong>Data Minimization:</strong> Collection and retention limited to necessary data only</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>7. DATA RETENTION AND DELETION</h4>
                  
                  <h5>7.1 Retention Periods</h5>
                  <ul>
                    <li><strong>Game Data:</strong> Game history, moves, and outcomes retained indefinitely for service integrity</li>
                    <li><strong>Financial Records:</strong> Payment and transaction data retained for minimum 7 years</li>
                    <li><strong>Account Data:</strong> User preferences and settings retained while account is active</li>
                    <li><strong>Technical Logs:</strong> Server logs and analytics data retained for 2 years maximum</li>
                    <li><strong>Support Communications:</strong> Customer service records retained for 3 years</li>
                  </ul>

                  <h5>7.2 Data Deletion</h5>
                  <ul>
                    <li><strong>Account Closure:</strong> Personal preferences deleted within 30 days of account closure</li>
                    <li><strong>Legal Requirements:</strong> Some data must be retained longer for legal compliance</li>
                    <li><strong>Anonymization:</strong> Personal identifiers removed while preserving anonymous gameplay statistics</li>
                    <li><strong>Automatic Deletion:</strong> Temporary data (sessions, cache) automatically deleted after expiration</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>8. YOUR PRIVACY RIGHTS</h4>
                  
                  <h5>8.1 Access and Control</h5>
                  <ul>
                    <li><strong>Data Access:</strong> Request copies of your personal data we have collected</li>
                    <li><strong>Data Correction:</strong> Request correction of inaccurate or incomplete personal data</li>
                    <li><strong>Data Portability:</strong> Receive your data in a structured, machine-readable format</li>
                    <li><strong>Account Deletion:</strong> Request deletion of your account and associated personal data</li>
                    <li><strong>Communication Preferences:</strong> Opt out of marketing communications (where applicable)</li>
                  </ul>

                  <h5>8.2 Limitations on Rights</h5>
                  <ul>
                    <li><strong>Legal Requirements:</strong> Some data must be retained for legal compliance</li>
                    <li><strong>Service Integrity:</strong> Game history data may be retained to prevent fraud</li>
                    <li><strong>Financial Records:</strong> Payment data retained for accounting and tax purposes</li>
                    <li><strong>Security Purposes:</strong> Some data retained to protect against fraud and abuse</li>
                  </ul>

                  <h5>8.3 Regional Rights</h5>
                  <ul>
                    <li><strong>GDPR (EU):</strong> Enhanced rights including data protection officer contact</li>
                    <li><strong>CCPA (California):</strong> Right to know, delete, and opt-out of sale</li>
                    <li><strong>Other Jurisdictions:</strong> Rights as provided by local privacy laws</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>9. INTERNATIONAL DATA TRANSFERS</h4>
                  <ul>
                    <li><strong>Global Service:</strong> Your data may be processed in countries other than your residence</li>
                    <li><strong>Adequate Protection:</strong> All transfers comply with applicable data protection laws</li>
                    <li><strong>Safeguards:</strong> Standard contractual clauses and adequacy decisions where required</li>
                    <li><strong>Lightning Network:</strong> Bitcoin transactions inherently involve international data transfer</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>10. COOKIES AND TRACKING</h4>
                  
                  <h5>10.1 Local Storage</h5>
                  <ul>
                    <li><strong>Game Preferences:</strong> Theme, sound, and display settings stored locally</li>
                    <li><strong>Performance Data:</strong> Local caching to improve loading times</li>
                    <li><strong>Session Data:</strong> Temporary game state and connection information</li>
                  </ul>

                  <h5>10.2 Analytics Tracking</h5>
                  <ul>
                    <li><strong>Usage Analytics:</strong> Anonymous usage statistics for service improvement</li>
                    <li><strong>Performance Monitoring:</strong> Error tracking and performance metrics</li>
                    <li><strong>No Advertising:</strong> We do not use tracking for advertising purposes</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>11. CHILDREN'S PRIVACY</h4>
                  <ul>
                    <li><strong>Age Restriction:</strong> Service not intended for users under 18 years of age</li>
                    <li><strong>No Knowing Collection:</strong> We do not knowingly collect data from minors</li>
                    <li><strong>Parental Rights:</strong> Parents may request deletion of child's data if discovered</li>
                    <li><strong>Verification:</strong> We may require age verification for compliance</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>12. CHANGES TO THIS PRIVACY POLICY</h4>
                  <ul>
                    <li><strong>Update Notification:</strong> Users notified of material changes via email or in-app notification</li>
                    <li><strong>Effective Date:</strong> Changes become effective 30 days after notification</li>
                    <li><strong>Continued Use:</strong> Continued service use constitutes acceptance of updated policy</li>
                    <li><strong>Version History:</strong> Previous versions available upon request</li>
                  </ul>
                </div>

                <div className="privacy-section">
                  <h4>13. CONTACT INFORMATION</h4>
                  <p>For privacy-related questions, requests, or concerns:</p>
                  <ul>
                    <li><strong>Privacy Officer:</strong> privacy@[yourgame].com</li>
                    <li><strong>Data Protection Officer:</strong> dpo@[yourgame].com (EU residents)</li>
                    <li><strong>General Support:</strong> support@[yourgame].com</li>
                    <li><strong>Mailing Address:</strong> [Your Business Address]</li>
                    <li><strong>Response Time:</strong> Privacy requests processed within 30 days</li>
                  </ul>
                  
                  <p><strong>Regulatory Authorities:</strong> You have the right to lodge complaints with your local data protection authority regarding our privacy practices.</p>
                </div>

                <p className="privacy-footer">
                  <strong>Last Updated:</strong> {new Date().toLocaleDateString()}<br/>
                  <strong>Version:</strong> 1.0<br/>
                  This Privacy Policy is effective immediately and applies to all users of our service.
                </p>
              </div>
            </div>
          </div>
        )}

      {/* New Feature Modals */}
      {showAchievements && (
        <AchievementSystem 
          isOpen={showAchievements} 
          onClose={() => setShowAchievements(false)}
          lightningAddress={lightningAddress}
          socket={socket}
        />
      )}

      {showMysteryBoxes && (
        <MysteryBoxes 
          isOpen={showMysteryBoxes} 
          onClose={() => setShowMysteryBoxes(false)}
          lightningAddress={lightningAddress}
          socket={socket}
        />
      )}

      {showLeaderboards && (
        <LeaderboardSystem 
          isOpen={showLeaderboards} 
          onClose={() => setShowLeaderboards(false)}
          lightningAddress={lightningAddress}
          socket={socket}
        />
      )}


      {/* Notifications */}
      {newAchievement && (
        <div className="achievement-notification">
          <div className="achievement-content">
            <div className="achievement-icon">🏆</div>
            <div className="achievement-text">
              <h4>Achievement Unlocked!</h4>
              <p>{newAchievement.name}</p>
              <p className="reward">+{newAchievement.reward} sats</p>
            </div>
          </div>
        </div>
      )}

      {newMysteryBox && (
        <div className="mysterybox-notification">
          <div className="mysterybox-content">
            <div className="mysterybox-icon">🎁</div>
            <div className="mysterybox-text">
              <h4>Mystery Box Received!</h4>
              <p>{newMysteryBox.boxType} Box</p>
              <p className="reason">{newMysteryBox.reason}</p>
            </div>
          </div>
        </div>
      )}

      {streakBonus && (
        <div className="streak-notification">
          <div className="streak-content">
            <div className="streak-icon">🔥</div>
            <div className="streak-text">
              <h4>Streak Bonus!</h4>
              <p>Win streak: {streakBonus.streak}</p>
              <p className="reward">+{streakBonus.bonus} sats bonus</p>
            </div>
          </div>
        </div>
      )}

      <div ref={confettiRef} className="confetti-container"></div>
    </div>
  );
}
