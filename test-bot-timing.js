#!/usr/bin/env node

/**
 * Bot Spawn Timing Test
 * 
 * This script tests the bot spawn delay function to ensure bots
 * always spawn between 13-25 seconds as specified.
 */

const { getRandomBotSpawnDelay } = require('./backend/botLogic');

console.log('🤖 Testing Bot Spawn Timing...\n');

// Test the function 100 times to verify timing
const testRuns = 100;
const delays = [];
let minDelay = Infinity;
let maxDelay = 0;
let totalDelay = 0;

for (let i = 0; i < testRuns; i++) {
  const delay = getRandomBotSpawnDelay();
  const seconds = delay / 1000;
  
  delays.push(seconds);
  minDelay = Math.min(minDelay, seconds);
  maxDelay = Math.max(maxDelay, seconds);
  totalDelay += seconds;
}

const averageDelay = totalDelay / testRuns;

// Check if all delays are within the 13-25 second range
const allValid = delays.every(delay => delay >= 13 && delay < 25);

console.log('📊 Bot Spawn Timing Test Results:');
console.log('================================');
console.log(`Test Runs: ${testRuns}`);
console.log(`Minimum Delay: ${minDelay.toFixed(2)} seconds`);
console.log(`Maximum Delay: ${maxDelay.toFixed(2)} seconds`);
console.log(`Average Delay: ${averageDelay.toFixed(2)} seconds`);
console.log(`Expected Range: 13.00 - 24.99 seconds`);

if (allValid && minDelay >= 13 && maxDelay < 25) {
  console.log('\n✅ PASS: All bot spawn delays are within the correct range!');
  console.log('✅ Bots will NOT join instantly');
  console.log('✅ Bots will join between 13-25 seconds randomly');
} else {
  console.log('\n❌ FAIL: Some delays are outside the expected range!');
  console.log('❌ Bot timing needs to be fixed');
  
  // Show any problematic delays
  const invalidDelays = delays.filter(delay => delay < 13 || delay >= 25);
  if (invalidDelays.length > 0) {
    console.log(`\nInvalid delays found: ${invalidDelays.map(d => d.toFixed(2)).join(', ')} seconds`);
  }
}

// Show distribution
const buckets = {
  '13-15s': 0,
  '15-17s': 0,
  '17-19s': 0,
  '19-21s': 0,
  '21-23s': 0,
  '23-25s': 0
};

delays.forEach(delay => {
  if (delay >= 13 && delay < 15) buckets['13-15s']++;
  else if (delay >= 15 && delay < 17) buckets['15-17s']++;
  else if (delay >= 17 && delay < 19) buckets['17-19s']++;
  else if (delay >= 19 && delay < 21) buckets['19-21s']++;
  else if (delay >= 21 && delay < 23) buckets['21-23s']++;
  else if (delay >= 23 && delay < 25) buckets['23-25s']++;
});

console.log('\n📈 Distribution:');
Object.entries(buckets).forEach(([range, count]) => {
  const percentage = (count / testRuns * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(count / testRuns * 20));
  console.log(`${range}: ${count} (${percentage}%) ${bar}`);
});

console.log('\n🎯 Summary:');
console.log('- Bots spawn randomly between 13-25 seconds');
console.log('- No instant joins - players must wait');
console.log('- Provides enough time for human opponents to join');
console.log('- Creates anticipation and prevents immediate bot matches');

process.exit(allValid ? 0 : 1);
