// Achievement system for addictive gameplay
const achievements = [
  { id: 'first_win', name: 'First Victory', description: 'Win your first game', reward: 10 },
  { id: 'streak_3', name: 'Hot Streak', description: 'Win 3 games in a row', reward: 50 },
  { id: 'streak_5', name: 'Unstoppable', description: 'Win 5 games in a row', reward: 100 },
  { id: 'big_better', name: 'High Roller', description: 'Place a bet of 1000+ SATS', reward: 25 },
  { id: 'mystery_opener', name: 'Curious Explorer', description: 'Open your first mystery box', reward: 15 }
];

class AchievementSystem {
  constructor() {
    this.playerAchievements = new Map();
  }

  checkAchievement(playerId, achievementId, data = {}) {
    if (!this.playerAchievements.has(playerId)) {
      this.playerAchievements.set(playerId, new Set());
    }
    
    const playerAchievs = this.playerAchievements.get(playerId);
    if (playerAchievs.has(achievementId)) return null;

    const achievement = achievements.find(a => a.id === achievementId);
    if (!achievement) return null;

    playerAchievs.add(achievementId);
    return {
      achievement,
      reward: achievement.reward,
      newTotal: data.newTotal || 0
    };
  }
}

module.exports = { achievementSystem: new AchievementSystem() };
