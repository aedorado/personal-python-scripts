const { sleep, log, saveJSON, loadJSON } = require('./utils');

const PHASE1_FILE = 'tweets.phase1.json';
const PHASE2_FILE = 'threads.phase2.json';
const PHASE2_PROGRESS = 'progress.phase2.json';

async function runPhase2(page, USERNAME) {
  // -----------------------------------------
  // Load Phase 1 output
  // -----------------------------------------
  const phase1Tweets = loadJSON(PHASE1_FILE, []);
  if (!phase1Tweets.length) {
    throw new Error('Phase 1 output missing: tweets.phase1.json');
  }

  let conversations = loadJSON(PHASE2_FILE, []);
  let progress = loadJSON(PHASE2_PROGRESS, { index: 0 });

  log('PHASE 2', `Resuming from index ${progress.index}`);

  // -----------------------------------------
  // Iterate over root tweets
  // -----------------------------------------
  for (let i = progress.index; i < phase1Tweets.length; i++) {
    const root = phase1Tweets[i];
    log('PHASE 2', `(${i + 1}/${phase1Tweets.length}) ${root.id}`);

    await page.goto(root.link, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await sleep(4000);

    if (page.url().includes('/login')) {
      throw new Error('Logged out during Phase 2');
    }

    await page.waitForSelector('article[data-testid="tweet"]', {
      timeout: 60000
    });

    // Scroll to load replies
    for (let s = 0; s < 6; s++) {
      await page.mouse.wheel(0, 2000);
      await sleep(2000);
    }

    // -----------------------------------------
    // Extract conversation in visual order
    // -----------------------------------------
    const conversation = await page.evaluate((USERNAME) => {
      const extractId = (url) => {
        const m = url && url.match(/status\/(\d+)/);
        return m ? m[1] : null;
      };

      const results = [];
      let position = 1;
      let stop = false;

      const articles = document.querySelectorAll(
        'article[data-testid="tweet"]'
      );

      for (const a of articles) {
        if (stop) break;

        // Stop at "Discover more"
        if (a.innerText.includes('Discover more')) {
          stop = true;
          break;
        }

        const time = a.querySelector('time');
        if (!time) continue;

        const anchor = time.closest('a');
        const id = extractId(anchor?.href);
        if (!id) continue;

        const userAnchor = a.querySelector('a[href^="/"]');
        const author = userAnchor?.getAttribute('href')?.slice(1) || null;

        const box = a.querySelector('div[data-testid="tweetText"]');
        if (!box) continue;

        let text = '';
        for (const n of box.childNodes) {
          if (n.nodeType === Node.TEXT_NODE) text += n.textContent;
          else if (n.tagName === 'SPAN') text += n.innerText;
          else if (n.tagName === 'IMG' && n.alt) text += n.alt;
        }

        results.push({
          position: position++,
          id,
          author,
          link: `https://x.com/${author}/status/${id}`,
          text: text.trim()
        });
      }

      return results;
    }, USERNAME);

    // -----------------------------------------
    // Merge with Phase-1 root tweet
    // -----------------------------------------
    const mergedConversation = [];
    const seen = new Set();

    // Root tweet always first
    mergedConversation.push({
      position: 1,
      id: root.id,
      author: USERNAME,
      link: root.link,
      text: root.text,
      is_root: true
    });
    seen.add(root.id);

    // Append rest in order
    for (const item of conversation) {
      if (seen.has(item.id)) continue;
      mergedConversation.push({
        ...item,
        is_root: false
      });
      seen.add(item.id);
    }

    conversations.push({
      root_tweet_id: root.id,
      conversation: mergedConversation
    });

    // -----------------------------------------
    // Checkpoint after EACH root tweet
    // -----------------------------------------
    progress.index = i + 1;
    saveJSON(PHASE2_FILE, conversations);
    saveJSON(PHASE2_PROGRESS, progress);

    await sleep(3000);
  }

  log('PHASE 2', `Completed ${conversations.length} conversations`);
  return conversations;
}

module.exports = { runPhase2 };
