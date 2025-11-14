import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function LeaderboardSystem({ lightningAddress, onClose }) {
  const [activeTab, setActiveTab] = useState('profit');
  const [leaderboards, setLeaderboards] = useState({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');
  const [userRank, setUserRank] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [showUserStats, setShowUserStats] = useState(false);

  useEffect(() => {
    fetchLeaderboards();
    if (lightningAddress) {
      fetchUserStats();
    }
  }, [activeTab, period, lightningAddress]);

  const fetchLeaderboards = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/leaderboards?type=${activeTab}&period=${period}&limit=50`);
      const data = await response.json();
      
      setLeaderboards(prev => ({
        ...prev,
        [activeTab]: data.leaderboard || []
      }));

      // Find user's rank
      if (lightningAddress && data.leaderboard) {
        const rank = data.leaderboard.findIndex(player => 
          player.lightningAddress === lightningAddress || player.playerId === lightningAddress
        );
        setUserRank(rank >= 0 ? rank + 1 : null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboards:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStreakLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/leaderboards/streaks?limit=50`);
      const data = await response.json();
      
      setLeaderboards(prev => ({
        ...prev,
        streaks: data.leaderboard || []
      }));
    } catch (error) {
      console.error('Failed to fetch streak leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/player-stats/${lightningAddress}`);
      if (response.ok) {
        const data = await response.json();
        setUserStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'streaks') {
      fetchStreakLeaderboard();
    }
  };

  const formatValue = (value, type) => {
    switch (type) {
      case 'profit':
      case 'satsEarned':
        return `${value >= 0 ? '+' : ''}${value.toLocaleString()} SATS`;
      case 'wins':
        return `${value.toLocaleString()} wins`;
      case 'winrate':
        return `${value}%`;
      case 'streaks':
        return `${value} game streak`;
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = (rank) => {
    // This would require historical data to show trends
    // For now, we'll show neutral
    return '━';
  };

  const getPlayerBadge = (player) => {
    if (player.winRate >= 90) return { icon: '👑', text: 'Champion', color: '#FFD700' };
    if (player.winRate >= 75) return { icon: '🏆', text: 'Master', color: '#FFD700' };
    if (player.winRate >= 60) return { icon: '⭐', text: 'Expert', color: '#FFA500' };
    if (player.streak >= 5) return { icon: '🔥', text: 'Hot Streak', color: '#FF4500' };
    if (player.gamesPlayed >= 100) return { icon: '🎯', text: 'Veteran', color: '#4CAF50' };
    return null;
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🏆';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return '#FFD700';
      case 2: return '#C0C0C0';
      case 3: return '#CD7F32';
      default: return '#666';
    }
  };

  const currentLeaderboard = leaderboards[activeTab] || [];
  const tabs = [
    { id: 'profit', name: 'Profit', icon: '💰', description: 'Total SATS earned' },
    { id: 'wins', name: 'Wins', icon: '🏆', description: 'Games won' },
    { id: 'winrate', name: 'Win Rate', icon: '📈', description: 'Win percentage' },
    { id: 'streaks', name: 'Streaks', icon: '🔥', description: 'Longest winning streak' }
  ];

  const periods = [
    { id: 'all', name: 'All Time' },
    { id: 'week', name: 'This Week' },
    { id: 'month', name: 'This Month' }
  ];

  return (
    <div className="leaderboard-modal">
      <div className="leaderboard-content">
        <div className="leaderboard-header">
          <h2>🏆 Leaderboards</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="leaderboard-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-name">{tab.name}</span>
            </button>
          ))}
        </div>

        {activeTab !== 'streaks' && (
          <div className="period-selector">
            {periods.map(p => (
              <button
                key={p.id}
                className={`period-btn ${period === p.id ? 'active' : ''}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {(userRank || userStats) && (
          <div className="user-profile-section">
            {userRank && (
              <div className="user-rank">
                <span className="rank-icon">{getRankIcon(userRank)}</span>
                <span>Your Rank: #{userRank}</span>
                <span className="trend-indicator">{getTrendIcon(userRank)}</span>
              </div>
            )}
            
            {userStats && (
              <div className="user-quick-stats">
                <div className="quick-stat">
                  <span className="stat-label">Games:</span>
                  <span className="stat-value">{userStats.totalGames || 0}</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-label">Win Rate:</span>
                  <span className="stat-value">{userStats.winRate || 0}%</span>
                </div>
                <div className="quick-stat">
                  <span className="stat-label">Streak:</span>
                  <span className="stat-value">{userStats.currentStreak || 0}</span>
                </div>
                <button 
                  className="stats-toggle-btn"
                  onClick={() => setShowUserStats(!showUserStats)}
                >
                  {showUserStats ? 'Hide' : 'Show'} Detailed Stats
                </button>
              </div>
            )}
            
            {showUserStats && userStats && (
              <div className="detailed-user-stats">
                <h4>📊 Your Detailed Statistics</h4>
                <div className="detailed-stats-grid">
                  <div className="detailed-stat">
                    <span className="stat-icon">🏆</span>
                    <span className="stat-name">Total Wins</span>
                    <span className="stat-number">{userStats.wins || 0}</span>
                  </div>
                  <div className="detailed-stat">
                    <span className="stat-icon">💰</span>
                    <span className="stat-name">Total Profit</span>
                    <span className="stat-number">{userStats.profit || 0} SATS</span>
                  </div>
                  <div className="detailed-stat">
                    <span className="stat-icon">📈</span>
                    <span className="stat-name">Best Streak</span>
                    <span className="stat-number">{userStats.bestStreak || 0}</span>
                  </div>
                  <div className="detailed-stat">
                    <span className="stat-icon">⚡</span>
                    <span className="stat-name">Current Streak</span>
                    <span className="stat-number">{userStats.currentStreak || 0}</span>
                  </div>
                </div>
                
                {userStats.ranks && (
                  <div className="rank-breakdown">
                    <h5>🏅 Your Rankings</h5>
                    <div className="rank-grid">
                      {Object.entries(userStats.ranks).map(([category, rank]) => rank && (
                        <div key={category} className="rank-item">
                          <span>{tabs.find(t => t.id === category)?.icon}</span>
                          <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                          <span>#{rank}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="loading">Loading leaderboard...</div>
        ) : (
          <div className="leaderboard-list">
            {currentLeaderboard.length > 0 ? (
              <>
                <div className="leaderboard-table">
                  <div className="table-header">
                    <span>Rank</span>
                    <span>Player</span>
                    <span>{tabs.find(t => t.id === activeTab)?.name}</span>
                  </div>
                  {currentLeaderboard.map((player, index) => {
                    const rank = index + 1;
                    const isCurrentUser = player.lightningAddress === lightningAddress || player.playerId === lightningAddress;
                    const badge = getPlayerBadge(player);
                    const displayName = player.lightningAddress || player.playerId || `Player ${index + 1}`;
                    const shortName = displayName.length > 25 ? displayName.substring(0, 22) + '...' : displayName;
                    
                    return (
                      <div 
                        key={player.lightningAddress || player.playerId || index} 
                        className={`table-row ${isCurrentUser ? 'current-user' : ''} ${rank <= 3 ? 'top-three' : ''}`}
                        style={{ borderLeft: `4px solid ${getRankColor(rank)}` }}
                      >
                        <div className="rank-cell">
                          <span 
                            className="rank-number"
                            style={{ color: getRankColor(rank) }}
                          >
                            {getRankIcon(rank)}
                          </span>
                          {rank <= 3 && <div className="rank-glow" style={{ background: getRankColor(rank) }}></div>}
                        </div>
                        
                        <div className="player-cell">
                          <div className="player-info">
                            <div className="player-name-row">
                              <span className="player-name" title={displayName}>
                                {shortName}
                              </span>
                              {isCurrentUser && <span className="you-indicator">YOU</span>}
                              {badge && (
                                <span className="player-badge" style={{ color: badge.color }}>
                                  {badge.icon} {badge.text}
                                </span>
                              )}
                            </div>
                            <div className="player-sub-info">
                              <span className="sub-stat">W: {player.wins || 0}</span>
                              <span className="sub-stat">Games: {player.gamesPlayed || 0}</span>
                              <span className="sub-stat">WR: {player.winRate || 0}%</span>
                              {player.streak > 0 && <span className="sub-stat streak">🔥{player.streak}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="score-cell">
                          <div className="main-score">
                            {formatValue(player.score, activeTab)}
                          </div>
                          {activeTab === 'profit' && player.score > 0 && (
                            <div className="profit-indicator positive">📈</div>
                          )}
                          {activeTab === 'profit' && player.score < 0 && (
                            <div className="profit-indicator negative">📉</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {currentLeaderboard.length === 50 && (
                  <div className="load-more">
                    <p>Showing top 50 players</p>
                  </div>
                )}
              </>
            ) : (
              <div className="no-data">
                <p>No leaderboard data yet!</p>
                <p>Play some games to see rankings!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
