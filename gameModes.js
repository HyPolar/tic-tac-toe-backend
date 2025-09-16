// Game modes for enhanced gameplay variety

const GAME_MODES = {
  CLASSIC: 'classic',
  SPEED: 'speed', 
  TOURNAMENT: 'tournament',
  MYSTERY: 'mystery'
};

class TournamentManager {
  constructor() {
    this.tournaments = new Map();
    this.playerTournaments = new Map();
  }

  createTournament(config) {
    const tournament = {
      id: `tournament_${Date.now()}`,
      ...config,
      players: [],
      status: 'waiting',
      createdAt: new Date()
    };
    
    this.tournaments.set(tournament.id, tournament);
    return tournament;
  }

  joinTournament(tournamentId, playerId) {
    const tournament = this.tournaments.get(tournamentId);
    if (!tournament || tournament.status !== 'waiting') return false;
    
    tournament.players.push(playerId);
    this.playerTournaments.set(playerId, tournamentId);
    return true;
  }
}

class SpeedRoundManager {
  constructor() {
    this.speedGames = new Map();
  }

  createSpeedGame(gameId, timeLimit = 10) {
    this.speedGames.set(gameId, {
      timeLimit,
      startTime: Date.now(),
      moves: []
    });
  }

  getTimeLeft(gameId) {
    const speedGame = this.speedGames.get(gameId);
    if (!speedGame) return 0;
    
    const elapsed = Date.now() - speedGame.startTime;
    return Math.max(0, speedGame.timeLimit * 1000 - elapsed);
  }
}

class MysteryModeManager {
  constructor() {
    this.mysteryEffects = [
      'double_sats', 'extra_move', 'reveal_opponent', 'time_freeze'
    ];
  }

  generateMysteryEffect() {
    return this.mysteryEffects[Math.floor(Math.random() * this.mysteryEffects.length)];
  }
}

module.exports = {
  tournamentManager: new TournamentManager(),
  speedRoundManager: new SpeedRoundManager(), 
  mysteryModeManager: new MysteryModeManager(),
  GAME_MODES
};
