// Test script to verify image extraction works
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing image extraction logic...\n');

// Test 1: Base64 image data URI parsing
console.log('Test 1: Base64 data URI parsing');
const testDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const matches = testDataUri.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
if (matches && matches[2]) {
  const buffer = Buffer.from(matches[2], 'base64');
  console.log('✅ Successfully parsed data URI and created buffer');
  console.log(`   Buffer size: ${buffer.length} bytes`);
} else {
  console.log('❌ Failed to parse data URI');
}

// Test 2: Check if Devanagari font exists
console.log('\nTest 2: Devanagari font check');
const fontPath = path.join(__dirname, '../fonts/NotoSansDevanagari-Regular.ttf');
if (fs.existsSync(fontPath)) {
  const stats = fs.statSync(fontPath);
  console.log('✅ Devanagari font found');
  console.log(`   Size: ${(stats.size / 1024).toFixed(2)} KB`);
} else {
  console.log('⚠️  Devanagari font not found at:', fontPath);
}

// Test 3: Check database structure
console.log('\nTest 3: Database structure check');
const ScraperDB = require('../src/database/db');
const db = new ScraperDB();

const conversations = db.db.prepare('SELECT * FROM conversations LIMIT 1').all();
if (conversations.length > 0) {
  const conv = JSON.parse(conversations[0].conversation_json);
  console.log('✅ Found existing conversation');
  console.log(`   Root tweet has 'images' field: ${conv.conversation.root.hasOwnProperty('images')}`);
  if (conv.conversation.root.images) {
    console.log(`   Root tweet images count: ${conv.conversation.root.images.length}`);
  }
  
  if (conv.conversation.thread && conv.conversation.thread.length > 0) {
    console.log(`   Thread tweet has 'images' field: ${conv.conversation.thread[0].hasOwnProperty('images')}`);
  }
} else {
  console.log('ℹ️  No conversations in database yet');
}

db.close();

console.log('\n✅ All tests completed!');
console.log('\n📝 Next steps:');
console.log('   1. Run: npm start (to scrape new tweets with images)');
console.log('   2. Run: npm run export-pdf (to generate PDFs with embedded images)');
