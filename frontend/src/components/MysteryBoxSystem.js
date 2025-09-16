import React, { useState, useEffect } from 'react';
import './MysteryBoxSystem.css';

const MysteryBoxSystem = ({ lightningAddress, socket, isOpen, onClose }) => {
  const [boxes, setBoxes] = useState({ unopened: [], history: [] });
  const [selectedBox, setSelectedBox] = useState(null);
  const [openingBox, setOpeningBox] = useState(null);
  const [openedRewards, setOpenedRewards] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [canClaimDaily, setCanClaimDaily] = useState(false);

  useEffect(() => {
    if (isOpen && lightningAddress) {
      fetchBoxes();
      fetchStats();
      checkDailyBox();
    }
  }, [isOpen, lightningAddress]);

  useEffect(() => {
    if (socket) {
      socket.on('mysteryBoxEarned', handleNewBox);
      return () => socket.off('mysteryBoxEarned', handleNewBox);
    }
  }, [socket]);

  const fetchBoxes = async () => {
    try {
      const response = await fetch(`/api/mystery-boxes/${encodeURIComponent(lightningAddress)}`);
      const data = await response.json();
      setBoxes(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch mystery boxes:', error);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/mystery-boxes/stats/${encodeURIComponent(lightningAddress)}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch box stats:', error);
    }
  };

  const checkDailyBox = async () => {
    const lastClaimed = localStorage.getItem(`dailyBox_${lightningAddress}`);
    const today = new Date().toDateString();
    setCanClaimDaily(!lastClaimed || lastClaimed !== today);
  };

  const handleNewBox = (data) => {
    // Add celebration animation for new boxes
    fetchBoxes();
  };

  const openBox = async (box) => {
    setOpeningBox(box);
    try {
      const response = await fetch('/api/mystery-boxes/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lightningAddress,
          boxId: box.id
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOpenedRewards(result.rewards);
        fetchBoxes();
        fetchStats();
        
        // Show rewards animation
        setTimeout(() => {
          setOpenedRewards(null);
          setOpeningBox(null);
        }, 4000);
      }
    } catch (error) {
      console.error('Failed to open mystery box:', error);
      setOpeningBox(null);
    }
  };

  const claimDailyBox = async () => {
    try {
      const response = await fetch(`/api/mystery-boxes/daily/${encodeURIComponent(lightningAddress)}`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        localStorage.setItem(`dailyBox_${lightningAddress}`, new Date().toDateString());
        setCanClaimDaily(false);
        fetchBoxes();
      }
    } catch (error) {
      console.error('Failed to claim daily box:', error);
    }
  };

  const getBoxIcon = (type) => {
    const icons = {
      BASIC: '📦',
      SILVER: '🥈',
      GOLD: '🥇',
      LEGENDARY: '💎',
      BITCOIN: '₿'
    };
    return icons[type] || '📦';
  };

  const getBoxGlow = (type) => {
    const glows = {
      BASIC: '#10b981',
      SILVER: '#6b7280',
      GOLD: '#f59e0b',
      LEGENDARY: '#8b5cf6',
      BITCOIN: '#f97316'
    };
    return glows[type] || '#10b981';
  };

  if (!isOpen) return null;

  return (
    <div className="mystery-box-overlay">
      <div className="mystery-box-modal">
        <div className="mystery-header">
          <div className="header-content">
            <h2>🎁 Mystery Boxes</h2>
            {stats && (
              <div className="box-stats">
                <span>📦 Opened: {stats.totalBoxesOpened}</span>
                <span>💰 Earned: {stats.totalSatsEarned} sats</span>
                <span>⚡ Power-ups: {stats.powerUpsEarned}</span>
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {canClaimDaily && (
          <div className="daily-box-claim">
            <div className="daily-content">
              <span className="daily-icon">🎁</span>
              <div className="daily-info">
                <h3>Daily Mystery Box Available!</h3>
                <p>Claim your free daily mystery box</p>
              </div>
              <button className="claim-daily-btn" onClick={claimDailyBox}>
                Claim Free Box
              </button>
            </div>
          </div>
        )}

        <div className="boxes-section">
          <div className="section-header">
            <h3>🔓 Available Boxes ({boxes.unopened.length})</h3>
          </div>
          
          {boxes.unopened.length === 0 ? (
            <div className="no-boxes">
              <span className="empty-icon">📭</span>
              <p>No mystery boxes available</p>
              <p className="hint">Play games to earn mystery boxes!</p>
            </div>
          ) : (
            <div className="boxes-grid">
              {boxes.unopened.map(box => (
                <div 
                  key={box.id}
                  className="mystery-box-item"
                  style={{ '--glow-color': getBoxGlow(box.type) }}
                  onClick={() => openBox(box)}
                >
                  <div className="box-icon">
                    {getBoxIcon(box.type)}
                  </div>
                  <h4>{box.name}</h4>
                  <p>{box.description}</p>
                  <div className={`rarity-badge ${box.rarity}`}>
                    {box.rarity.toUpperCase()}
                  </div>
                  <div className="earned-reason">
                    Earned from: {box.reason.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {boxes.history.length > 0 && (
          <div className="boxes-section">
            <div className="section-header">
              <h3>📜 Recently Opened</h3>
            </div>
            <div className="history-grid">
              {boxes.history.slice(0, 6).map(box => (
                <div key={box.id} className="history-item">
                  <span className="history-icon">{getBoxIcon(box.type)}</span>
                  <div className="history-info">
                    <span className="history-name">{box.name}</span>
                    <div className="history-rewards">
                      {box.rewards?.map((reward, index) => (
                        <span key={index} className="reward-item">
                          {reward.type === 'sats' && `💰 ${reward.amount} sats`}
                          {reward.type === 'powerUps' && `⚡ ${reward.powerUps?.length || 0} power-ups`}
                          {reward.type === 'multiplier' && `🔥 ${reward.value}x multiplier`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {openingBox && (
        <div className="box-opening-overlay">
          <div className="opening-animation">
            <div className="opening-box" style={{ '--glow-color': getBoxGlow(openingBox.type) }}>
              <div className="box-shake">
                {getBoxIcon(openingBox.type)}
              </div>
            </div>
            <h3>Opening {openingBox.name}...</h3>
          </div>
        </div>
      )}

      {openedRewards && (
        <div className="rewards-celebration">
          <div className="celebration-content">
            <h2>🎉 Rewards Unlocked!</h2>
            <div className="rewards-list">
              {openedRewards.map((reward, index) => (
                <div key={index} className="reward-celebration">
                  {reward.type === 'sats' && (
                    <div className="reward-item">
                      <span className="reward-icon">💰</span>
                      <span className="reward-text">{reward.amount} SATS</span>
                    </div>
                  )}
                  {reward.type === 'powerUps' && reward.powerUps?.map((powerUp, pIndex) => (
                    <div key={pIndex} className="reward-item">
                      <span className="reward-icon">⚡</span>
                      <span className="reward-text">{powerUp.name}</span>
                    </div>
                  ))}
                  {reward.type === 'multiplier' && (
                    <div className="reward-item">
                      <span className="reward-icon">🔥</span>
                      <span className="reward-text">{reward.value}x Multiplier ({reward.duration} games)</span>
                    </div>
                  )}
                  {reward.type === 'streakProtection' && (
                    <div className="reward-item">
                      <span className="reward-icon">🛡️</span>
                      <span className="reward-text">Streak Protection ({reward.duration} games)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MysteryBoxSystem;
