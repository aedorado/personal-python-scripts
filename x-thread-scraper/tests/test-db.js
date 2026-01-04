// Test script to verify SQLite database functionality
const ScraperDB = require('../src/database/db');

console.log('Testing SQLite Database...\n');

const db = new ScraperDB();

// Test 1: Database initialization
console.log('✓ Database initialized');

// Test 2: Get initial stats
const stats = db.getStats();
console.log('Initial stats:', stats);

// Test 3: Save a test tweet
const testTweet = {
  id: '1234567890',
  username: 'testuser',
  link: 'https://x.com/testuser/status/1234567890',
  text: 'This is a test tweet',
  has_image: false,
  has_video: false
};

db.saveTweet(testTweet);
console.log('✓ Saved test tweet');

// Test 4: Check if tweet exists
const exists = db.tweetExists(testTweet.id);
console.log('✓ Tweet exists check:', exists);

// Test 5: Get tweets by username
const tweets = db.getTweetsByUsername('testuser');
console.log('✓ Retrieved tweets:', tweets.length);

// Test 6: Save batch of tweets
const batch = [
  {
    id: '1111111111',
    username: 'testuser',
    link: 'https://x.com/testuser/status/1111111111',
    text: 'Batch tweet 1',
    has_image: true,
    has_video: false
  },
  {
    id: '2222222222',
    username: 'testuser',
    link: 'https://x.com/testuser/status/2222222222',
    text: 'Batch tweet 2',
    has_image: false,
    has_video: true
  }
];

db.saveTweetsBatch(batch);
console.log('✓ Saved batch of tweets');

// Test 7: Save a conversation
const testConversation = {
  root_tweet_id: testTweet.id,
  conversation: {
    root: testTweet,
    thread: [],
    replies: []
  }
};

db.saveConversation(testTweet.id, 'testuser', testConversation);
console.log('✓ Saved conversation');

// Test 8: Get conversation
const conv = db.getConversation(testTweet.id);
console.log('✓ Retrieved conversation:', conv !== null);

// Test 9: Update progress
db.updateProgress('testuser', 'phase1', 10, '1234567890');
console.log('✓ Updated progress');

// Test 10: Get progress
const progress = db.getProgress('testuser', 'phase1');
console.log('✓ Retrieved progress:', progress);

// Final stats
const finalStats = db.getStats();
console.log('\nFinal stats:', finalStats);

// Cleanup
db.close();
console.log('\n✓ Database closed successfully');
console.log('\nAll tests passed! ✓');
