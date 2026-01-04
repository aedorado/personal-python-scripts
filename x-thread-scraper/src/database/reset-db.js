const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_PATH = path.join(__dirname, '../../database/scraper.db');
const DB_WAL_PATH = path.join(__dirname, '../../database/scraper.db-wal');
const DB_SHM_PATH = path.join(__dirname, '../../database/scraper.db-shm');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function resetDatabase() {
  console.log('\n⚠️  DATABASE RESET UTILITY\n');
  console.log('This will DELETE all scraped data:');
  console.log('  - All tweets');
  console.log('  - All conversations');
  console.log('  - All scrape progress');
  console.log('  - SQLite database files\n');

  const answer = await askQuestion('Are you sure you want to reset the database? (yes/no): ');
  
  if (answer.toLowerCase() !== 'yes') {
    console.log('\n❌ Reset cancelled.');
    rl.close();
    return;
  }

  console.log('\n🗑️  Deleting database files...');

  let deletedCount = 0;

  // Delete main database file
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('   ✓ Deleted scraper.db');
    deletedCount++;
  }

  // Delete WAL file (Write-Ahead Log)
  if (fs.existsSync(DB_WAL_PATH)) {
    fs.unlinkSync(DB_WAL_PATH);
    console.log('   ✓ Deleted scraper.db-wal');
    deletedCount++;
  }

  // Delete SHM file (Shared Memory)
  if (fs.existsSync(DB_SHM_PATH)) {
    fs.unlinkSync(DB_SHM_PATH);
    console.log('   ✓ Deleted scraper.db-shm');
    deletedCount++;
  }

  if (deletedCount === 0) {
    console.log('   ℹ️  No database files found (already clean)');
  }

  console.log('\n✅ Database reset complete!');
  console.log('   Next run will create a fresh database.\n');

  rl.close();
}

// Run if called directly
if (require.main === module) {
  resetDatabase().catch(err => {
    console.error('Error resetting database:', err);
    rl.close();
    process.exit(1);
  });
}

module.exports = { resetDatabase };
