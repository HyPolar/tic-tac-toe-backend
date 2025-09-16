import React, { useState, useEffect } from 'react';
import './LeaderboardSystem.css';

const LeaderboardSystem = ({ lightningAddress, isOpen, onClose }) => {
  const [leaderboards, setLeaderboards] = useState({});
  const [currentBoard, setCurrentBoard] = useState('profit');
  const [currentPeriod, setCurrentPeriod] = useState('all');
  const [playerRank, setPlayerRank] = useState(null);
  const [loading, setLoading] = useState(true);

  const boardTypes = [
    { id: 'profit', name: 'Top Earners', icon: '💰', desc: 'Highest net profit' },
    { id: 'wins', name: 'Most Wins', icon: '🏆', desc: 'Total victories' },
    { id: 'winrate', name: 'Win Rate', icon: '📊', desc: 'Best win percentage' },
    { id: 'rank', name: 'Global Rank', icon: '👑', desc: 'Overall ranking' },
    { id: 'games', name: 'Most Active', icon: '🎮', desc: 'Total games played' }
  ];

  const periods = [
    { id: 'all', name: 'All Time', icon: '🌟' },
    { id: 'season', name: 'This Season', icon: '📅' },
    { id: 'weekly', name: 'This Week', icon: '📈' },
    { id: 'daily', name: 'Today', icon: '⚡' }
  ];

  const streakBoards = [
    { id: 'streaks', name: 'Win Streaks', icon: '🔥', desc: 'Current win streaks' }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
      if (lightningAddress) {
        fetchPlayerRank();
      }
    }
  }, [isOpen, currentBoard, currentPeriod, lightningAddress]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      let endpoint;
      
      if (currentBoard === 'streaks') {
        endpoint = '/api/leaderboards/streaks?limit=50';
      } else {
        endpoint = `/api/leaderboards?type=${currentBoard}&period=${currentPeriod}&limit=50`;
      }
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      setLeaderboards(prev => ({
        ...prev,
        [`${currentBoard}-${currentPeriod}`]: data
      }));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      setLoading(false);
    }
  };

  const fetchPlayerRank = async () => {
    try {
      const response = await fetch(`/api/player-stats/${encodeURIComponent(lightningAddress)}`);
      const data = await response.json();
      setPlayerRank(data);
    } catch (error) {
      console.error('Failed to fetch player rank:', error);
    }
  };

  const getCurrentLeaderboard = () => {
    return leaderboards[`${currentBoard}-${currentPeriod}`] || [];
  };

  const getRankDisplay = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
  };

  const getStatDisplay = (player, type) => {
    switch (type) {
      case 'profit':
        return `${player.netProfit || player.profit || 0} sats`;
      case 'wins':
        return `${player.wins || 0} wins`;
      case 'winrate':
        return `${player.winRate || 0}%`;
      case 'rank':
        return `${player.rankPoints || 1000} pts`;
      case 'games':
        return `${player.totalGames || player.games || 0} games`;
      case 'streaks':
        return `${player.currentStreak || 0} streak`;
      default:
        return '';
    }
  };

  const getPlayerPosition = () => {
    const board = getCurrentLeaderboard();
    const playerName = lightningAddress?.split('@')[0];
    const position = board.findIndex(p => p.player === playerName);
    return position >= 0 ? position + 1 : null;
  };

  if (!isOpen) return null;

  return (
    <div className="leaderboard-overlay">
      <div className="leaderboard-modal">
        <div className="leaderboard-header">
          <div className="header-content">
            <h2>🏆 Leaderboards</h2>
            {playerRank && (
              <div className="player-summary">
                <span className="rank-info">Your Rank: #{playerRank.currentRank || '?'}</span>
                <span className="points-info">{playerRank.rankPoints || 1000} pts</span>
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="board-controls">
          <div className="board-types">
            {boardTypes.map(type => (
              <button
                key={type.id}
                className={`board-btn ${currentBoard === type.id ? 'active' : ''}`}
                onClick={() => setCurrentBoard(type.id)}
                title={type.desc}
              >
                <span className="board-icon">{type.icon}</span>
                <span className="board-name">{type.name}</span>
              </button>
            ))}
            {streakBoards.map(type => (
              <button
                key={type.id}
                className={`board-btn ${currentBoard === type.id ? 'active' : ''}`}
                onClick={() => setCurrentBoard(type.id)}
                title={type.desc}
              >
                <span className="board-icon">{type.icon}</span>
                <span className="board-name">{type.name}</span>
              </button>
            ))}
          </div>

          {currentBoard !== 'streaks' && (
            <div className="period-controls">
              {periods.map(period => (
                <button
                  key={period.id}
                  className={`period-btn ${currentPeriod === period.id ? 'active' : ''}`}
                  onClick={() => setCurrentPeriod(period.id)}
                >
                  <span className="period-icon">{period.icon}</span>
                  <span className="period-name">{period.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="leaderboard-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading leaderboard...</p>
            </div>
          ) : (
            <>
              {getPlayerPosition() && (
                <div className="player-position">
                  <div className="position-card">
                    <span className="position-rank">{getRankDisplay(getPlayerPosition() - 1)}</span>
                    <div className="position-info">
                      <span className="position-name">Your Position</span>
                      <span className="position-stat">
                        {getStatDisplay({ 
                          [currentBoard]: playerRank?.[currentBoard] || 0 
                        }, currentBoard)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="leaderboard-list">
                {getCurrentLeaderboard().map((player, index) => (
                  <div 
                    key={player.player} 
                    className={`leaderboard-entry ${index < 3 ? 'top-three' : ''} ${player.player === lightningAddress?.split('@')[0] ? 'current-player' : ''}`}
                  >
                    <div className="entry-rank">
                      {getRankDisplay(index)}
                    </div>
                    <div className="entry-info">
                      <div className="player-name">
                        {player.player}
                        {player.isTopPlayer && <span className="top-badge">👑</span>}
                        {player.isActive && <span className="active-badge">🟢</span>}
                      </div>
                      <div className="player-stats">
                        <span className="main-stat">
                          {getStatDisplay(player, currentBoard)}
                        </span>
                        {currentBoard !== 'winrate' && player.winRate && (
                          <span className="sub-stat">{player.winRate}% WR</span>
                        )}
                        {currentBoard !== 'games' && (player.totalGames || player.games) && (
                          <span className="sub-stat">{player.totalGames || player.games} games</span>
                        )}
                      </div>
                    </div>
                    <div className="entry-badge">
                      {index === 0 && <div className="champion-glow"></div>}
                      {index < 10 && <div className="top-ten-badge">TOP {index + 1}</div>}
                    </div>
                  </div>
                ))}

                {getCurrentLeaderboard().length === 0 && (
                  <div className="empty-board">
                    <span className="empty-icon">📊</span>
                    <h3>No data yet</h3>
                    <p>Be the first to appear on this leaderboard!</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="leaderboard-footer">
          <div className="rewards-info">
            <h4>🎁 Weekly Rewards</h4>
            <div className="reward-tiers">
              <span className="tier">🥇 Top 1: 1000 sats</span>
              <span className="tier">🥈 Top 3: 500 sats</span>
              <span className="tier">🥉 Top 10: 100 sats</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardSystem;
