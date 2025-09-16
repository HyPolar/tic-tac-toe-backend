import React, { useState, useEffect } from 'react';
import './MysteryBoxes.css';

const MysteryBoxes = ({ isOpen, onClose, lightningAddress, socket }) => {
  const [mysteryBoxes, setMysteryBoxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openingBox, setOpeningBox] = useState(null);

  // Fetch mystery boxes when component opens
  useEffect(() => {
    if (isOpen && lightningAddress && socket) {
      setLoading(true);
      socket.emit('requestMysteryBoxes', { lightningAddress });
      
      const handleMysteryBoxes = (data) => {
        setMysteryBoxes(data.boxes || []);
        setLoading(false);
      };

      const handleBoxOpened = (data) => {
        // Remove opened box and show reward
        setMysteryBoxes(prev => prev.filter(box => box.id !== data.boxId));
        setOpeningBox(null);
        // The reward notification will be handled by the parent App component
      };

      socket.on('mysteryBoxesData', handleMysteryBoxes);
      socket.on('mysteryBoxOpened', handleBoxOpened);

      return () => {
        socket.off('mysteryBoxesData', handleMysteryBoxes);
        socket.off('mysteryBoxOpened', handleBoxOpened);
      };
    }
  }, [isOpen, lightningAddress, socket]);

  const handleOpenBox = (boxId) => {
    if (openingBox || !socket) return;
    setOpeningBox(boxId);
    socket.emit('openMysteryBox', { lightningAddress, boxId });
  };

  const getBoxIcon = (boxType) => {
    switch (boxType) {
      case 'BASIC': return '📦';
      case 'SILVER': return '🎁';
      case 'GOLD': return '✨';
      case 'LEGENDARY': return '🏆';
      default: return '📦';
    }
  };

  const getBoxColor = (boxType) => {
    switch (boxType) {
      case 'BASIC': return '#6b7280';
      case 'SILVER': return '#9ca3af';
      case 'GOLD': return '#f59e0b';
      case 'LEGENDARY': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="mystery-boxes-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mystery-boxes-header">
          <h2>🎁 Mystery Boxes</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="mystery-boxes-content">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading your mystery boxes...</p>
            </div>
          ) : mysteryBoxes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>No Mystery Boxes</h3>
              <p>Keep playing to earn mystery boxes with amazing rewards!</p>
              <div className="earning-tips">
                <h4>Earn boxes by:</h4>
                <ul>
                  <li>🏆 Winning games</li>
                  <li>🔥 Building win streaks</li>
                  <li>⚡ Playing daily</li>
                  <li>🎯 Completing achievements</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="mystery-boxes-grid">
              {mysteryBoxes.map((box) => (
                <div 
                  key={box.id} 
                  className={`mystery-box ${box.type.toLowerCase()} ${openingBox === box.id ? 'opening' : ''}`}
                  style={{ borderColor: getBoxColor(box.type) }}
                >
                  <div className="box-icon" style={{ color: getBoxColor(box.type) }}>
                    {getBoxIcon(box.type)}
                  </div>
                  <div className="box-info">
                    <h3>{box.type} Box</h3>
                    <p className="box-reason">{box.reason}</p>
                    <p className="box-date">
                      Earned: {new Date(box.earned_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    className="open-box-btn"
                    onClick={() => handleOpenBox(box.id)}
                    disabled={openingBox === box.id}
                    style={{ 
                      backgroundColor: getBoxColor(box.type),
                      opacity: openingBox === box.id ? 0.7 : 1 
                    }}
                  >
                    {openingBox === box.id ? (
                      <span className="opening-text">Opening...</span>
                    ) : (
                      'Open Box'
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mystery-box-info">
            <h3>💎 Box Types & Rewards</h3>
            <div className="box-types-grid">
              <div className="box-type-info basic">
                <span className="type-icon">📦</span>
                <div>
                  <h4>Basic Box</h4>
                  <p>5-25 sats, bonus rewards</p>
                </div>
              </div>
              <div className="box-type-info silver">
                <span className="type-icon">🎁</span>
                <div>
                  <h4>Silver Box</h4>
                  <p>25-75 sats, premium rewards</p>
                </div>
              </div>
              <div className="box-type-info gold">
                <span className="type-icon">✨</span>
                <div>
                  <h4>Gold Box</h4>
                  <p>75-200 sats, rare rewards</p>
                </div>
              </div>
              <div className="box-type-info legendary">
                <span className="type-icon">🏆</span>
                <div>
                  <h4>Legendary Box</h4>
                  <p>200-500+ sats, legendary rewards</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MysteryBoxes;
