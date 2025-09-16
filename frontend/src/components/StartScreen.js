import React from 'react';

const BET_OPTIONS = [
  { amount: 50, winnings: 80 },
  { amount: 300, winnings: 500 },
  { amount: 500, winnings: 800 },
  { amount: 1000, winnings: 1700 },
  { amount: 5000, winnings: 8000 },
  { amount: 10000, winnings: 17000 },
];

export default function StartScreen({ 
  lightningAddress, 
  setLightningAddress, 
  betAmount, 
  setBetAmount,
  acceptedTerms,
  setAcceptedTerms,
  onStart,
  connected,
  onOpenTerms,
  onOpenPrivacy,
  addressLocked = false,
  noticeMessage
}) {
  const payoutAmount = BET_OPTIONS.find(o => o.amount === parseInt(betAmount, 10))?.winnings || 0;
  const selectedBet = BET_OPTIONS.find(o => o.amount === parseInt(betAmount, 10));

  return (
    <div className="start-screen">
      <div className="panel neo-panel">
        {/* Hero header */}
        <div className="start-hero">
          <div className="start-header">
            <button 
              className="back-btn"
              onClick={() => window.history.back()}
              aria-label="Go back"
            >
              ← Back
            </button>
            <h2>⚡ Start Game</h2>
            <div className="win-highlight">
              Win <strong>{payoutAmount.toLocaleString()} SATS</strong>
            </div>
          </div>
          <p className="hero-sub">Pick your bet, pay once, get matched in seconds. Instant payouts if you win.</p>
          <div className="badge-row">
            <span className="badge ok"><span className="dot" /> Instant payouts</span>
            <span className="badge info"><span className="dot" /> Fair matchmaking</span>
            <span className="badge warn"><span className="dot" /> 5s turn timer</span>
          </div>
        </div>

        {/* Status Messages */}
        {noticeMessage && (
          <div className="notice-message">
            <p className="payment-msg" role="status" aria-live="polite">
              {noticeMessage}
            </p>
          </div>
        )}

        {/* Connection Status */}
        <div className="connection-status">
          <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            <div className="status-dot"></div>
            <span>{connected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        {/* Lightning Address Input */}
        <div className="form-section">
          <label htmlFor="ln-address">Lightning Address</label>
          <div className="input-group">
            <span className="input-prefix">⚡</span>
            <input 
              id="ln-address"
              type="text"
              value={lightningAddress} 
              onChange={e => setLightningAddress(e.target.value)} 
              placeholder="username@speed.app" 
              disabled={addressLocked}
              className="form-input"
            />
            {lightningAddress && !addressLocked && (
              <button 
                type="button" 
                className="input-clear" 
                onClick={() => setLightningAddress('')} 
                aria-label="Clear address"
              >
                ✕
              </button>
            )}
          </div>
          <small className="form-help">Enter your Speed username or full Lightning address</small>
        </div>

        {/* Bet Amount Selection */}
        <div className="form-section">
          <label className="section-label">Choose Bet Amount</label>
          <div className="bet-grid">
            {BET_OPTIONS.map(option => (
              <label key={option.amount} className={`bet-option ${String(option.amount) === String(betAmount) ? 'selected' : ''}`}>
                <input 
                  type="radio" 
                  name="bet" 
                  value={option.amount} 
                  checked={String(option.amount) === String(betAmount)} 
                  onChange={() => setBetAmount(String(option.amount))} 
                  className="bet-radio"
                />
                <div className="bet-content">
                  <div className="bet-amount">{option.amount.toLocaleString()}</div>
                  <div className="bet-unit">SATS</div>
                  <div className="bet-arrow">→</div>
                  <div className="bet-winnings">{option.winnings.toLocaleString()}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Payout strip */}
        <div className="payout-row" aria-live="polite">
          Bet <strong>{selectedBet?.amount.toLocaleString() || 0}</strong> → Win <strong>{selectedBet?.winnings.toLocaleString() || 0} SATS</strong>
        </div>

        {/* Terms & Conditions */}
        <div className="form-section">
          <label className="checkbox-label">
            <input 
              type="checkbox" 
              checked={acceptedTerms} 
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="checkbox-input"
            />
            <span className="checkmark"></span>
            <span className="checkbox-text">
              I agree to the{' '}
              <button type="button" className="link-button" onClick={onOpenTerms}>Terms & Conditions</button>{' '}
              and{' '}
              <button type="button" className="link-button" onClick={onOpenPrivacy}>Privacy Policy</button>
            </span>
          </label>
        </div>

        {/* Start Game Button */}
        <div className="form-actions">
          <button 
            className={`neo-btn cta-main primary ${(!connected || !acceptedTerms || !lightningAddress) ? 'disabled' : ''}`}
            onClick={onStart} 
            disabled={!connected || !acceptedTerms || !lightningAddress}
          >
            <span className="btn-icon">⚡</span>
            <span className="btn-text">
              {!connected ? 'Connecting...' : 'Start Game'}
            </span>
            <small>Bet {selectedBet?.amount.toLocaleString() || 0} SATS</small>
          </button>
        </div>

        {/* Sticky CTA on mobile */}
        <div className="start-sticky">
          <button
            className={`neo-btn cta-main primary ${(!connected || !acceptedTerms || !lightningAddress) ? 'disabled' : ''}`}
            onClick={onStart}
            disabled={!connected || !acceptedTerms || !lightningAddress}
            aria-label={!connected ? 'Connecting to server' : `Start game — Bet ${selectedBet?.amount || 0} SATS`}
          >
            ⚡ Start • {selectedBet?.amount.toLocaleString() || 0} → {selectedBet?.winnings.toLocaleString() || 0}
          </button>
        </div>
      </div>
    </div>
  );
}
