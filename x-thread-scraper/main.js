const { chromium } = require('playwright');
const { log } = require('./src/scrapers/utils');
const { runPhase1 } = require('./src/scrapers/phase1_timeline');
const {
  runPhase2Conversations
} = require('./src/scrapers/phase2_resolve_conversations');
const ScraperDB = require('./src/database/db');

// ================= CONFIG =================
// const USERNAMES = ['daarshik108', 'Yashraajsharrma', 'AstroSharmistha']; // Add more usernames here
const USERNAMES = ['AK33Astrology', 'shreeplanets', 'daarshik108', 'Yashraajsharrma']; // Add more usernames here
const MAX_TWEETS = -1;
const STOP_ON_DUPLICATES = 25; // Stop after N consecutive duplicates
const USER_DATA_DIR = './pw-profile';

const BRAVE_EXECUTABLE =
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

// Choose what to run
const RUN_PHASE_1 = true;   // set false to skip
const RUN_PHASE_2 = true;    // set true to run Phase 2
// =========================================

(async () => {
  log('MAIN', 'Launching browser');
  
  // Initialize database
  const db = new ScraperDB();
  log('MAIN', 'Database initialized');

  const context = await chromium.launchPersistentContext(
    USER_DATA_DIR,
    {
      headless: false,
      executablePath: BRAVE_EXECUTABLE,
      args: ['--disable-blink-features=AutomationControlled'],
      viewport: { width: 1280, height: 900 }
    }
  );

  const page = await context.newPage();

  try {
    // Run Phase 1 for all users first
    if (RUN_PHASE_1) {
      for (const username of USERNAMES) {
        log('MAIN', `Phase 1 - Processing user: @${username}`);
        await runPhase1(page, username, MAX_TWEETS, STOP_ON_DUPLICATES, db);
        log('MAIN', `Phase 1 - Completed for @${username}`);
      }
    } else {
      log('MAIN', 'Skipping Phase 1, using existing output');
    }

    // Then run Phase 2 for all users
    if (RUN_PHASE_2) {
      for (const username of USERNAMES) {
        log('MAIN', `Phase 2 - Processing user: @${username}`);
        await runPhase2Conversations(page, username, db, context);
        log('MAIN', `Phase 2 - Completed for @${username}`);
      }
    } else {
      log('MAIN', 'Skipping Phase 2');
    }
  } catch (err) {
    console.error('[FATAL]', err.message);
  } finally {
    db.close();
    log('MAIN', 'Database closed');
    await context.close();
  }
})();
