const winston = require('winston');

// Bot logger
const botLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/bot-games.log' })
  ]
});

// Player history tracking for patterns
const playerHistory = new Map();

// Win/loss patterns - Updated per user specifications
const PATTERN_50_SATS = ['W', 'L', 'W', 'W', 'L', 'L', 'L', 'W', 'L'];
const PATTERN_300_PLUS = ['L', 'W', 'L', 'W', 'L', 'L', 'W', 'L', 'W'];

// Track player bet history for 300+ sats logic
const betHistory = new Map(); // lightningAddress -> { lastBet, lastResult, gameCount }

class BotPlayer {
  constructor(gameId, betAmount, opponentAddress) {
    this.gameId = gameId;
    this.betAmount = betAmount;
    this.opponentAddress = opponentAddress;
    this.moveHistory = [];
    this.thinkingTime = this.generateThinkingTime();
    this.shouldWin = this.determineOutcome();
    this.drawCount = 0;
    // Updated draw logic per user specifications
    // Fair games (bot should lose): 2-5 draws before forced outcome
    // Cheating games (bot should win): 3-4 draws before forced outcome
    this.maxDrawsBeforeEnd = this.shouldWin ? 
      Math.floor(Math.random() * 2) + 3 : // 3-4 draws if bot should win (cheating games)
      Math.floor(Math.random() * 4) + 2;   // 2-5 draws if bot should lose (fair games)
  }

  generateThinkingTime() {
    // Updated per user specs: 5 seconds max (with some randomness for realism)
    // Random between 2-5 seconds to seem human-like
    return Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
  }

  getThinkingTime() {
    return this.generateThinkingTime();
  }

  determineOutcome() {
    if (!this.opponentAddress) return Math.random() > 0.5;

    // Initialize player history if needed
    if (!playerHistory.has(this.opponentAddress)) {
      playerHistory.set(this.opponentAddress, {
        patternIndex50: 0,
        patternIndex300: 0,
        gamesPlayed: 0
      });
    }

    const history = playerHistory.get(this.opponentAddress);
    
    if (this.betAmount === 50) {
      // Use 50 sats pattern: W-L-W-W-L-L-L-W-L
      const outcome = PATTERN_50_SATS[history.patternIndex50 % PATTERN_50_SATS.length];
      history.patternIndex50++;
      history.gamesPlayed++;
      
      botLogger.info({
        event: 'bot_outcome_determined',
        gameId: this.gameId,
        betAmount: this.betAmount,
        pattern: '50_sats',
        patternIndex: history.patternIndex50 - 1,
        outcome: outcome,
        opponentAddress: this.opponentAddress
      });
      
      return outcome === 'W';
    } else if (this.betAmount >= 300) {
      // Initialize bet history for this player
      if (!betHistory.has(this.opponentAddress)) {
        betHistory.set(this.opponentAddress, {
          lastBet: null,
          lastResult: null,
          gameCount: 0,
          consecutiveSameBet: 0
        });
      }
      
      const betInfo = betHistory.get(this.opponentAddress);
      
      // Check if this is a revenge game (2nd game with same bet after loss)
      // Requirements: same LN address, same bet amount, 2nd game, previous was loss
      if (betInfo.lastBet === this.betAmount && 
          betInfo.lastResult === 'L' && 
          betInfo.gameCount === 1) {
        // Player lost first game with this bet amount - let them win on 2nd try (revenge logic)
        betInfo.lastResult = 'W';
        betInfo.gameCount++;
        
        botLogger.info({
          event: 'bot_outcome_determined',
          gameId: this.gameId,
          betAmount: this.betAmount,
          pattern: '300_plus_revenge',
          outcome: 'player_wins',
          reason: 'second_game_same_bet_after_loss',
          opponentAddress: this.opponentAddress,
          previousBet: betInfo.lastBet,
          currentBet: this.betAmount,
          gameCount: betInfo.gameCount
        });
        
        return false; // Bot loses (player wins)
      }
      
      // Use 300+ sats pattern: L-W-L-W-L-L-W-L-W
      const outcome = PATTERN_300_PLUS[history.patternIndex300 % PATTERN_300_PLUS.length];
      history.patternIndex300++;
      history.gamesPlayed++;
      
      // Update bet history
      betInfo.lastBet = this.betAmount;
      betInfo.lastResult = outcome === 'W' ? 'W' : 'L';
      betInfo.gameCount++;
      
      botLogger.info({
        event: 'bot_outcome_determined',
        gameId: this.gameId,
        betAmount: this.betAmount,
        pattern: '300_plus',
        patternIndex: history.patternIndex300 - 1,
        outcome: outcome,
        opponentAddress: this.opponentAddress
      });
      
      return outcome === 'W';
    }
    
    // Default random for other amounts
    return Math.random() > 0.5;
  }

  evaluateBoard(board) {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    // Check for wins/blocks
    for (const line of lines) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];
      
      // Can win
      if (values.filter(v => v === 'O').length === 2 && values.includes(null)) {
        return line[values.indexOf(null)];
      }
    }

    for (const line of lines) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];
      
      // Must block
      if (values.filter(v => v === 'X').length === 2 && values.includes(null)) {
        return line[values.indexOf(null)];
      }
    }

    return null;
  }

  getStrategicMove(board) {
    // Check if we can win or need to block
    const critical = this.evaluateBoard(board);
    if (critical !== null) return critical;

    // Prefer center
    if (board[4] === null) return 4;

    // Prefer corners
    const corners = [0, 2, 6, 8].filter(i => board[i] === null);
    if (corners.length > 0) {
      return corners[Math.floor(Math.random() * corners.length)];
    }

    // Take any edge
    const edges = [1, 3, 5, 7].filter(i => board[i] === null);
    if (edges.length > 0) {
      return edges[Math.floor(Math.random() * edges.length)];
    }

    return null;
  }

  makeNoobMove(board) {
    const available = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
    
    // In fair games (when bot should lose), play more like a noob
    // Sometimes miss obvious winning moves (50% chance)
    if (Math.random() < 0.5) {
      const winMove = this.evaluateBoard(board);
      if (winMove !== null) {
        // Intentionally pick a different move
        const otherMoves = available.filter(m => m !== winMove);
        if (otherMoves.length > 0) {
          return otherMoves[Math.floor(Math.random() * otherMoves.length)];
        }
      }
    }
    
    // Sometimes miss blocks (60% chance - higher for more noobish behavior)
    if (Math.random() < 0.6) {
      // Just pick random
      return available[Math.floor(Math.random() * available.length)];
    }
    
    // Otherwise play somewhat strategically but not perfectly
    return this.getStrategicMove(board) || available[Math.floor(Math.random() * available.length)];
  }

  // New method for making a silly mistake that leads to loss
  makeSillyMistake(board) {
    const available = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
    
    // Check if opponent can win next turn and DON'T block them (silly mistake)
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6] // diagonals
    ];

    for (const line of lines) {
      const [a, b, c] = line;
      const values = [board[a], board[b], board[c]];
      
      // If opponent has 2 in a row, DON'T block them (silly mistake)
      if (values.filter(v => v === 'X').length === 2 && values.includes(null)) {
        const blockMove = line[values.indexOf(null)];
        const nonBlockMoves = available.filter(move => move !== blockMove);
        
        if (nonBlockMoves.length > 0) {
          // Make a move that doesn't block - this is the silly mistake
          return nonBlockMoves[Math.floor(Math.random() * nonBlockMoves.length)];
        }
      }
    }
    
    // If no silly mistake opportunity, just play randomly
    return available[Math.floor(Math.random() * available.length)];
  }

  getNextMove(board, moveCount) {
    const available = board.map((cell, i) => cell === null ? i : -1).filter(i => i !== -1);
    
    if (available.length === 0) return null;

    // Check if this could be a draw
    const isDraw = this.checkPotentialDraw(board);
    
    if (isDraw && this.drawCount >= this.maxDrawsBeforeEnd) {
      // Time to end the game based on predetermined outcome after sufficient draws
      if (this.shouldWin) {
        // Bot should win after 3-4 draws - play strategically to win
        const winningMove = this.getStrategicMove(board);
        botLogger.info({
          event: 'bot_forced_win_after_draws',
          gameId: this.gameId,
          drawCount: this.drawCount,
          maxDraws: this.maxDrawsBeforeEnd,
          selectedMove: winningMove
        });
        return winningMove || available[0];
      } else {
        // Bot should lose after 2-5 draws - make a "silly mistake"
        const sillyMove = this.makeSillyMistake(board);
        botLogger.info({
          event: 'bot_silly_mistake_after_draws',
          gameId: this.gameId,
          drawCount: this.drawCount,
          maxDraws: this.maxDrawsBeforeEnd,
          selectedMove: sillyMove
        });
        return sillyMove;
      }
    }

    // Normal gameplay
    if (this.shouldWin) {
      // In cheating games (bot should win) - play strategically with full tensed competition
      // Play optimally 90% of the time to create tension
      if (Math.random() < 0.9) {
        return this.getStrategicMove(board) || available[Math.floor(Math.random() * available.length)];
      } else {
        // Occasional slight mistake to seem human
        return available[Math.floor(Math.random() * available.length)];
      }
    } else {
      // In fair games (bot should lose) - play like a noob but with some tension
      // Give some competition but make crucial mistakes
      if (Math.random() < 0.4) {
        // Play strategically sometimes to create tension
        return this.getStrategicMove(board) || available[Math.floor(Math.random() * available.length)];
      } else {
        // Make noob moves more often
        return this.makeNoobMove(board);
      }
    }
  }

  checkPotentialDraw(board) {
    // Simple heuristic: if more than 5 moves made and no clear winner path
    const filledCells = board.filter(cell => cell !== null).length;
    if (filledCells >= 5) {
      this.drawCount++;
      return true;
    }
    return false;
  }

  logMove(position, board) {
    this.moveHistory.push({
      position,
      boardState: [...board],
      timestamp: Date.now()
    });
    
    botLogger.info({
      event: 'bot_move_made',
      gameId: this.gameId,
      position: position,
      moveNumber: this.moveHistory.length,
      boardAfterMove: [...board]
    });
  }

  // Main method called by server
  getMove(board) {
    const moveCount = board.filter(cell => cell !== null).length;
    const move = this.getNextMove(board, moveCount);
    
    if (move !== null) {
      this.logMove(move, board);
    }
    
    botLogger.info({
      event: 'bot_move_selected',
      gameId: this.gameId,
      move: move,
      boardState: [...board],
      moveCount: moveCount,
      shouldWin: this.shouldWin
    });
    
    return move;
  }

  // Record game result for history tracking
  recordGameResult(playerWon) {
    const humanWon = playerWon;
    
    // Log game completion
    botLogger.info({
      event: 'bot_game_completed',
      gameId: this.gameId,
      betAmount: this.betAmount,
      humanWon: humanWon,
      shouldWin: this.shouldWin,
      actualResult: humanWon ? 'bot_lost' : 'bot_won',
      moveHistory: this.moveHistory,
      opponentAddress: this.opponentAddress
    });
    
    if (!this.opponentAddress) return;
    
    // Update player history
    if (!playerHistory.has(this.opponentAddress)) {
      playerHistory.set(this.opponentAddress, {
        patternIndex50: 0,
        patternIndex300: 0,
        gamesPlayed: 0
      });
    }
    
    const history = playerHistory.get(this.opponentAddress);
    const result = playerWon ? 'W' : 'L';
    
    botLogger.info({
      event: 'bot_game_result_recorded',
      gameId: this.gameId,
      betAmount: this.betAmount,
      opponentAddress: this.opponentAddress,
      playerWon: playerWon,
      result: result
    });
  }
}

// Bot spawn timing
function getRandomBotSpawnDelay() {
  // Random delay between 13-25 seconds
  return Math.floor(Math.random() * 12000) + 13000;
}

// Generate bot Lightning address
function generateBotLightningAddress() {
  const botNames = [
    'player', 'gamer', 'pro', 'master', 'champion',
    'rookie', 'legend', 'ninja', 'wizard', 'knight',
    'dragon', 'phoenix', 'thunder', 'storm', 'shadow',
    'ace', 'bolt', 'cyber', 'flash', 'ghost',
    'hawk', 'iron', 'jet', 'king', 'lion'
  ];
  const name = botNames[Math.floor(Math.random() * botNames.length)];
  const num = Math.floor(Math.random() * 9999);
  return `${name}${num}@speed.app`;
}

// Enhanced bot difficulty levels
const BOT_DIFFICULTY = {
  EASY: 'easy',     // Makes many mistakes, 30% win rate
  MEDIUM: 'medium', // Balanced play, 50% win rate  
  HARD: 'hard',     // Strategic play, 70% win rate
  EXPERT: 'expert'  // Near perfect play, 85% win rate
};

// Get bot difficulty based on bet amount and player history
function getBotDifficulty(betAmount, playerHistory) {
  if (betAmount <= 50) {
    return BOT_DIFFICULTY.EASY;
  } else if (betAmount <= 300) {
    return BOT_DIFFICULTY.MEDIUM;
  } else if (betAmount <= 1000) {
    return BOT_DIFFICULTY.HARD;
  } else {
    return BOT_DIFFICULTY.EXPERT;
  }
}

// Bot game statistics tracking
const botStats = {
  totalGames: 0,
  totalWins: 0,
  totalLosses: 0,
  totalDraws: 0,
  averageThinkTime: 0,
  betAmountDistribution: new Map(),
  
  recordGame(result, betAmount, thinkTime) {
    this.totalGames++;
    if (result === 'win') this.totalWins++;
    else if (result === 'loss') this.totalLosses++;
    else this.totalDraws++;
    
    this.averageThinkTime = (this.averageThinkTime * (this.totalGames - 1) + thinkTime) / this.totalGames;
    
    const current = this.betAmountDistribution.get(betAmount) || { games: 0, wins: 0 };
    current.games++;
    if (result === 'win') current.wins++;
    this.betAmountDistribution.set(betAmount, current);
  },
  
  getStats() {
    return {
      totalGames: this.totalGames,
      winRate: this.totalGames > 0 ? (this.totalWins / this.totalGames * 100).toFixed(2) + '%' : '0%',
      averageThinkTime: this.averageThinkTime.toFixed(2) + 's',
      betDistribution: Object.fromEntries(this.betAmountDistribution)
    };
  }
};

module.exports = {
  BotPlayer,
  getRandomBotSpawnDelay,
  generateBotLightningAddress,
  getBotDifficulty,
  BOT_DIFFICULTY,
  botStats,
  playerHistory,
  betHistory,
  PATTERN_50_SATS,
  PATTERN_300_PLUS
};
