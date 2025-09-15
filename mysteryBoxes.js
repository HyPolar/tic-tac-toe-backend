// Mystery box system for engagement and rewards

const BOX_TYPES = {
  BRONZE: { name: 'Bronze Box', satReward: [5, 15], rarity: 0.6 },
  SILVER: { name: 'Silver Box', satReward: [20, 50], rarity: 0.3 },
  GOLD: { name: 'Gold Box', satReward: [75, 150], rarity: 0.1 }
};

class MysteryBoxManager {
  constructor() {
    this.playerBoxes = new Map();
  }

  awardBox(playerId, reason = 'game_win') {
    const rand = Math.random();
    let boxType = 'BRONZE';
    
    if (rand < 0.1) boxType = 'GOLD';
    else if (rand < 0.4) boxType = 'SILVER';
    
    const box = {
      id: `box_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: boxType,
      reason,
      awardedAt: new Date(),
      opened: false
    };

    if (!this.playerBoxes.has(playerId)) {
      this.playerBoxes.set(playerId, []);
    }
    
    this.playerBoxes.get(playerId).push(box);
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
}

module.exports = { mysteryBoxManager: new MysteryBoxManager(), BOX_TYPES };
