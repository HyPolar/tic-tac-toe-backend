// Legal content for Terms & Conditions and Privacy Policy

export function getTermsHTML() {
  return `
<h2 style="color: var(--primary-neon); text-align: center; margin-bottom: 20px;">⚖️ TERMS & CONDITIONS</h2>
<div style="background: rgba(255, 0, 102, 0.1); border: 2px solid #ff0066; border-radius: 10px; padding: 15px; margin-bottom: 20px;">
<p style="color: #ff0066; font-weight: bold; text-align: center; font-size: 1.1rem;">
⚠️ BY PLAYING, YOU AGREE TO ALL TERMS ⚠️
</p></div>
<h3>1. Game Mechanics & Bots</h3>
<p>The matchmaking system searches for human opponents (0-25s). If none found, automated bots join (13-25s). Bots simulate real players and may have varying skill levels. You acknowledge bot usage as an integral game feature.</p>
<h3>2. Betting & Payments</h3>
<p>All bets in Satoshis are non-refundable once placed. Payments via Lightning Network. Payouts sent instantly to your Lightning address. You're responsible for correct address entry. Platform fees included in payouts.</p>
<h3>3. Turn Timers & Rules</h3>
<p>First turn: 8 seconds. All other turns: 5 seconds. Failure to move = auto-forfeit. Draws = no payout, bets forfeited. Disconnection may result in forfeit.</p>
<h3>4. Eligibility</h3>
<p>Must be 18+ years old. Responsible for legal compliance in your jurisdiction. Maintain wallet security.</p>
<h3>5. LIMITATION OF LIABILITY</h3>
<p style="text-transform: uppercase; font-weight: bold;">THE GAME IS PROVIDED "AS IS" WITHOUT WARRANTIES. WE ARE NOT LIABLE FOR ANY LOSSES, DAMAGES, OR CRYPTOCURRENCY LOSSES. NO REFUNDS EXCEPT AT OUR SOLE DISCRETION.</p>
<h3>6. Indemnification</h3>
<p>You indemnify us from all claims, damages, losses arising from your use of the Game or Terms violations.</p>
<h3>7. Modifications</h3>
<p>We may modify Terms anytime without notice. Continued use = acceptance. We may terminate your access anytime without liability.</p>
<div style="background: rgba(255, 0, 102, 0.1); border: 2px solid #ff0066; border-radius: 10px; padding: 15px; margin-top: 20px;">
<p style="color: #ff0066; font-weight: bold; text-align: center;">⚠️ YOU CANNOT SUE US FOR ANY LOSSES OR DAMAGES ⚠️</p></div>`;
}

export function getPrivacyHTML() {
  return `
<h2 style="color: var(--primary-neon); text-align: center; margin-bottom: 20px;">🔒 PRIVACY POLICY</h2>
<h3>1. Information Collection</h3>
<p>We collect: Lightning addresses, game activity, transaction data, IP addresses, device info, and authentication tokens (temporarily).</p>
<h3>2. How We Use Data</h3>
<p>For game operation, payment processing, fraud prevention, analytics, and legal compliance.</p>
<h3>3. Data Sharing</h3>
<p>Shared with payment providers (Speed Wallet), service providers, and as legally required. We don't sell your data.</p>
<h3>4. Data Security</h3>
<p>We use reasonable security measures but cannot guarantee 100% security. You're responsible for wallet security.</p>
<h3>5. Your Rights</h3>
<p>You can request access, correction, or deletion of your data. Some data retained for legal/business purposes.</p>
<h3>6. Automated Systems</h3>
<p>We use automated algorithms for matchmaking, bot matching, outcome determination, and fraud detection.</p>
<div style="background: rgba(0, 255, 204, 0.1); border: 2px solid #00ffcc; border-radius: 10px; padding: 15px; margin-top: 20px;">
<p style="color: #00ffcc; font-weight: bold; text-align: center;">By using the Game, you accept this Privacy Policy.</p></div>`;
}

export function getHowToPlayHTML() {
  return {
    page1: `
<h2 style="color: #ff0066; text-align: center; margin-bottom: 30px; font-size: 2rem;">😂 YOU DON'T KNOW TIC-TAC-TOE?!</h2>
<div style="background: rgba(255, 0, 102, 0.1); border: 2px solid #ff0066; border-radius: 15px; padding: 25px; margin-bottom: 25px; text-align: center;">
<p style="font-size: 1.3rem; margin-bottom: 15px;">Are you serious right now? 🤨</p>
<p style="font-size: 1rem; color: #888; line-height: 1.6;">This is THE game that literally EVERY human learns before they learn their ABCs! The game grandmas play! The game from ancient Egypt!</p>
<p style="font-size: 1.2rem; color: #ff0066; margin-top: 15px; font-weight: bold;">But hey... we won't judge... much. 😏</p>
</div>
<div style="background: #0a0a0f; border-radius: 15px; padding: 25px; margin-bottom: 25px;">
<h3 style="color: #00ffcc; margin-bottom: 15px; text-align: center;">⚡ THE "EMBARRASSINGLY SIMPLE" VERSION:</h3>
<p style="font-size: 1.1rem; line-height: 1.8; text-align: center; margin-bottom: 15px;">THREE. IN. A. ROW. That's it!</p>
<p style="font-size: 0.95rem; color: #888; text-align: center;">You get X or O. Put 3 in a line - horizontal, vertical, or diagonal. First to get 3 wins. Done. 🎤</p>
</div>
<div style="background: rgba(0, 255, 204, 0.1); border: 2px solid #00ffcc; border-radius: 15px; padding: 25px;">
<h3 style="color: #ffff00; margin-bottom: 15px; text-align: center; font-size: 1.3rem;">🤑 BUT HERE'S THE TWIST:</h3>
<p style="font-size: 1.1rem; text-align: center; margin-bottom: 10px;">This isn't your grandma's game...</p>
<p style="color: #00ffcc; font-size: 1.2rem; text-align: center; font-weight: bold;">YOU'RE PLAYING FOR REAL BITCOIN! ⚡💰</p>
<p style="font-size: 0.9rem; color: #888; text-align: center; margin-top: 15px;">Maybe click "Next" to learn how payments work? Unless you enjoy donating Bitcoin! 🤷</p>
</div>`,
    
    page2: `
<h2 style="color: #00ffcc; text-align: center; margin-bottom: 25px;">📋 GAME MECHANICS</h2>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">1. Choose Your Bet</h4>
<p style="color: #888;">Select 50-10,000 sats. Higher bets = bigger payouts!</p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">2. Connect Lightning Wallet</h4>
<p style="color: #888;">Enter Speed Wallet username (becomes username@speed.app). Winnings sent instantly here!</p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">3. Matchmaking</h4>
<p style="color: #888;">System searches 0-25s for humans. If none found, bot joins at 13-25s. Estimated wait: 13-25 seconds.</p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">4. Turn Timers</h4>
<p style="color: #888;"><strong>FIRST TURN:</strong> 8 seconds | <strong>OTHER TURNS:</strong> 5 seconds<br><span style="color: #ff0066;">⚠️ No move = auto-forfeit!</span></p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">5. Draw Rules</h4>
<p style="color: #888;">If draw: opponent who went first last time goes first next game (5s timer). Draws = no payout, bets forfeited.</p>
</div>`,
    
    page3: `
<h2 style="color: #00ffcc; text-align: center; margin-bottom: 25px;">💰 PAYMENTS & PAYOUTS</h2>
<div style="background: rgba(0, 255, 204, 0.1); border: 2px solid #00ffcc; border-radius: 15px; padding: 20px; margin-bottom: 20px;">
<h3 style="color: #00ffcc; margin-bottom: 12px; text-align: center;">⚡ Lightning Network Integration</h3>
<p style="line-height: 1.8; margin-bottom: 12px;">All payments are processed automatically through Speed Wallet and the Bitcoin Lightning Network:</p>
<ul style="color: #888; margin-top: 12px; line-height: 1.8; list-style-position: inside;">
<li>✅ <strong>Instant transactions</strong> - No waiting, no delays</li>
<li>✅ <strong>Ultra-low fees</strong> - Lightning Network efficiency</li>
<li>✅ <strong>Global access</strong> - Play from anywhere</li>
<li>✅ <strong>Real Bitcoin</strong> - Actual SATS, not tokens</li>
<li>✅ <strong>Auto-fetch address</strong> - Speed Wallet integration</li>
</ul>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">💸 How Betting Works</h4>
<p style="color: #888; margin-bottom: 10px; line-height: 1.8;">1. Choose your bet amount (50-10,000 sats)<br>2. Click "Find Opponent"<br>3. Speed Wallet automatically creates a Lightning invoice<br>4. Pay the invoice through Speed Wallet<br>5. Payment is verified automatically<br>6. Game starts when opponent is found!</p>
<p style="color: #ff0066; margin-top: 12px; font-weight: bold;">⚠️ <strong>Bets are NON-REFUNDABLE</strong> once the game starts! All payments are final.</p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">💰 Receiving Winnings (AUTOMATIC)</h4>
<p style="color: #888; margin-bottom: 10px; line-height: 1.8;">When you win a game:</p>
<ol style="color: #888; margin-left: 20px; line-height: 1.8;">
<li>Payout is <strong>automatically calculated</strong> (total pot minus 5% platform fee)</li>
<li>Payment is <strong>sent INSTANTLY</strong> to your Lightning address</li>
<li>Funds appear in your Speed Wallet <strong>within seconds</strong></li>
<li>No manual withdrawal needed - it's all automatic!</li>
</ol>
<p style="background: rgba(0, 255, 204, 0.1); padding: 12px; border-radius: 8px; border-left: 4px solid #00ffcc; color: #00ffcc; margin-top: 15px; font-weight: bold;">💡 <strong>PRO TIP:</strong> Your Lightning address is auto-fetched from Speed Wallet, so there's no risk of entering the wrong address!</p>
</div>
<div style="background: #0a0a0f; border-radius: 10px; padding: 20px; margin-bottom: 15px; border-left: 4px solid #00ffcc;">
<h4 style="color: #00ffcc; margin-bottom: 10px;">📊 Payout Structure</h4>
<p style="color: #888; margin-bottom: 10px;">Payouts are calculated as follows:</p>
<ul style="color: #888; margin-left: 20px; line-height: 1.8;">
<li><strong>50 sats bet:</strong> Winner gets 80 sats (60% profit)</li>
<li><strong>300 sats bet:</strong> Winner gets 500 sats (67% profit)</li>
<li><strong>500 sats bet:</strong> Winner gets 800 sats (60% profit)</li>
<li><strong>1000 sats bet:</strong> Winner gets 1700 sats (70% profit)</li>
<li><strong>5000 sats bet:</strong> Winner gets 8000 sats (60% profit)</li>
<li><strong>10000 sats bet:</strong> Winner gets 17000 sats (70% profit)</li>
</ul>
<p style="color: #888; margin-top: 12px; font-size: 0.9rem;">Platform fee (5%) is automatically deducted from the total pot.</p>
</div>
<div style="background: rgba(255, 0, 102, 0.1); border: 2px solid #ff0066; border-radius: 10px; padding: 15px; margin-top: 20px;">
<p style="color: #ff0066; font-weight: bold; text-align: center; font-size: 1.1rem;">⚠️ NEVER SHARE YOUR AUTH TOKEN OR PRIVATE KEYS WITH ANYONE!</p>
<p style="color: #ff0066; text-align: center; margin-top: 10px; font-size: 0.9rem;">Speed Wallet handles all security - you don't need to share anything!</p>
</div>`
  };
}
