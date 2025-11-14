// Mystery box system for engagement and rewards

const BOX_TYPES = {
  BRONZE: { name: 'Bronze Box', satReward: [5, 15], rarity: 0.45, emoji: '🥉', color: '#CD7F32' },
  SILVER: { name: 'Silver Box', satReward: [20, 50], rarity: 0.35, emoji: '🥈', color: '#C0C0C0' },
  GOLD: { name: 'Gold Box', satReward: [75, 150], rarity: 0.15, emoji: '🏆', color: '#FFD700' },
  EPIC: { name: 'Epic Box', satReward: [200, 400], rarity: 0.04, emoji: '💎', color: '#9932CC' },
  LEGENDARY: { name: 'Legendary Box', satReward: [500, 1000], rarity: 0.01, emoji: '⭐', color: '#FF4500' }
};

class MysteryBoxManager {
  constructor() {
    this.playerBoxes = new Map();
    this.playerStats = new Map();
    this.dailyBoxClaims = new Map();
    this.playerStreaks = new Map();
  }

  awardBox(playerId, reason = 'game_win', forceType = null) {
    let boxType = forceType;
    
    if (!boxType) {
      const rand = Math.random();
      if (rand < 0.01) boxType = 'LEGENDARY';
      else if (rand < 0.05) boxType = 'EPIC';
      else if (rand < 0.2) boxType = 'GOLD';
      else if (rand < 0.55) boxType = 'SILVER';
      else boxType = 'BRONZE';
      
      // Streak bonus - higher chance for better boxes
      const streak = this.playerStreaks.get(playerId) || 0;
      if (streak >= 5 && rand < 0.15) {
        boxType = 'GOLD';
      } else if (streak >= 3 && rand < 0.25) {
        boxType = 'SILVER';
      }
    }
    
    const box = {
      id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: boxType,
      reason,
      awardedAt: new Date(),
      opened: false,
      rarity: BOX_TYPES[boxType].rarity
    };

    if (!this.playerBoxes.has(playerId)) {
      this.playerBoxes.set(playerId, []);
    }
    
    this.playerBoxes.get(playerId).push(box);
    
    // Update streak
    if (reason === 'game_win') {
      this.playerStreaks.set(playerId, (this.playerStreaks.get(playerId) || 0) + 1);
    } else if (reason === 'game_loss') {
      this.playerStreaks.set(playerId, 0);
    }
    
    return box;
  }

  openBox(playerId, boxId) {
    const boxes = this.playerBoxes.get(playerId) || [];
    const box = boxes.find(b => b.id === boxId && !b.opened);
    
    if (!box) return null;

    const boxConfig = BOX_TYPES[box.type];
    const reward = Math.floor(Math.random() * (boxConfig.satReward[1] - boxConfig.satReward[0] + 1)) + boxConfig.satReward[0];
    
    box.opened = true;
    box.reward = reward;
    box.openedAt = new Date();
    
    return { box, reward };
  }

  getPlayerBoxes(playerId) {
    return this.playerBoxes.get(playerId) || [];
  }

  getDailyMysteryBox(playerId) {
    const today = new Date().toDateString();
    const lastClaim = this.dailyBoxClaims.get(playerId);
    
    if (lastClaim && lastClaim === today) {
      return { success: false, message: 'Daily box already claimed today' };
    }
    
    this.dailyBoxClaims.set(playerId, today);
    const box = this.awardBox(playerId, 'daily_reward', 'SILVER'); // Daily boxes are always silver
    
    return { success: true, box };
  }

  getBoxStats(playerId) {
    const boxes = this.getPlayerBoxes(playerId);
    const openedBoxes = boxes.filter(b => b.opened);
    
    const stats = {
      totalBoxes: boxes.length,
      totalOpened: openedBoxes.length,
      totalEarned: openedBoxes.reduce((sum, box) => sum + (box.reward || 0), 0),
      bestReward: Math.max(...openedBoxes.map(box => box.reward || 0), 0),
      boxesByType: {},
      currentStreak: this.playerStreaks.get(playerId) || 0
    };
    
    // Count boxes by type
    Object.keys(BOX_TYPES).forEach(type => {
      const typeBoxes = boxes.filter(b => b.type === type);
      stats.boxesByType[type] = {
        total: typeBoxes.length,
        opened: typeBoxes.filter(b => b.opened).length,
        earned: typeBoxes.filter(b => b.opened).reduce((sum, box) => sum + (box.reward || 0), 0)
      };
    });
    
    return stats;
  }

  openMysteryBox(playerId, boxId) {
    return this.openBox(playerId, boxId);
  }

  getTopBoxOpeners(limit = 10) {
    const leaderboard = [];
    
    for (const [playerId, boxes] of this.playerBoxes) {
      const openedBoxes = boxes.filter(b => b.opened);
      const totalEarned = openedBoxes.reduce((sum, box) => sum + (box.reward || 0), 0);
      
      if (openedBoxes.length > 0) {
        leaderboard.push({
          playerId,
          boxesOpened: openedBoxes.length,
          totalEarned,
          bestReward: Math.max(...openedBoxes.map(box => box.reward || 0))
        });
      }
    }
    
    return leaderboard
      .sort((a, b) => b.totalEarned - a.totalEarned)
      .slice(0, limit);
  }
}

module.exports = { 
  mysteryBoxManager: new MysteryBoxManager(), 
  BOX_TYPES,
  MysteryBoxManager 
};
