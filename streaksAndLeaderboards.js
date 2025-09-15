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
      streak: new Map()
    };
  }

  updatePlayer(playerId, stats) {
    if (stats.wins !== undefined) {
      this.leaderboards.wins.set(playerId, stats.wins);
    }
    if (stats.satsEarned !== undefined) {
      this.leaderboards.satsEarned.set(playerId, stats.satsEarned);
    }
    if (stats.streak !== undefined) {
      this.leaderboards.streak.set(playerId, Math.abs(stats.streak));
    }
  }

  getTopPlayers(category = 'wins', limit = 10) {
    const board = this.leaderboards[category];
    if (!board) return [];

    return Array.from(board.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([playerId, score]) => ({ playerId, score }));
  }
}

module.exports = {
  streakSystem: new StreakSystem(),
  globalLeaderboards: new GlobalLeaderboards()
};
