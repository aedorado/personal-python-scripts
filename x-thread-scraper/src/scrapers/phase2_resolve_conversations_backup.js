const fs = require('fs');
const path = require('path');
const { log, sleep } = require('./utils');

const OUTPUT_DIR = path.join(__dirname, 'output');

/* ---------------- IO ---------------- */

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function loadJSON(filePath, fallback) {
  const fullPath = path.join(OUTPUT_DIR, filePath);
  if (!fs.existsSync(fullPath)) return fallback;
  return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
}

function saveJSON(filePath, data) {
  ensureOutputDir();
  const fullPath = path.join(OUTPUT_DIR, filePath);
  fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
}

/* ---------------- EXPANSION LOGIC ---------------- */

/**
 * THIS IS THE KEY FIX.
 * We keep scrolling + clicking until the number of tweets
 * stops increasing for multiple rounds.
 */
async function fullyExpandConversation(page) {
  let lastCount = 0;
  let stableRounds = 0;

  while (stableRounds < 5) {
    // Scroll up first to ensure we see any thread tweets above
    await page.mouse.wheel(0, -3000);
    await page.waitForTimeout(1500);
    
    // Then scroll down to load more content
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(2000);

    // Click "Show more" buttons on truncated tweets first
    const showMoreButtons = await page.$$('button[data-testid="tweet-text-show-more-link"]');
    for (const btn of showMoreButtons) {
      try {
        await btn.click({ timeout: 1000 });
        await page.waitForTimeout(500);
      } catch {}
    }

    // Click ALL possible expansion buttons - thread and reply buttons
    const allButtons = await page.$$('div[role="button"], button[role="button"]');
    for (const btn of allButtons) {
      try {
        const text = await btn.textContent();
        const textLower = text.toLowerCase();
        if (
          textLower.includes('show this thread') ||
          textLower.includes('show replies') ||
          textLower.includes('show more replies') ||
          textLower.includes('show more') ||
          textLower.includes('read more')
        ) {
          await btn.click({ timeout: 1000 });
          await page.waitForTimeout(1500);
        }
      } catch {}
    }

    // Count ALL tweets on page (not just in conversation timeline)
    const count = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });

    if (count === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = count;
    }
  }
  
  // Final scroll to top to ensure we capture everything
  await page.mouse.wheel(0, -10000);
  await page.waitForTimeout(2000);
}

/* ---------------- EXTRACTION ---------------- */

function extractConversation() {
  const results = [];
  let position = 1;

  // Get ALL tweets on the page - not just in conversation timeline
  // Thread tweets might be in a different container
  const articles = document.querySelectorAll('article[data-testid="tweet"]');
  
  for (const article of articles) {
    // Check if we've hit the "Discover more" section by looking at previous sibling or parent elements
    let currentElement = article;
    let hitDiscoverMore = false;
    
    // Walk up the DOM to check for "Discover more" heading
    while (currentElement && currentElement !== document.body) {
      const prevSibling = currentElement.previousElementSibling;
      if (prevSibling) {
        const text = prevSibling.textContent || '';
        if (text.includes('Discover more') || text.includes('You might like')) {
          hitDiscoverMore = true;
          break;
        }
      }
      currentElement = currentElement.parentElement;
    }
    
    if (hitDiscoverMore) break;
    
    // Also check article itself for spam indicators
    const articleText = article.innerText || '';
    if (articleText.includes('probable spam')) {
      continue;
    }

    // Extract tweet ID from time element
    const time = article.querySelector('time');
    if (!time) continue;

    const linkEl = time.closest('a');
    const match = linkEl?.href?.match(/status\/(\d+)/);
    if (!match) continue;

    const id = match[1];

    // Extract author from profile link
    const authorEl = article.querySelector('a[href^="/"][role="link"]');
    let author = null;
    if (authorEl) {
      const href = authorEl.getAttribute('href');
      if (href && href.startsWith('/')) {
        author = href.slice(1).split('/')[0];
      }
    }

    // Extract tweet text
    const textBox = article.querySelector('div[data-testid="tweetText"]');
    if (!textBox) continue;

    let text = '';
    
    // Recursively extract text from all child nodes
    function extractText(element) {
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'IMG' && node.alt) {
            text += node.alt;
          } else if (node.tagName === 'SPAN') {
            extractText(node);
          }
        }
      }
    }
    
    extractText(textBox);

    results.push({
      position: position++,
      id,
      author,
      link: `https://x.com/${author}/status/${id}`,
      text: text.trim()
    });
  }

  return results;
}

/* ---------------- STRUCTURING ---------------- */

function buildStructuredConversation(root, tweets, username) {
  const seen = new Set();
  
  // Root tweet
  const rootTweet = {
    id: root.id,
    author: username,
    link: root.link,
    text: root.text,
    timestamp: null
  };
  seen.add(root.id);

  // Separate author's thread tweets from replies
  const authorThreadTweets = [];
  const otherTweets = [];

  for (const tweet of tweets) {
    if (seen.has(tweet.id)) continue;
    
    if (tweet.author === username) {
      authorThreadTweets.push(tweet);
    } else {
      otherTweets.push(tweet);
    }
    seen.add(tweet.id);
  }

  // Build reply structure
  const replies = [];
  const processedReplies = new Set();

  for (const tweet of otherTweets) {
    if (processedReplies.has(tweet.id)) continue;
    
    // Find all author responses to this tweet's author
    const authorResponses = authorThreadTweets.filter(t => {
      // Simple heuristic: author tweets that appear after this reply
      // In a more sophisticated version, we'd parse reply_to relationships
      return t.position > tweet.position;
    });

    // Mark these as processed so they don't appear in thread
    authorResponses.forEach(r => processedReplies.add(r.id));

    replies.push({
      tweet: {
        id: tweet.id,
        author: tweet.author,
        link: tweet.link,
        text: tweet.text,
        timestamp: null
      },
      author_responses: authorResponses.map(r => ({
        id: r.id,
        author: r.author,
        link: r.link,
        text: r.text,
        timestamp: null
      }))
    });
  }

  // Remaining author tweets are part of the main thread
  const threadTweets = authorThreadTweets
    .filter(t => !processedReplies.has(t.id))
    .map(t => ({
      id: t.id,
      author: t.author,
      link: t.link,
      text: t.text,
      timestamp: null
    }));

  return {
    root_tweet_id: root.id,
    conversation: {
      root: rootTweet,
      thread: threadTweets,
      replies: replies
    }
  };
}

/* ---------------- PHASE 2 ---------------- */

async function runPhase2Conversations(page, USERNAME) {
  const PHASE1_FILE = `${USERNAME}_tweets.phase1.json`;
  const OUTPUT_FILE = `${USERNAME}_conversations.json`;
  const CHECKPOINT_FILE = `${USERNAME}_checkpoint.json`;
  
  const phase1 = loadJSON(PHASE1_FILE, []);
  if (!phase1.length) {
    throw new Error(`Phase 1 output missing for @${USERNAME}`);
  }

  const checkpoint = loadJSON(CHECKPOINT_FILE, {
    index: 0,
    conversations: []
  });

  log('PHASE 2', `Resuming from index ${checkpoint.index}`);

  for (let i = checkpoint.index; i < phase1.length; i++) {
    const root = phase1[i];
    log('PHASE 2', `(${i + 1}/${phase1.length}) Processing: ${root.link}`);
    log('PHASE 2', `Root tweet: "${root.text.substring(0, 60)}..."`);

    try {
      await page.goto(root.link, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await sleep(4000);

      if (page.url().includes('/login')) {
        throw new Error('Logged out');
      }

      await page.waitForSelector(
        'div[aria-label="Timeline: Conversation"]',
        { timeout: 60000 }
      );

      // Wait a bit for thread tweets to render
      await sleep(3000);

      // 🔥 THE IMPORTANT PART - Scroll up first to see thread above
      await page.mouse.wheel(0, -5000);
      await sleep(2000);
      
      log('PHASE 2', 'Expanding conversation...');
      await fullyExpandConversation(page);

      log('PHASE 2', 'Extracting tweets from page...');
      const conversation = await page.evaluate(extractConversation);
      log('PHASE 2', `Found ${conversation.length} tweets on page`);

      // Build structured conversation
      const structuredConv = buildStructuredConversation(root, conversation, USERNAME);

      checkpoint.conversations.push(structuredConv);

      checkpoint.index = i + 1;
      saveJSON(CHECKPOINT_FILE, checkpoint);
      saveJSON(OUTPUT_FILE, checkpoint.conversations);

      // Count tweets by author for logging
      const allTweets = [
        structuredConv.conversation.root,
        ...structuredConv.conversation.thread,
        ...structuredConv.conversation.replies.map(r => r.tweet),
        ...structuredConv.conversation.replies.flatMap(r => r.author_responses)
      ];
      const authorCounts = {};
      allTweets.forEach(t => {
        authorCounts[t.author] = (authorCounts[t.author] || 0) + 1;
      });
      
      const authorSummary = Object.entries(authorCounts)
        .map(([author, count]) => `@${author}(${count})`)
        .join(', ');
      
      log('PHASE 2', `✔ Collected ${allTweets.length} tweets: ${authorSummary}`);

      await sleep(2500);
    } catch (err) {
      log('PHASE 2', `❌ Failed: ${err.message}`);
      await sleep(5000);
    }
  }

  log('PHASE 2', 'Completed all conversations');
  return checkpoint.conversations;
}

module.exports = { runPhase2Conversations };
