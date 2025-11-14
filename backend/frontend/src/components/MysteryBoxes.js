import React, { useState, useEffect } from 'react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

export default function MysteryBoxes({ lightningAddress, onClose }) {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingBox, setOpeningBox] = useState(null);
  const [lastReward, setLastReward] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (lightningAddress) {
      fetchBoxes();
      fetchStats();
    }
  }, [lightningAddress]);

  const fetchBoxes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/mystery-boxes/${lightningAddress}`);
      const data = await response.json();
      setBoxes(data.boxes || []);
    } catch (error) {
      console.error('Failed to fetch mystery boxes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/mystery-boxes/stats/${lightningAddress}`);
      const data = await response.json();
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch mystery box stats:', error);
    }
  };

  const openBox = async (boxId) => {
    try {
      setOpeningBox(boxId);
      const response = await fetch(`${BACKEND_URL}/api/mystery-boxes/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lightningAddress, boxId })
      });
      const data = await response.json();
      
      if (data.success) {
        setLastReward(data.reward);
        await fetchBoxes();
        await fetchStats();
      }
    } catch (error) {
      console.error('Failed to open mystery box:', error);
    } finally {
      setOpeningBox(null);
    }
  };

  const getDailyBox = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/mystery-boxes/daily/${lightningAddress}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchBoxes();
      }
    } catch (error) {
      console.error('Failed to get daily mystery box:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBoxIcon = (type) => {
    switch (type) {
      case 'LEGENDARY': return '⭐';
      case 'EPIC': return '💎';
      case 'GOLD': return '🏆';
      case 'SILVER': return '🥈';
      case 'BRONZE': return '🥉';
      default: return '📦';
    }
  };

  const getBoxColor = (type) => {
    switch (type) {
      case 'LEGENDARY': return '#FF4500';
      case 'EPIC': return '#9932CC';
      case 'GOLD': return '#FFD700';
      case 'SILVER': return '#C0C0C0';
      case 'BRONZE': return '#CD7F32';
      default: return '#666';
    }
  };

  const getBoxGradient = (type) => {
    switch (type) {
      case 'LEGENDARY': return 'linear-gradient(45deg, #FF4500, #FF6347, #FFD700)';
      case 'EPIC': return 'linear-gradient(45deg, #9932CC, #BA55D3, #DDA0DD)';
      case 'GOLD': return 'linear-gradient(45deg, #FFD700, #FFA500)';
      case 'SILVER': return 'linear-gradient(45deg, #C0C0C0, #D3D3D3)';
      case 'BRONZE': return 'linear-gradient(45deg, #CD7F32, #D2691E)';
      default: return 'linear-gradient(45deg, #666, #999)';
    }
  };

  const getBoxRarity = (type) => {
    switch (type) {
      case 'LEGENDARY': return 'Ultra Rare (1%)';
      case 'EPIC': return 'Epic (4%)';
      case 'GOLD': return 'Rare (15%)';
      case 'SILVER': return 'Uncommon (35%)';
      case 'BRONZE': return 'Common (45%)';
      default: return 'Unknown';
    }
  };

  const getRewardRange = (type) => {
    const ranges = {
      'LEGENDARY': '500-1000 SATS',
      'EPIC': '200-400 SATS',
      'GOLD': '75-150 SATS',
      'SILVER': '20-50 SATS',
      'BRONZE': '5-15 SATS'
    };
    return ranges[type] || 'Unknown';
  };

  const unopenedBoxes = boxes.filter(box => !box.opened).sort((a, b) => {
    const rarity = { 'LEGENDARY': 5, 'EPIC': 4, 'GOLD': 3, 'SILVER': 2, 'BRONZE': 1 };
    return (rarity[b.type] || 0) - (rarity[a.type] || 0);
  });
  const openedBoxes = boxes.filter(box => box.opened).sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt));

  return (
    <div className="mystery-boxes-modal">
      <div className="mystery-boxes-content">
        <div className="mystery-boxes-header">
          <h2>🎁 Mystery Boxes</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {lastReward && (
          <div className="reward-notification">
            <h3>🎉 Congratulations!</h3>
            <p>You earned <span className="sats">{lastReward} SATS</span>!</p>
            <button onClick={() => setLastReward(null)}>Awesome!</button>
          </div>
        )}

        {stats && (
          <>
            <div className="mystery-stats">
              <div className="stat-item highlight">
                <span>💰 Total Earned:</span>
                <span className="stat-value">{stats.totalEarned} SATS</span>
              </div>
              <div className="stat-item">
                <span>📦 Boxes Opened:</span>
                <span className="stat-value">{stats.totalOpened}/{stats.totalBoxes}</span>
              </div>
              <div className="stat-item">
                <span>🏆 Best Reward:</span>
                <span className="stat-value">{stats.bestReward} SATS</span>
              </div>
              <div className="stat-item">
                <span>🔥 Current Streak:</span>
                <span className="stat-value">{stats.currentStreak}</span>
              </div>
            </div>
            
            {stats.boxesByType && (
              <div className="box-breakdown">
                <h4>📊 Collection Progress</h4>
                <div className="breakdown-grid">
                  {Object.entries(stats.boxesByType).map(([type, typeStats]) => (
                    <div key={type} className="breakdown-item">
                      <div className="breakdown-header" style={{ background: getBoxGradient(type) }}>
                        <span className="breakdown-icon">{getBoxIcon(type)}</span>
                        <span className="breakdown-type">{type}</span>
                      </div>
                      <div className="breakdown-stats">
                        <div>Opened: {typeStats.opened}/{typeStats.total}</div>
                        <div>Earned: {typeStats.earned} SATS</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="daily-box-section">
          <button className="daily-box-btn" onClick={getDailyBox} disabled={loading}>
            🎁 Get Daily Mystery Box
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading boxes...</div>
        ) : (
          <>
            {unopenedBoxes.length > 0 && (
              <div className="boxes-section">
                <h3>Unopened Boxes ({unopenedBoxes.length})</h3>
                <div className="boxes-grid">
                  {unopenedBoxes.map(box => (
                    <div 
                      key={box.id} 
                      className={`mystery-box ${box.type.toLowerCase()} mystery-box-animated`}
                      style={{ 
                        borderColor: getBoxColor(box.type),
                        background: getBoxGradient(box.type),
                        boxShadow: `0 0 20px ${getBoxColor(box.type)}33`
                      }}
                    >
                      <div className="box-rarity">{getBoxRarity(box.type)}</div>
                      <div className="box-icon-container">
                        <div className="box-icon" style={{ color: '#fff', textShadow: '0 0 10px currentColor' }}>
                          {getBoxIcon(box.type)}
                        </div>
                        <div className="box-shine"></div>
                      </div>
                      <div className="box-type">{box.type} Box</div>
                      <div className="box-reason">{box.reason.replace('_', ' ').toUpperCase()}</div>
                      <div className="box-rewards">Reward: {getRewardRange(box.type)}</div>
                      <button 
                        className={`open-box-btn ${box.type.toLowerCase()}-btn`}
                        onClick={() => openBox(box.id)}
                        disabled={openingBox === box.id}
                        style={{ background: getBoxGradient(box.type) }}
                      >
                        {openingBox === box.id ? (
                          <>
                            <span className="spinner"></span>
                            Opening...
                          </>
                        ) : (
                          <>🎁 Open Box</>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {openedBoxes.length > 0 && (
              <div className="boxes-section">
                <h3>🏆 Recently Opened ({openedBoxes.length})</h3>
                <div className="opened-boxes">
                  {openedBoxes.slice(0, 8).map(box => (
                    <div 
                      key={box.id} 
                      className="opened-box"
                      style={{ borderLeft: `4px solid ${getBoxColor(box.type)}` }}
                    >
                      <div className="opened-box-header">
                        <span className="box-icon">{getBoxIcon(box.type)}</span>
                        <span className="box-type">{box.type}</span>
                        <span className="opened-date">
                          {new Date(box.openedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="opened-box-reward">
                        <span className="box-reward">+{box.reward} SATS</span>
                        <span className="box-from">{box.reason.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {openedBoxes.length > 8 && (
                  <div className="show-more-hint">
                    Showing 8 of {openedBoxes.length} opened boxes
                  </div>
                )}
              </div>
            )}

            {boxes.length === 0 && (
              <div className="no-boxes">
                <div className="empty-state">
                  <div className="empty-icon">📦</div>
                  <h3>No Mystery Boxes Yet!</h3>
                  <p>Start playing games to earn amazing mystery boxes!</p>
                  <div className="box-info">
                    <div className="info-item">
                      <span>🥉 Bronze:</span> <span>5-15 SATS</span>
                    </div>
                    <div className="info-item">
                      <span>🥈 Silver:</span> <span>20-50 SATS</span>
                    </div>
                    <div className="info-item">
                      <span>🏆 Gold:</span> <span>75-150 SATS</span>
                    </div>
                    <div className="info-item">
                      <span>💎 Epic:</span> <span>200-400 SATS</span>
                    </div>
                    <div className="info-item">
                      <span>⭐ Legendary:</span> <span>500-1000 SATS</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
