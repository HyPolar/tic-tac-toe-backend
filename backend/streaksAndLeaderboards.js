// Streak system and leaderboards for competitive engagement

class StreakSystem {
  constructor() {
    this.playerStreaks = new Map();
  }

  updateStreak(playerId, won) {
    const currentStreak = this.playerStreaks.get(playerId) || 0;
    
    if (won) {
      const newStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      this.playerStreaks.set(playerId, newStreak);
      return { streak: newStreak, bonus: this.calculateBonus(newStreak) };
    } else {
      const newStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      this.playerStreaks.set(playerId, newStreak);
      return { streak: newStreak, bonus: 0 };
    }
  }

  calculateBonus(streak) {
    if (streak >= 5) return 50;
    if (streak >= 3) return 25;
    if (streak >= 2) return 10;
    return 0;
  }

  getStreak(playerId) {
    return this.playerStreaks.get(playerId) || 0;
  }
}

class GlobalLeaderboards {
  constructor() {
    this.leaderboards = {
      wins: new Map(),
      satsEarned: new Map(),
      streak: new Map(),
      profit: new Map(),
      winrate: new Map(),
      gamesPlayed: new Map(),
      averageGameTime: new Map()
    };
    this.playerProfiles = new Map();
    this.seasonalData = new Map();
  }

  updatePlayer(playerId, stats) {
    // Core stats
    if (stats.wins !== undefined) {
      this.leaderboards.wins.set(playerId, stats.wins);
    }
    if (stats.satsEarned !== undefined) {
      this.leaderboards.satsEarned.set(playerId, stats.satsEarned);
    }
    if (stats.streak !== undefined) {
      this.leaderboards.streak.set(playerId, Math.abs(stats.streak));
    }
    if (stats.profit !== undefined) {
      this.leaderboards.profit.set(playerId, stats.profit);
    }
    if (stats.gamesPlayed !== undefined) {
      this.leaderboards.gamesPlayed.set(playerId, stats.gamesPlayed);
      // Calculate win rate
      const wins = this.leaderboards.wins.get(playerId) || 0;
      const winRate = stats.gamesPlayed > 0 ? Math.round((wins / stats.gamesPlayed) * 100) : 0;
      this.leaderboards.winrate.set(playerId, winRate);
    }
    
    // Update player profile
    const profile = this.playerProfiles.get(playerId) || {};
    this.playerProfiles.set(playerId, {
      ...profile,
      ...stats,
      lastUpdated: new Date().toISOString(),
      lightningAddress: stats.lightningAddress || profile.lightningAddress
    });
  }

  getLeaderboard(type = 'profit', period = 'all', limit = 50) {
    const board = this.leaderboards[type];
    if (!board) return [];

    let entries = Array.from(board.entries());
    
    // Apply period filtering (simplified for now)
    if (period !== 'all') {
      // In a real implementation, you'd filter by date
      // For now, we'll just return all data
    }
    
    return entries
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([playerId, score]) => {
        const profile = this.playerProfiles.get(playerId) || {};
        return {
          playerId,
          lightningAddress: profile.lightningAddress || playerId,
          score,
          wins: this.leaderboards.wins.get(playerId) || 0,
          gamesPlayed: this.leaderboards.gamesPlayed.get(playerId) || 0,
          winRate: this.leaderboards.winrate.get(playerId) || 0,
          streak: this.leaderboards.streak.get(playerId) || 0,
          profit: this.leaderboards.profit.get(playerId) || 0
        };
      });
  }
  
  getStreakLeaderboard(limit = 20) {
    const streakBoard = this.leaderboards.streak;
    if (!streakBoard) return [];
    
    return Array.from(streakBoard.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([playerId, streak]) => {
        const profile = this.playerProfiles.get(playerId) || {};
        return {
          playerId,
          lightningAddress: profile.lightningAddress || playerId,
          score: streak,
          streak,
          wins: this.leaderboards.wins.get(playerId) || 0,
          profit: this.leaderboards.profit.get(playerId) || 0
        };
      });
  }
  
  getPlayerRank(playerId, type = 'profit') {
    const leaderboard = this.getLeaderboard(type, 'all', 1000);
    const rank = leaderboard.findIndex(player => player.playerId === playerId);
    return rank >= 0 ? rank + 1 : null;
  }
  
  getPlayerStats(playerId) {
    const profile = this.playerProfiles.get(playerId) || {};
    const ranks = {
      profit: this.getPlayerRank(playerId, 'profit'),
      wins: this.getPlayerRank(playerId, 'wins'),
      winrate: this.getPlayerRank(playerId, 'winrate'),
      streak: this.getPlayerRank(playerId, 'streak')
    };
    
    return {
      ...profile,
      ranks,
      totalGames: this.leaderboards.gamesPlayed.get(playerId) || 0,
      currentStreak: this.leaderboards.streak.get(playerId) || 0
    };
  }
}

module.exports = {
  streakSystem: new StreakSystem(),
  globalLeaderboards: new GlobalLeaderboards()
};
