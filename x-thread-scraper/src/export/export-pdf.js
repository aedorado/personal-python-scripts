const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const ScraperDB = require('../database/db');

const DEFAULT_OUTPUT_DIR = path.join(__dirname, '../../output');

// Lightweight keyword buckets for tag extraction
const TAG_KEYWORDS = [
  { tag: 'astrology', words: ['jyotish', 'chart', 'horoscope', 'lagna', 'nakshatra', 'graha', 'kundli', 'dasha', 'transit', 'kundali'] },
  { tag: 'remedy', words: ['remedy', 'upaya', 'mantra', 'puja', 'worship', 'fast', 'daan'] },
  { tag: 'philosophy', words: ['dharma', 'karma', 'moksha', 'bhakti', 'vedas', 'shastra', 'gita', 'vedanta'] },
  { tag: 'family', words: ['family', 'parent', 'mother', 'father', 'marriage', 'spouse', 'children'] },
  { tag: 'career', words: ['career', 'job', 'work', 'promotion', 'wealth', 'money'] },
  { tag: 'health', words: ['health', 'disease', 'illness', 'hospital', 'medicine'] },
  { tag: 'education', words: ['study', 'education', 'learn', 'class', 'course'] },
  { tag: 'society', words: ['society', 'culture', 'tradition', 'people'] }
];

function generateHeading(tweetText) {
  // Clean the text
  let text = tweetText.trim();
  
  // Remove URLs
  text = text.replace(/https?:\/\/\S+/g, '');
  
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  // Take first sentence or first 60 characters
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences[0]) {
    const firstSentence = sentences[0].trim();
    if (firstSentence.length <= 60) {
      return firstSentence;
    }
  }
  
  // Fallback: use first 60 chars
  if (text.length <= 60) {
    return text;
  }
  
  return text.substring(0, 57).trim() + '...';
}

function generateSmartTitle(tweetText) {
  const clean = (t) => t
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/["'“”‘’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lines = tweetText.split(/\n+/).map(l => clean(l)).filter(Boolean);
  if (!lines.length) return generateHeading(tweetText);

  // Prefer first meaningful line up to ~90 chars
  const firstLine = lines.find(l => l.length > 12) || lines[0];
  if (firstLine.length <= 90) return firstLine;

  // Otherwise shorten gracefully
  const cut = firstLine.substring(0, 87).trim();
  return cut.endsWith('.') ? cut : `${cut}...`;
}

function extractTags(text) {
  const lower = text.toLowerCase();
  const scores = [];
  for (const bucket of TAG_KEYWORDS) {
    const hits = bucket.words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
    if (hits > 0) scores.push({ tag: bucket.tag, score: hits });
  }
  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(s => s.tag);
}

function cleanText(text) {
  if (!text) return '';

  // Normalize newlines and strip Windows newlines
  let out = text.replace(/\r\n/g, '\n');

  // Minimal whitespace touch: preserve all \n exactly as-is
  // Only trim leading/trailing spaces (not newlines) on each line
  out = out
    .split('\n')
    .map(line => line.replace(/[ \t]+$/g, '').replace(/^\s+/g, line.match(/^\s+/) ? '' : ''))
    .join('\n');

  // Replace common emojis; strip the rest
  out = out
    .replace(/🙏/g, '[namaste]')
    .replace(/😊/g, ':)')
    .replace(/😂/g, ':D')
    .replace(/❤️/g, '<3')
    .replace(/👍/g, '[thumbs up]')
    .replace(/🔥/g, '[fire]')
    .replace(/✨/g, '*')
    .replace(/💯/g, '100')
    .replace(/🎯/g, '[target]')
    .replace(/🌟/g, '[star]')
    .replace(/😌/g, ':)')
    .replace(/🙂/g, ':)')
    .replace(/[\u{1F000}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '');

  return out;
}

function addText(doc, text, options = {}) {
  const defaults = {
    fontSize: 11,
    lineGap: 4,
    continued: false
  };
  const opts = { ...defaults, ...options };
  
  doc.fontSize(opts.fontSize)
     .text(cleanText(text), { lineGap: opts.lineGap, continued: opts.continued });
}

function addHeading(doc, text, level = 1) {
  const sizes = { 1: 20, 2: 16, 3: 14, 4: 12 };
  const gaps = { 1: 10, 2: 8, 3: 6, 4: 5 };
  
  doc.moveDown(0.5)
     .fontSize(sizes[level])
     .fillColor('#1DA1F2')
     .text(text, { lineGap: gaps[level] })
     .fillColor('#000000')
     .moveDown(0.3);
}

function formatTweetTimestamp(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw; // fallback: show raw string if unparsable
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

function addTweet(doc, tweet, label = '') {
  const startX = doc.x;
  const boxX = startX + 15;
  const contentWidth = 470;
  
  // Check if we need a new page (only check for minimum header space)
  if (doc.y > doc.page.height - 150) {
    doc.addPage();
  }
  
  const startY = doc.y;
  doc.x = boxX;
  doc.y = startY + 10;

  // Prefer created_at but fall back to scraped_at or any available date-like field
  const displayDate = formatTweetTimestamp(
    tweet.created_at || tweet.scraped_at || tweet.createdAt || tweet.date
  );
  
  if (label) {
    doc.fontSize(9)
       .fillColor('#657786')
       .text(label.toUpperCase(), { lineGap: 2, width: contentWidth });
    doc.moveDown(0.2);
  }
  
  // Author
  doc.fontSize(13)
     .fillColor('#14171A')
     .font('Helvetica-Bold')
      .text(`@${tweet.author}`, { lineGap: 3, continued: true, width: contentWidth })
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#657786')
      .text(`  •  ${tweet.id}${displayDate ? `  •  ${displayDate}` : ''}`, { lineGap: 3 });
  
  doc.moveDown(0.3);
  
  // Tweet text - PDFKit will automatically handle page breaks
  doc.fontSize(11)
     .fillColor('#14171A')
     .font('Helvetica')
     .text(cleanText(tweet.text), { 
       lineGap: 5, 
       width: contentWidth,
       align: 'left'
     });
  
  doc.moveDown(0.5);
  
  // Images (if any)
  if (tweet.images && tweet.images.length > 0) {
    for (const base64Image of tweet.images) {
      try {
        // Extract base64 data from data URI
        const matches = base64Image.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (matches && matches[2]) {
          const imageBuffer = Buffer.from(matches[2], 'base64');
          const imageInfo = doc.openImage(imageBuffer);
          
          // Calculate image dimensions
          const maxWidth = 450;
          const maxHeight = 280;
          const aspectRatio = imageInfo.height / imageInfo.width;
          
          let displayWidth = imageInfo.width;
          let displayHeight = imageInfo.height;
          
          if (displayWidth > maxWidth) {
            displayWidth = maxWidth;
            displayHeight = maxWidth * aspectRatio;
          }
          if (displayHeight > maxHeight) {
            displayHeight = maxHeight;
            displayWidth = maxHeight / aspectRatio;
          }
          
          // Check if image fits on current page, if not start on new page
          if (doc.y + displayHeight > doc.page.height - 80) {
            doc.addPage();
            doc.x = boxX;
          }
          
          // Add some spacing before image
          doc.moveDown(0.3);
          const currentY = doc.y;
          
          // Add image
          doc.image(imageBuffer, boxX, currentY, {
            width: displayWidth,
            height: displayHeight
          });
          
          doc.y = currentY + displayHeight + 10;
          doc.x = boxX;
        }
      } catch (err) {
        console.error('Failed to embed image:', err.message);
        // Continue without the image
      }
    }
    
    doc.moveDown(0.3);
  }
  
  // Link
  doc.x = boxX;
  doc.fontSize(9)
     .fillColor('#1DA1F2')
     .text(tweet.link, { 
       link: tweet.link,
       underline: true,
       lineGap: 2,
       width: contentWidth
     });
  
  doc.moveDown(0.5);
  doc.x = startX;
}

async function exportUserToPDF(username, options = {}) {
  const outputDir = options.outputDir || process.env.PDF_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const dbPath = options.dbPath || process.env.SCRAPER_DB_PATH;

  console.log(`\n📄 Exporting @${username} to PDF...`);
  
  const db = new ScraperDB(dbPath);
  
  // Order tweets by tweet datetime descending (fallback to scraped_at)
  const tweets = db.getTweetsByUsernameByTimeDesc(username);
  const tweetMetaById = new Map(tweets.map(t => [t.id, t]));
  if (!tweets.length) {
    console.log(`No tweets found for @${username}`);
    db.close();
    return;
  }
  
  console.log(`Found ${tweets.length} tweets`);
  
  // Already ordered oldest->newest by insertion order
  
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Create PDF
  const pdfPath = path.join(outputDir, `${username}_threads.pdf`);
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true
  });
  
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);
  
  // Title page
  doc.fontSize(28)
     .fillColor('#1DA1F2')
     .text(`@${username}`, { align: 'center' });
  
  doc.moveDown(0.5)
     .fontSize(16)
     .fillColor('#657786')
     .text('Twitter Thread Collection', { align: 'center' });
  
  doc.moveDown(0.5)
     .fontSize(12)
     .fillColor('#657786')
     .text(`${tweets.length} tweets • Generated on ${new Date().toLocaleDateString()}`, { align: 'center' });
  
  doc.moveDown(3);

  const tocEntries = [];
  
  let processedCount = 0;
  
  // Process each tweet
  for (const tweet of tweets) {
    const conversationRow = db.getConversation(tweet.id);
    
    if (!conversationRow) {
      continue; // Skip tweets without conversations
    }
    
    const conversation = conversationRow.conversation_json;
    
    processedCount++;
    console.log(`Processing ${processedCount}/${tweets.length}: ${tweet.id}`);
    
    // Generate heading
    const heading = generateHeading(conversation.conversation.root.text);
    
     // Add heading
     addHeading(doc, heading, 1);

    const meta = tweetMetaById.get(conversationRow.root_tweet_id);
    const createdAtText = meta ? formatTweetTimestamp(meta.created_at || meta.scraped_at) : null;

    // Optional: show metadata. Currently skipped per request.
    // doc.fontSize(10)
    //    .fillColor('#657786')
    //    .text(
    //      `Tweet ID: ${conversationRow.root_tweet_id}${createdAtText ? `  •  ${createdAtText}` : ''}`,
    //      { lineGap: 2 }
    //    );
    
    doc.moveDown(0.5);
    
    // Root tweet
    const rootTweet = meta ? { ...conversation.conversation.root, created_at: meta.created_at || meta.scraped_at } : conversation.conversation.root;
    addTweet(doc, rootTweet, 'ROOT TWEET');
    
    // Thread tweets (author's continuation)
    if (conversation.conversation.thread && conversation.conversation.thread.length > 0) {
      doc.moveDown(0.3);
      addHeading(doc, 'Thread', 3);
      
      for (const threadTweet of conversation.conversation.thread) {
        addTweet(doc, threadTweet);
      }
    }
    
    // Replies with author responses (only show if author responded)
    const repliesWithResponses = conversation.conversation.replies.filter(
      r => r.author_responses && r.author_responses.length > 0
    );
    
    if (repliesWithResponses.length > 0) {
      doc.moveDown(0.3);
      addHeading(doc, 'Replies & Responses', 3);
      
      for (const reply of repliesWithResponses) {
        addTweet(doc, reply.tweet, 'REPLY');
        
        // Indent author responses more visibly
        doc.moveDown(0.2);
        const savedX = doc.x;
        doc.x = 80; // More prominent indent
        
        for (const response of reply.author_responses) {
          addTweet(doc, response, '↳ AUTHOR RESPONSE');
        }
        
        doc.x = savedX; // Reset indent
        doc.moveDown(0.3);
      }
    }
    
    // Add separator between conversations (but not after the last one)
    if (processedCount < tweets.length) {
      doc.moveDown(1.5);
      
      // Check if we need a new page for the next conversation
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      } else {
        // Draw separator line if staying on same page
        doc.moveTo(50, doc.y)
           .lineTo(doc.page.width - 50, doc.y)
           .strokeColor('#E1E8ED')
           .lineWidth(1)
           .stroke();
        doc.moveDown(1.5);
      }
    }
  }
  
  doc.end();
  
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
  
  db.close();
  
  console.log(`✅ PDF exported: ${pdfPath}`);
  console.log(`   Conversations: ${processedCount}`);
}

async function exportAllUsers() {
  const db = new ScraperDB();
  const stats = db.getStats();
  db.close();
  
  console.log('📊 Database stats:', stats);
  console.log('\nStarting PDF export...');
  
  // Get unique usernames from database
  const db2 = new ScraperDB();
  const result = db2.db.prepare('SELECT DISTINCT username FROM tweets').all();
  db2.close();
  
  const usernames = result.map(r => r.username);
  
  if (usernames.length === 0) {
    console.log('No users found in database');
    return;
  }
  
  console.log(`Found ${usernames.length} users: ${usernames.join(', ')}\n`);
  
  for (const username of usernames) {
    await exportUserToPDF(username);
  }
  
  console.log('\n✅ All PDFs exported successfully!');
}

// Run if called directly
if (require.main === module) {
  exportAllUsers().catch(console.error);
}

module.exports = { exportUserToPDF, exportAllUsers };
