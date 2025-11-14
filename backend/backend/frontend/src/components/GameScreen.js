import React from 'react';

export default function GameScreen({ 
  board, 
  symbol, 
  turn, 
  socketId,
  lastMove,
  winningLine,
  message,
  gameState,
  onCellClick,
  onResign,
  onReturnToMenu,
  onShareResult,
  tiltEnabled,
  boardRef,
  onBoardPointerMove,
  onBoardPointerLeave,
  timeLeft,
  turnDuration,
  turnProgress
}) {
  const isPlaying = gameState === 'playing';
  const isFinished = gameState === 'finished';
  const isMyTurn = turn === socketId;

  // Inline timer ring SVG (duplicated from App-level helper)
  const TimerRing = ({ progress, size = 54 }) => {
    const stroke = 6;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, progress ?? 0));
    const dash = c * clamped;
    return (
      <svg className="timer-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(148,163,184,0.25)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="url(#ringGrad)" strokeWidth={stroke} fill="none" strokeDasharray={`${c}`} strokeDashoffset={`${c - dash}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} />
      </svg>
    );
  };

  return (
    <div className="game-screen">
      <div className="panel neo-panel glass">
        <div className="game-header">
          <h2>Tic-Tac-Toe</h2>
        </div>

        <div className="hud">
          <div className="hud-left">
            <span className="player-symbol">You: {symbol || '-'}</span>
          </div>
          <div className="hud-center">
            <span className="message-line">{message}</span>
          </div>
          <div className="hud-right">
            {isPlaying && typeof timeLeft === 'number' && typeof turnDuration === 'number' ? (
              <div className="turn-timer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <TimerRing progress={turnProgress} size={48} />
                <span className="countdown" aria-live="polite">{timeLeft}s</span>
              </div>
            ) : null}
          </div>
        </div>

        <div 
          ref={boardRef}
          className={`board neo-board ${tiltEnabled ? 'tilt' : ''}`}
          onPointerMove={onBoardPointerMove}
          onPointerLeave={onBoardPointerLeave}
        >
          {board.map((cell, idx) => {
            const isWinningCell = Array.isArray(winningLine) && winningLine.includes(idx);
            const isLastMove = lastMove === idx;
            const cellClass = `cell${cell === 'X' ? ' x' : cell === 'O' ? ' o' : ''}${isWinningCell ? ' win' : ''}${isLastMove ? ' last' : ''}`;
            const disabled = !isPlaying || !isMyTurn || board[idx] !== null;
            
            return (
              <button 
                key={idx} 
                className={cellClass} 
                onClick={() => onCellClick(idx)} 
                disabled={disabled}
                aria-label={`Cell ${idx + 1}`}
              >
                {cell || ''}
              </button>
            );
          })}
        </div>

        <div className="game-actions">
          {isPlaying ? (
            <>
              <button className="neo-btn outline" onClick={onResign}>
                Resign
              </button>
              <button className="neo-btn" onClick={onReturnToMenu}>
                Return to Menu
              </button>
            </>
          ) : isFinished ? (
            <>
              <button className="neo-btn outline" onClick={onShareResult}>
                Share Result
              </button>
              <button className="neo-btn primary" onClick={onReturnToMenu}>
                New Game
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
