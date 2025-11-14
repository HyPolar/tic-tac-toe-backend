# 🤖 Bot System Specifications

## Overview
The Tic-Tac-Toe bot system implements sophisticated game logic with predetermined patterns to ensure balanced and engaging gameplay while maintaining strategic revenue optimization.

## 🎯 Bot Patterns

### 50 SATS Bet Pattern
- **Pattern**: `W-L-W-W-L-L-L-W-L` (repeats)
- **Rule**: Player **WINS** their first game
- **Logic**: Balanced gameplay with slight player advantage on entry
- **Win Rate**: ~55% for players
- **Use Case**: Entry-level betting, player retention

### 300+ SATS Bet Pattern  
- **Pattern**: `L-W-L-W-L-L-W-L-W` (repeats)
- **Rule**: Player **LOSES** their first game
- **Logic**: Higher stakes require initial loss, then balanced gameplay
- **Win Rate**: ~45% for players overall
- **Use Case**: Higher stakes with strategic comeback opportunities

## 🔄 Revenge Logic (300+ SATS Only)

### Requirements for Revenge Win
1. **Same Lightning Address**: Must be identical player
2. **Same Bet Amount**: Exact same SATS amount as the lost game
3. **Second Game**: Must be the player's 2nd game with that bet amount
4. **Recent Loss**: Previous game with same bet amount must have been a loss

### Example Scenarios
✅ **Revenge Triggered**: 
- Game 1: bet 500 SATS → LOSE
- Game 2: bet 500 SATS → WIN (guaranteed)

❌ **No Revenge**:
- Game 1: bet 500 SATS → LOSE  
- Game 2: bet 1000 SATS → Follow normal pattern (no revenge)

❌ **No Revenge**:
- Game 1: bet 500 SATS → WIN
- Game 2: bet 500 SATS → Follow normal pattern (no revenge)

## ⏰ Timing Rules

### Turn Timers
- **First Turn**: 8 seconds (thinking time)
- **Subsequent Turns**: 5 seconds (quick decisions)
- **All Draw Games**: 5 seconds per turn
- **After Draw**: Opponent gets first turn (5 seconds, not 8)

### Turn Assignment
- **New Game**: Random assignment of first turn
- **After Draw**: Opponent of previous first player goes first
- **Bot vs Player**: Either can start randomly

## 🎲 Draw Handling

### Fair Games (Bot Should Lose)
- **Draw Tolerance**: 2-5 draws before forced outcome
- **Behavior**: Bot makes "silly mistake" after draws
- **Strategy**: Don't block obvious player wins
- **Outcome**: Player wins after extended draws

### Cheating Games (Bot Should Win)  
- **Draw Tolerance**: 3-4 draws before forced outcome
- **Behavior**: Bot plays strategically to win
- **Strategy**: Full competitive play with optimal moves
- **Outcome**: Bot wins after creating tension

## 🧠 Bot Intelligence Levels

### Difficulty by Bet Amount
- **≤50 SATS**: EASY (30% win rate, many mistakes)
- **≤300 SATS**: MEDIUM (50% win rate, balanced play)
- **≤1000 SATS**: HARD (70% win rate, strategic play)  
- **>1000 SATS**: EXPERT (85% win rate, near-perfect play)

### Behavioral Traits
- **Fair Games**: 40% strategic, 60% noobish behavior
- **Cheating Games**: 90% strategic, 10% human-like mistakes
- **Thinking Time**: 2-5 seconds (human-like delays)
- **Move Selection**: Strategic positioning with intentional errors

## 🏗️ Technical Implementation

### Bot Spawn Logic
- **Trigger**: No human opponent found within 13-25 seconds
- **Creation**: New BotPlayer instance with predetermined outcome
- **Cleanup**: Automatic cleanup after game completion
- **Logging**: Comprehensive move and outcome logging

### Pattern Tracking
- **Player History**: Stored by Lightning address
- **Pattern Index**: Tracks position in W/L patterns
- **Bet History**: Tracks recent bets for revenge logic
- **Statistics**: Global bot performance metrics

### Data Persistence
- **Memory Storage**: Player patterns stored in Map structures
- **Game Logging**: All bot games logged to files
- **Statistics**: Real-time bot performance tracking
- **Reset Capability**: Admin can reset all bot statistics

## 📊 Monitoring & Analytics

### Available Endpoints
- `GET /api/bots/stats` - Overall bot statistics
- `GET /api/bots/active` - Currently active bot games  
- `GET /api/bots/patterns` - Pattern and logic information
- `GET /api/bots/player-history/:address` - Individual player tracking
- `POST /api/bots/force-spawn` - Testing bot spawn
- `POST /api/bots/reset-stats` - Reset all statistics

### Key Metrics
- **Total Games**: All bot games played
- **Win Rate**: Bot victory percentage
- **Active Bots**: Currently running bot games
- **Pattern Compliance**: Adherence to W/L patterns
- **Average Think Time**: Bot response time analysis

## 🎮 Player Experience

### Fair Competition Feel
- **Tension Building**: Bots provide competitive gameplay
- **Human-like Behavior**: Realistic thinking times and mistakes
- **Strategic Depth**: Bots use proper tic-tac-toe strategy
- **Mistake Patterns**: Believable "human" errors

### Revenue Optimization
- **Entry Advantage**: 50 SATS players win first game (hook)
- **Strategic Loss**: 300+ SATS players lose first (comeback motivation)  
- **Revenge Mechanic**: Guaranteed win on exact retry (satisfaction)
- **Long-term Balance**: Overall patterns favor house slightly

## 🔧 Configuration

### Customizable Parameters
- **Spawn Delay**: 13-25 second range (configurable)
- **Think Time**: 2-5 second range (configurable)
- **Draw Limits**: 2-5 fair, 3-4 cheating (configurable)
- **Mistake Rates**: Difficulty-based error frequencies

### Pattern Modification
- **50 SATS Pattern**: Easily modifiable in constants
- **300+ Pattern**: Adjustable in bot logic constants  
- **Revenge Logic**: Configurable requirements
- **Difficulty Scaling**: Bet amount thresholds adjustable

## 🚀 Future Enhancements

### Planned Features
- **Machine Learning**: Adaptive bot behavior based on player patterns
- **Multiple Personalities**: Different bot "characters" with unique play styles
- **Dynamic Difficulty**: Real-time adjustment based on player skill
- **Advanced Analytics**: Deeper player behavior analysis

### Optimization Opportunities
- **Pattern Evolution**: Self-adjusting patterns based on performance
- **Regional Variations**: Different patterns for different markets
- **Seasonal Adjustments**: Holiday or event-based pattern modifications
- **A/B Testing**: Pattern effectiveness comparison

---

## 🎯 Success Metrics

The bot system is considered successful when:
- ✅ **Player Retention**: High return rate for both win and loss scenarios
- ✅ **Revenue Optimization**: Balanced house edge with player satisfaction
- ✅ **Engagement**: Players feel they're playing against skilled opponents
- ✅ **System Reliability**: Bots always available when humans aren't
- ✅ **Pattern Adherence**: Strict compliance with predetermined outcomes

This system ensures 24/7 game availability while maintaining the excitement and unpredictability that keeps players engaged! 🎮⚡
