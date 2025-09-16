import React, { useState, useEffect } from 'react';
import './AchievementSystem.css';

const AchievementSystem = ({ lightningAddress, socket, isOpen, onClose }) => {
  const [achievements, setAchievements] = useState([]);
  const [playerProgress, setPlayerProgress] = useState(null);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [newUnlocked, setNewUnlocked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && lightningAddress) {
      fetchAchievements();
      fetchPlayerProgress();
    }
  }, [isOpen, lightningAddress]);

  useEffect(() => {
    if (socket) {
      socket.on('achievementsUnlocked', handleAchievementUnlocked);
      return () => socket.off('achievementsUnlocked', handleAchievementUnlocked);
    }
  }, [socket]);

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`/api/achievements`);
      const data = await response.json();
      setAchievements(data);
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    }
  };

  const fetchPlayerProgress = async () => {
    try {
      const response = await fetch(`/api/achievements/${encodeURIComponent(lightningAddress)}`);
      const data = await response.json();
      setPlayerProgress(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch player progress:', error);
      setLoading(false);
    }
  };

  const handleAchievementUnlocked = (data) => {
    setNewUnlocked(prev => [...prev, ...data.achievements]);
    fetchPlayerProgress(); // Refresh progress
    
    // Show celebration animation
    setTimeout(() => {
      setNewUnlocked([]);
    }, 5000);
  };

  const claimRewards = async () => {
    try {
      const response = await fetch(`/api/achievements/claim/${encodeURIComponent(lightningAddress)}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.rewards && data.rewards.length > 0) {
        const totalSats = data.rewards.reduce((sum, reward) => sum + reward.reward, 0);
        // Show reward claimed notification
        fetchPlayerProgress(); // Refresh to update pending rewards
      }
    } catch (error) {
      console.error('Failed to claim rewards:', error);
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: '#10b981',
      uncommon: '#3b82f6',
      rare: '#8b5cf6',
      legendary: '#f59e0b',
      epic: '#ef4444'
    };
    return colors[rarity] || colors.common;
  };

  if (!isOpen) return null;

  return (
    <div className="achievement-system-overlay">
      <div className="achievement-system-modal">
        <div className="achievement-header">
          <div className="header-content">
            <h2>🏆 Achievements</h2>
            <div className="progress-summary">
              {playerProgress && (
                <>
                  <span className="progress-count">
                    {playerProgress.unlockedCount} / {playerProgress.totalCount}
                  </span>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${playerProgress.completionPercentage}%` }}
                    />
                  </div>
                  <span className="progress-percent">
                    {playerProgress.completionPercentage}% Complete
                  </span>
                </>
              )}
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {playerProgress?.pendingRewards?.length > 0 && (
          <div className="pending-rewards">
            <div className="rewards-header">
              <span>💰 Pending Rewards: {playerProgress.pendingRewards.length}</span>
              <button className="claim-btn" onClick={claimRewards}>
                Claim All ({playerProgress.pendingRewards.reduce((sum, r) => sum + r.reward, 0)} sats)
              </button>
            </div>
          </div>
        )}

        <div className="achievements-grid">
          {achievements.map(achievement => {
            const isUnlocked = playerProgress?.unlockedAchievements?.some(a => a.id === achievement.id);
            const isNew = newUnlocked.some(a => a.id === achievement.id);
            
            return (
              <div 
                key={achievement.id}
                className={`achievement-card ${isUnlocked ? 'unlocked' : 'locked'} ${isNew ? 'newly-unlocked' : ''}`}
                style={{ '--rarity-color': getRarityColor(achievement.rarity) }}
                onClick={() => setSelectedAchievement(achievement)}
              >
                <div className="achievement-icon">
                  {achievement.icon}
                  {isNew && <div className="new-badge">NEW!</div>}
                </div>
                <div className="achievement-info">
                  <h4>{achievement.name}</h4>
                  <p>{achievement.description}</p>
                  <div className="achievement-reward">
                    {isUnlocked ? '✅' : '🔒'} {achievement.reward} sats
                  </div>
                  <div className={`rarity-badge ${achievement.rarity}`}>
                    {achievement.rarity.toUpperCase()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {selectedAchievement && (
          <div className="achievement-detail-overlay" onClick={() => setSelectedAchievement(null)}>
            <div className="achievement-detail" onClick={e => e.stopPropagation()}>
              <div className="detail-header">
                <span className="detail-icon">{selectedAchievement.icon}</span>
                <div>
                  <h3>{selectedAchievement.name}</h3>
                  <div className={`rarity-badge ${selectedAchievement.rarity}`}>
                    {selectedAchievement.rarity.toUpperCase()}
                  </div>
                </div>
              </div>
              <p className="detail-description">{selectedAchievement.description}</p>
              <div className="detail-reward">
                <span className="reward-amount">{selectedAchievement.reward} SATS</span>
                <span className="reward-label">Reward</span>
              </div>
              <button onClick={() => setSelectedAchievement(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementSystem;
