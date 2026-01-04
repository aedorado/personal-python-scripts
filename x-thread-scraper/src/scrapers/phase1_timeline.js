const { sleep, log } = require('./utils');

async function runPhase1(page, USERNAME, MAX_TWEETS, STOP_ON_DUPLICATES, db) {
  log('PHASE 1', 'Starting timeline scrape');

  // Load existing tweets from database
  const existingTweets = db.getTweetsByUsername(USERNAME);
  let tweets = new Map(existingTweets.map(t => [t.id, t]));

  log('PHASE 1', `Loaded ${tweets.size} tweets from database`);
  
  let consecutiveDuplicates = 0;

  await page.goto(`https://x.com/${USERNAME}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await sleep(5000);

  if (page.url().includes('/login')) {
    throw new Error('Not logged into X');
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
          created_at: time.getAttribute('datetime') || null,
          has_image: a.querySelector('[data-testid="tweetPhoto"]') !== null,
          has_video: a.querySelector('[data-testid="videoComponent"]') !== null
        });
      });
      return out;
    }, USERNAME);

    let added = 0;
    const newTweets = [];
    
    for (const t of items) {
      if (!tweets.has(t.id)) {
        t.username = USERNAME;
        tweets.set(t.id, t);
        newTweets.push(t);
        added++;
        consecutiveDuplicates = 0; // Reset counter on new tweet
      } else {
        consecutiveDuplicates++;
      }
    }

    if (added > 0) {
      log('PHASE 1', `Added ${added} tweets (total ${tweets.size})`);
      db.saveTweetsBatch(newTweets);
    }
    
    // Check if we should stop due to too many duplicates
    if (STOP_ON_DUPLICATES > 0 && consecutiveDuplicates >= STOP_ON_DUPLICATES) {
      log('PHASE 1', `Stopping: ${STOP_ON_DUPLICATES} consecutive duplicates found`);
      return true; // Signal to stop
    }
    
    return false;
  }

  while (true) {
    await expandShowMore();
    const shouldStop = await scrapeVisibleTweets();
    
    if (shouldStop) {
      log('PHASE 1', 'Stopped due to duplicate threshold');
      break;
    }

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
  
  log('PHASE 1', `✔ ${tweets.size} total tweets`);
}

module.exports = { runPhase1 };
