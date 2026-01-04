const { chromium } = require('playwright');
const fs = require('fs');

// ================= CONFIG =================
const USERNAME = 'daarshik108';
const MAX_TWEETS = 25; // < 0 = unlimited

// Playwright-only profile (stable, isolated)
const USER_DATA_DIR = './pw-profile';

// Brave binary
const BRAVE_EXECUTABLE =
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

// Checkpoint files
const PHASE1_FILE = 'tweets.phase1.json';
const PHASE2_FILE = 'threads.phase2.json';
const PHASE2_PROGRESS = 'progress.phase2.json';
// =========================================

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadJSON(file, fallback) {
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  }
  return fallback;
}

// 🔑 Canonical tweet ID extractor (CRITICAL)
function extractTweetId(url) {
  if (!url) return null;
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

(async () => {
  log('INIT', 'Starting X thread scraper');
  log('INIT', 'Using Playwright-only profile');
  log('INIT', `MAX_TWEETS = ${MAX_TWEETS}`);

  // --------------------------------------------------
  // Launch browser
  // --------------------------------------------------
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

  // ==================================================
  // PHASE 1 — TIMELINE SCRAPING (IDEMPOTENT)
  // ==================================================
  log('PHASE 1', 'Starting timeline scrape');

  let tweets = new Map(
    loadJSON(PHASE1_FILE, []).map(t => [t.id, t])
  );

  log('PHASE 1', `Loaded ${tweets.size} tweets from checkpoint`);

  await page.goto(`https://x.com/${USERNAME}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await sleep(5000);

  if (page.url().includes('/login')) {
    log('ERROR', 'Not logged into X. Log in once, then re-run.');
    process.exit(1);
  }

  let lastHeight = 0;
  let stuck = 0;

  async function expandShowMore() {
    const buttons = await page.$$(
      'button[data-testid="tweet-text-show-more-link"]'
    );
    for (const b of buttons) {
      try {
        await b.click();
        await sleep(150);
      } catch {}
    }
  }

  async function scrapeVisibleTweets() {
    const items = await page.evaluate((USERNAME) => {
      const extractId = (url) => {
        const m = url && url.match(/status\/(\d+)/);
        return m ? m[1] : null;
      };

      const out = [];
      document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
        const time = a.querySelector('time');
        if (!time) return;

        const anchor = time.closest('a');
        if (!anchor || !anchor.href) return;

        const id = extractId(anchor.href);
        if (!id) return;

        const box = a.querySelector('div[data-testid="tweetText"]');
        if (!box) return;

        let text = '';
        for (const n of box.childNodes) {
          if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
          else if (n.tagName === 'SPAN') text += n.innerText;
          else if (n.tagName === 'IMG' && n.alt) text += n.alt;
        }

        out.push({
          id,
          link: `https://x.com/${USERNAME}/status/${id}`,
          text: text.trim(),
          has_image: a.querySelector('[data-testid="tweetPhoto"]') !== null,
          has_video: a.querySelector('[data-testid="videoComponent"]') !== null
        });
      });
      return out;
    }, USERNAME);

    let added = 0;
    for (const t of items) {
      if (!tweets.has(t.id)) {
        tweets.set(t.id, t);
        added++;
      }
    }

    if (added > 0) {
      log('PHASE 1', `Added ${added} tweets (total ${tweets.size})`);
      saveJSON(PHASE1_FILE, [...tweets.values()]);
    }
  }

  while (true) {
    await expandShowMore();
    await scrapeVisibleTweets();

    if (MAX_TWEETS >= 0 && tweets.size >= MAX_TWEETS) {
      log('PHASE 1', 'MAX_TWEETS reached');
      break;
    }

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(4000 + Math.random() * 2000);

    const h = await page.evaluate(() => document.body.scrollHeight);
    if (h === lastHeight) {
      stuck++;
      log('PHASE 1', `No progress (${stuck}/6)`);
      await sleep(8000);
      if (stuck >= 6) break;
    } else {
      stuck = 0;
      lastHeight = h;
    }
  }

  saveJSON(PHASE1_FILE, [...tweets.values()]);
  log('PHASE 1', `Checkpoint saved (${tweets.size} tweets)`);

  // ==================================================
  // PHASE 2 — THREAD RESOLUTION (RESUMABLE)
  // ==================================================
  log('PHASE 2', 'Resolving threads');

  const phase1Tweets = loadJSON(PHASE1_FILE, []);
  let threads = loadJSON(PHASE2_FILE, []);
  let progress = loadJSON(PHASE2_PROGRESS, { index: 0 });

  log('PHASE 2', `Resuming at index ${progress.index}`);

  for (let i = progress.index; i < phase1Tweets.length; i++) {
    const tweet = phase1Tweets[i];
    log('PHASE 2', `(${i + 1}/${phase1Tweets.length}) ${tweet.id}`);

    await page.goto(tweet.link, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await sleep(4000);

    if (page.url().includes('/login')) {
      log('ERROR', 'Logged out during Phase 2. Log back in and rerun.');
      process.exit(1);
    }

    await page.waitForSelector('article[data-testid="tweet"]', {
      timeout: 60000
    });

    for (let s = 0; s < 6; s++) {
      await page.mouse.wheel(0, 2000);
      await sleep(2000);
    }

    const replies = await page.evaluate((USERNAME) => {
      const extractId = (url) => {
        const m = url && url.match(/status\/(\d+)/);
        return m ? m[1] : null;
      };

      const out = [];
      document.querySelectorAll('article[data-testid="tweet"]').forEach(a => {
        const author = a.querySelector(`a[href^="/${USERNAME}"]`);
        if (!author) return;

        const time = a.querySelector('time');
        if (!time) return;

        const anchor = time.closest('a');
        if (!anchor || !anchor.href) return;

        const id = extractId(anchor.href);
        if (!id) return;

        const box = a.querySelector('div[data-testid="tweetText"]');
        if (!box) return;

        let text = '';
        for (const n of box.childNodes) {
          if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
          else if (n.tagName === 'SPAN') text += n.innerText;
          else if (n.tagName === 'IMG' && n.alt) text += n.alt;
        }

        out.push({
          id,
          link: `https://x.com/${USERNAME}/status/${id}`,
          text: text.trim()
        });
      });
      return out;
    }, USERNAME);

    if (replies.length > 1) {
      threads.push({
        thread_id: tweet.id,
        tweet_count: replies.length,
        tweets: replies
      });
      log('PHASE 2', `Thread found (${replies.length})`);
    }

    progress.index = i + 1;
    saveJSON(PHASE2_FILE, threads);
    saveJSON(PHASE2_PROGRESS, progress);

    await sleep(3000);
  }

  log('DONE', `Threads saved: ${threads.length}`);
  await context.close();
})();
