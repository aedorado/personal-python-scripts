const { log, sleep } = require('./utils');

/* ---------------- EXPANSION LOGIC ---------------- */

/**
 * THIS IS THE KEY FIX.
 * We keep scrolling + clicking until the number of tweets
 * stops increasing for multiple rounds.
 * Added timeout protection to prevent infinite loops.
 */
async function fullyExpandConversation(page) {
  let lastCount = 0;
  let stableRounds = 0;
  let iterations = 0;
  const MAX_ITERATIONS = 20;
  const MAX_TIME_MS = 120000; // 2 minutes
  const startTime = Date.now();

  while (stableRounds < 3 && iterations < MAX_ITERATIONS) {
    // Check timeout
    if (Date.now() - startTime > MAX_TIME_MS) {
      log('PHASE 2', '⏱️  Expansion timeout reached (2 minutes)');
      break;
    }

    iterations++;
    
    // Scroll up first to ensure we see any thread tweets above
    await page.mouse.wheel(0, -3000);
    await page.waitForTimeout(1000);
    
    // Then scroll down to load more content
    await page.mouse.wheel(0, 5000);
    await page.waitForTimeout(1500);

    // Click "Show more" buttons on truncated tweets - try multiple selectors
    let expandedCount = 0;
    
    // Method 1: Direct button selector
    const showMoreButtons = await page.$$('button[data-testid="tweet-text-show-more-link"]');
    for (const btn of showMoreButtons) {
      try {
        await btn.click({ timeout: 1000 });
        expandedCount++;
        await page.waitForTimeout(1500);
      } catch {}
    }
    
    // Method 2: Look for any element containing "Show more" within tweet text areas
    const expandedMore = await page.evaluate(() => {
      let count = 0;
      const tweets = document.querySelectorAll('article[data-testid="tweet"]');
      tweets.forEach(article => {
        const textDiv = article.querySelector('div[data-testid="tweetText"]');
        if (textDiv) {
          // Find "Show more" link within or after the text
          const allElements = Array.from(textDiv.parentElement.querySelectorAll('*'));
          allElements.forEach(el => {
            if (el.textContent && el.textContent.trim() === 'Show more' && 
                (el.tagName === 'SPAN' || el.tagName === 'A')) {
              // Click the parent clickable element
              let clickable = el;
              while (clickable && clickable !== document.body) {
                if (clickable.tagName === 'BUTTON' || 
                    clickable.tagName === 'A' || 
                    clickable.getAttribute('role') === 'button') {
                  clickable.click();
                  count++;
                  break;
                }
                clickable = clickable.parentElement;
              }
            }
          });
        }
      });
      return count;
    });
    
    expandedCount += expandedMore;
    if (expandedCount > 0) {
      console.log(`[PHASE 2] Expanded ${expandedCount} truncated tweets`);
      await page.waitForTimeout(2000); // Extra wait for content to fully render
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

    log('PHASE 2', `  Iteration ${iterations}: ${count} tweets (stable: ${stableRounds}/3)`);

    if (count === lastCount) {
      stableRounds++;
    } else {
      stableRounds = 0;
      lastCount = count;
    }
  }
  
  if (iterations >= MAX_ITERATIONS) {
    log('PHASE 2', '⚠️  Max iterations reached');
  }
  
  // Final scroll to top to ensure we capture everything
  await page.mouse.wheel(0, -10000);
  await page.waitForTimeout(2000);
  
  log('PHASE 2', `Expansion complete: ${lastCount} tweets after ${iterations} iterations`);
}

async function expandAllShowMore(page) {
  const MAX_PASSES = 10;
  for (let i = 0; i < MAX_PASSES; i++) {
    const clicked = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('button[data-testid="tweet-text-show-more-link"]').forEach(btn => {
        try {
          btn.click();
          count++;
        } catch {}
      });
      return count;
    });

    if (!clicked) break;
    await page.waitForTimeout(1200);
  }
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

    // Use innerText instead of textContent to preserve visual formatting including newlines
    // innerText respects CSS and preserves line breaks as they appear on screen
    const text = textBox.innerText || textBox.textContent || '';

    // Extract image URLs (only actual photos, not emojis or icons)
    const imageElements = article.querySelectorAll('[data-testid="tweetPhoto"] img');
    const imageUrls = [];
    for (const img of imageElements) {
      const src = img.getAttribute('src');
      // Only include actual Twitter media images, not emojis or icons
      if (src && src.startsWith('https://pbs.twimg.com/media/')) {
        imageUrls.push(src);
      }
    }

    results.push({
      position: position++,
      id,
      author,
      link: `https://x.com/${author}/status/${id}`,
      text: text.trim(),
      imageUrls: imageUrls
    });
  }

  return results;
}

/* ---------------- IMAGE HANDLING ---------------- */

async function downloadImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    
    // Determine mime type from URL
    let mimeType = 'image/jpeg';
    if (url.includes('format=png')) mimeType = 'image/png';
    else if (url.includes('format=jpg') || url.includes('format=jpeg')) mimeType = 'image/jpeg';
    
    return `data:${mimeType};base64,${base64}`;
  } catch (err) {
    console.error(`Failed to download image ${url}:`, err.message);
    return null;
  }
}

/* ---------------- STRUCTURING ---------------- */

function buildStructuredConversation(root, tweets, username) {
  const seen = new Set();
  const PLACEHOLDER = '[seeded for phase2 test]';
  
  // Find the root tweet in the conversation tweets (it has the actual images)
  const rootFromConversation = tweets.find(t => t.id === root.id);
  
  // Root tweet - use text from conversation when available and non-placeholder; otherwise fall back
  const convText = rootFromConversation && rootFromConversation.text
    ? rootFromConversation.text.trim()
    : '';
  let rootText = convText && convText !== PLACEHOLDER
    ? convText
    : (root.text && root.text !== PLACEHOLDER ? root.text : '');

  // Fallback: if still empty/placeholder, use the first non-placeholder author tweet text
  if (!rootText) {
    const firstAuthor = tweets
      .filter(t => t.author === username && t.text && t.text !== PLACEHOLDER)
      .sort((a, b) => a.position - b.position)[0];
    if (firstAuthor) {
      rootText = firstAuthor.text.trim();
    }
  }

  const rootTweet = {
    id: root.id,
    author: username,
    link: root.link,
    text: rootText,
    timestamp: null,
    images: rootFromConversation ? (rootFromConversation.images || []) : (root.images || [])
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
  const usedAuthorResponses = new Set();

  // Keep tweets in visual order to preserve context
  const orderedOtherTweets = [...otherTweets].sort((a, b) => a.position - b.position);
  const orderedAuthorTweets = [...authorThreadTweets].sort((a, b) => a.position - b.position);

  for (let i = 0; i < orderedOtherTweets.length; i++) {
    const tweet = orderedOtherTweets[i];

    // The next non-author tweet marks the boundary for which author tweets belong here
    const nextOther = orderedOtherTweets.find(t => t.position > tweet.position);
    const nextBoundary = nextOther ? nextOther.position : Infinity;

    const authorResponses = orderedAuthorTweets.filter(t => {
      if (usedAuthorResponses.has(t.id)) return false;
      // Associate author tweets that appear after this reply but before the next non-author reply
      return t.position > tweet.position && t.position < nextBoundary;
    });

    if (authorResponses.length > 0) {
      authorResponses.forEach(r => usedAuthorResponses.add(r.id));
      replies.push({
        tweet: {
          id: tweet.id,
          author: tweet.author,
          link: tweet.link,
          text: tweet.text,
          timestamp: null,
          images: tweet.images || []
        },
        author_responses: authorResponses.map(r => ({
          id: r.id,
          author: r.author,
          link: r.link,
          text: r.text,
          timestamp: null,
          images: r.images || []
        }))
      });
    }
  }

  // Remaining author tweets are part of the main thread
  const threadTweets = orderedAuthorTweets
    .filter(t => !usedAuthorResponses.has(t.id))
    .map(t => ({
      id: t.id,
      author: t.author,
      link: t.link,
      text: t.text,
      timestamp: null,
      images: t.images || []
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

async function runPhase2Conversations(page, USERNAME, db, context) {
  const phase1 = db.getTweetsByUsername(USERNAME);
  if (!phase1.length) {
    throw new Error(`Phase 1 output missing for @${USERNAME}`);
  }

  const startIndex = 0; // Always scan all roots
  log('PHASE 2', 'Starting at index 0; will skip roots with existing conversations');
  
  const RESTART_INTERVAL = 20; // Restart page every 20 tweets
  let currentPage = page;

  for (let i = startIndex; i < phase1.length; i++) {
    // Skip if already processed
    if (db.conversationExists(phase1[i].id)) {
      continue;
    }

    // Close and recreate page every RESTART_INTERVAL iterations to prevent crashes
    if (i > 0 && (i - startIndex) % RESTART_INTERVAL === 0) {
      log('PHASE 2', '🔄 Recreating page to free memory...');
      try {
        await currentPage.close();
        currentPage = await context.newPage();
        await sleep(2000);
        log('PHASE 2', '✔ Page recreated');
      } catch (restartErr) {
        log('PHASE 2', `⚠️  Page recreation failed: ${restartErr.message}`);
        // Continue with existing page
      }
    }
    
    const root = phase1[i];
    log('PHASE 2', `(${i + 1}/${phase1.length}) Processing: ${root.link}`);
    log('PHASE 2', `Root tweet: "${root.text.substring(0, 60)}..."`);

    try {
      await currentPage.goto(root.link, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await sleep(4000);

      if (currentPage.url().includes('/login')) {
        throw new Error('Logged out');
      }

      await currentPage.waitForSelector(
        'div[aria-label="Timeline: Conversation"]',
        { timeout: 60000 }
      );

      // Wait a bit for thread tweets to render
      await sleep(3000);

      // 🔥 THE IMPORTANT PART - Scroll up first to see thread above
      await currentPage.mouse.wheel(0, -5000);
      await sleep(2000);
      
      log('PHASE 2', 'Expanding conversation...');
      await fullyExpandConversation(currentPage);

      log('PHASE 2', 'Clicking any remaining Show more buttons...');
      await expandAllShowMore(currentPage);

      log('PHASE 2', 'Extracting tweets from page...');
      const conversation = await currentPage.evaluate(extractConversation);
      log('PHASE 2', `Found ${conversation.length} tweets on page`);

      if (!conversation.length) {
        log('PHASE 2', '⚠️  No tweets extracted; skipping save for this root to avoid placeholder data');
        continue;
      }

      // Download images and convert to base64
      let totalImages = 0;
      for (const tweet of conversation) {
        if (tweet.imageUrls && tweet.imageUrls.length > 0) {
          tweet.images = [];
          for (const url of tweet.imageUrls) {
            const base64 = await downloadImageAsBase64(url);
            if (base64) {
              tweet.images.push(base64);
              totalImages++;
            }
          }
          delete tweet.imageUrls; // Clean up temporary field
        } else {
          tweet.images = [];
        }
      }
      
      if (totalImages > 0) {
        log('PHASE 2', `Downloaded ${totalImages} images`);
      }

      // Build structured conversation
      const structuredConv = buildStructuredConversation(root, conversation, USERNAME);

      // Save conversation to database
      db.saveConversation(root.id, USERNAME, structuredConv);

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
      
      // If page crashed, try to recreate it immediately
      if (err.message.includes('crashed') || err.message.includes('closed')) {
        log('PHASE 2', '🔄 Page crashed, recreating...');
        try {
          await currentPage.close().catch(() => {});
          currentPage = await context.newPage();
          await sleep(3000);
          log('PHASE 2', '✔ Page recreated after crash');
        } catch (restartErr) {
          log('PHASE 2', `❌ Failed to recreate page: ${restartErr.message}`);
          throw restartErr;
        }
      }
      
      await sleep(5000);
    }
  }

  log('PHASE 2', 'Completed all conversations');
  
  // Export to JSON for backward compatibility
  const allConversations = db.getTweetsByUsername(USERNAME)
    .map(t => db.getConversation(t.id))
    .filter(c => c !== null);
    
  return allConversations;
}

module.exports = { runPhase2Conversations };
