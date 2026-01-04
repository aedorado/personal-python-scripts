const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { log } = require('../src/scrapers/utils');
const ScraperDB = require('../src/database/db');
const { runPhase2Conversations } = require('../src/scrapers/phase2_resolve_conversations');
const { exportUserToPDF } = require('../src/export/export-pdf');

const LINKS = [
  'https://x.com/Yashraajsharrma/status/2001247998073036939',
  'https://x.com/daarshik108/status/2000415237464523028',
  'https://x.com/daarshik108/status/1976883987877400893',
  'https://x.com/daarshik108/status/2002356291973624107',
  'https://x.com/daarshik108/status/2001950123220406359',
  'https://x.com/Yashraajsharrma/status/2001247998073036939',
  'https://x.com/Yashraajsharrma/status/1838555702366769431',
  'https://x.com/daarshik108/status/1999367205922988141'
];

const TEST_DB_PATH = path.join(__dirname, '../database/phase2_links_test.db');
const OUTPUT_DIR = path.join(__dirname, '../output/phase2-links');
const USER_DATA_DIR = path.join(__dirname, '../pw-profile');
const BRAVE_EXECUTABLE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const HEADLESS = false;

// Modes:
//  - all  : seed -> phase2 scrape -> export PDFs
//  - save : seed -> phase2 scrape only (no PDFs)
//  - pdf  : export PDFs only from existing DB
// Note: when running via `npm run ... -- --mode=pdf` we get argv; if user forgets `--`,
// npm sets npm_config_mode env, so we fall back to that too.
const modeArg = process.argv.find(a => a.startsWith('--mode='));
const MODE = modeArg
  ? modeArg.split('=')[1]
  : (process.env.npm_config_mode || 'all');

function parseLink(link) {
  try {
    const url = new URL(link);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 3 || parts[1] !== 'status') return null;
    return {
      username: parts[0],
      id: parts[2],
      link
    };
  } catch (err) {
    console.error(`Invalid link skipped: ${link}`);
    return null;
  }
}

function seedPhase1Tweets(db, links) {
  const tweets = [];
  const usernames = new Set();

  for (const link of links) {
    const parsed = parseLink(link);
    if (!parsed) continue;
    usernames.add(parsed.username);
    tweets.push({
      id: parsed.id,
      username: parsed.username,
      link: parsed.link,
      text: '[seeded for phase2 test]',
      has_image: 0,
      has_video: 0
    });
  }

  if (tweets.length === 0) {
    throw new Error('No valid links to seed');
  }

  db.saveTweetsBatch(tweets);
  return Array.from(usernames);
}

async function runPhase2AndMaybePDF() {
  // Fresh test DB only when saving new data
  if (MODE === 'all' || MODE === 'save') {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH);
    }

    const db = new ScraperDB(TEST_DB_PATH);
    const usernames = seedPhase1Tweets(db, LINKS);
    log('TEST', `Seeded ${LINKS.length} links across ${usernames.length} users`);

    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
      headless: HEADLESS,
      executablePath: BRAVE_EXECUTABLE,
      args: ['--disable-blink-features=AutomationControlled'],
      viewport: { width: 1280, height: 900 }
    });

    let page = await context.newPage();

    try {
      for (const username of usernames) {
        log('TEST', `Phase 2 for @${username}`);
        await runPhase2Conversations(page, username, db, context);
      }
    } finally {
      db.close();
      await context.close();
    }

    if (MODE === 'save') {
      log('TEST', 'Done saving conversations (no PDFs requested).');
      return usernames;
    }

    // MODE === 'all' continues to PDF export below
    return usernames;
  }

  // MODE === 'pdf' only: do not recreate DB, just use existing
  return null;
}

async function main() {
  const usernamesFromRun = await runPhase2AndMaybePDF();

  if (MODE === 'pdf' || MODE === 'all') {
    // If we didn't just run, we need usernames from existing DB
    let usernames = usernamesFromRun;
    if (!usernames) {
      const db = new ScraperDB(TEST_DB_PATH);
      const result = db.db.prepare('SELECT DISTINCT username FROM tweets').all();
      usernames = result.map(r => r.username);
      db.close();
    }

    if (!usernames || usernames.length === 0) {
      throw new Error('No usernames found in test DB for PDF export');
    }

    for (const username of usernames) {
      await exportUserToPDF(username, { dbPath: TEST_DB_PATH, outputDir: OUTPUT_DIR });
    }

    log('TEST', `Done. PDFs in ${OUTPUT_DIR}`);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[TEST] Failed:', err);
    process.exit(1);
  });
}
