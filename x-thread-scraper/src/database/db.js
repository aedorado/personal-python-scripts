const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DEFAULT_DB_DIR = path.join(__dirname, '../../database');
const DEFAULT_DB_PATH = path.join(DEFAULT_DB_DIR, 'scraper.db');

// Ensure database directory exists (default only; custom paths handled in constructor)
if (!fs.existsSync(DEFAULT_DB_DIR)) {
  fs.mkdirSync(DEFAULT_DB_DIR, { recursive: true });
}

class ScraperDB {
  constructor(dbPath = process.env.SCRAPER_DB_PATH || DEFAULT_DB_PATH) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL'); // Better performance
    this.initSchema();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tweets (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        link TEXT NOT NULL,
        text TEXT,
        created_at TEXT,
        has_image INTEGER DEFAULT 0,
        has_video INTEGER DEFAULT 0,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tweets_username ON tweets(username);
      CREATE INDEX IF NOT EXISTS idx_tweets_scraped_at ON tweets(scraped_at DESC);

      CREATE TABLE IF NOT EXISTS conversations (
        root_tweet_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        conversation_json TEXT NOT NULL,
        tweet_count INTEGER DEFAULT 0,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_username ON conversations(username);

      CREATE TABLE IF NOT EXISTS scrape_progress (
        username TEXT NOT NULL,
        phase TEXT NOT NULL,
        last_index INTEGER DEFAULT 0,
        last_tweet_id TEXT,
        last_run TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (username, phase)
      );
    `);

    // Add created_at column to tweets if migrating an existing DB
    const hasCreatedAt = this.db.prepare(`PRAGMA table_info(tweets);`).all()
      .some(col => col.name === 'created_at');
    if (!hasCreatedAt) {
      this.db.exec(`ALTER TABLE tweets ADD COLUMN created_at TEXT;`);
    }

    // Ensure index exists after column is present (avoids errors on legacy DBs)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);`);
  }

  // ============ TWEETS ============

  saveTweet(tweet) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tweets (id, username, link, text, created_at, has_image, has_video)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      tweet.id,
      tweet.username,
      tweet.link,
      tweet.text,
      tweet.created_at || null,
      tweet.has_image ? 1 : 0,
      tweet.has_video ? 1 : 0
    );
  }

  saveTweetsBatch(tweets) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO tweets (id, username, link, text, created_at, has_image, has_video)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insert = this.db.transaction((tweetList) => {
      for (const tweet of tweetList) {
        stmt.run(
          tweet.id,
          tweet.username,
          tweet.link,
          tweet.text,
          tweet.created_at || null,
          tweet.has_image ? 1 : 0,
          tweet.has_video ? 1 : 0
        );
      }
    });

    insert(tweets);
  }

  getTweet(id) {
    const stmt = this.db.prepare('SELECT * FROM tweets WHERE id = ?');
    return stmt.get(id);
  }

  tweetExists(id) {
    const stmt = this.db.prepare('SELECT 1 FROM tweets WHERE id = ? LIMIT 1');
    return stmt.get(id) !== undefined;
  }

  getTweetsByUsername(username, limit = null) {
    let sql = 'SELECT * FROM tweets WHERE username = ? ORDER BY scraped_at DESC';
    if (limit) sql += ` LIMIT ${limit}`;
    const stmt = this.db.prepare(sql);
    return stmt.all(username);
  }

  // Order tweets by tweet datetime (created_at) descending; fallback to scraped_at when missing
  getTweetsByUsernameByTimeDesc(username, limit = null) {
    let sql = `
      SELECT * FROM tweets
      WHERE username = ?
      ORDER BY 
        COALESCE(created_at, scraped_at) DESC,
        scraped_at DESC,
        rowid DESC
    `;
    if (limit) sql += ` LIMIT ${limit}`;
    const stmt = this.db.prepare(sql);
    return stmt.all(username);
  }

  // Preserve insertion order (rowid asc) when needed, e.g., for stable PDF export
  getTweetsByUsernameInOrder(username, limit = null) {
    let sql = 'SELECT * FROM tweets WHERE username = ? ORDER BY rowid ASC';
    if (limit) sql += ` LIMIT ${limit}`;
    const stmt = this.db.prepare(sql);
    return stmt.all(username);
  }

  getTweetCount(username) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM tweets WHERE username = ?');
    return stmt.get(username).count;
  }

  getAllTweetIds(username) {
    const stmt = this.db.prepare('SELECT id FROM tweets WHERE username = ? ORDER BY scraped_at DESC');
    return stmt.all(username).map(row => row.id);
  }

  // ============ CONVERSATIONS ============

  saveConversation(rootTweetId, username, conversationData) {
    const conversationJson = JSON.stringify(conversationData);
    
    // Count total tweets in conversation
    const tweetCount = 
      1 + // root
      conversationData.conversation.thread.length +
      conversationData.conversation.replies.length +
      conversationData.conversation.replies.reduce((sum, r) => sum + r.author_responses.length, 0);

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO conversations (root_tweet_id, username, conversation_json, tweet_count, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(rootTweetId, username, conversationJson, tweetCount);
  }

  getConversation(rootTweetId) {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE root_tweet_id = ?');
    const row = stmt.get(rootTweetId);
    if (row) {
      return {
        ...row,
        conversation_json: JSON.parse(row.conversation_json)
      };
    }
    return null;
  }

  conversationExists(rootTweetId) {
    const stmt = this.db.prepare('SELECT 1 FROM conversations WHERE root_tweet_id = ? LIMIT 1');
    return stmt.get(rootTweetId) !== undefined;
  }

  getConversationsByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM conversations WHERE username = ? ORDER BY scraped_at DESC');
    const rows = stmt.all(username);
    return rows.map(row => ({
      ...row,
      conversation_json: JSON.parse(row.conversation_json)
    }));
  }

  getConversationCount(username) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM conversations WHERE username = ?');
    return stmt.get(username).count;
  }

  // ============ PROGRESS ============

  getProgress(username, phase) {
    const stmt = this.db.prepare('SELECT * FROM scrape_progress WHERE username = ? AND phase = ?');
    return stmt.get(username, phase) || { last_index: 0, last_tweet_id: null };
  }

  updateProgress(username, phase, data) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO scrape_progress (username, phase, last_index, last_tweet_id, last_run)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(username, phase, data.last_index || 0, data.last_tweet_id || null);
  }

  // ============ UTILITIES ============

  exportToJSON(username, phase) {
    const outputDir = path.join(__dirname, '../../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (phase === 'phase1') {
      const tweets = this.getTweetsByUsername(username);
      const filePath = path.join(outputDir, `${username}_tweets.phase1.json`);
      fs.writeFileSync(filePath, JSON.stringify(tweets, null, 2));
      return filePath;
    } else if (phase === 'phase2') {
      const conversations = this.getConversationsByUsername(username);
      const filePath = path.join(outputDir, `${username}_conversations.json`);
      fs.writeFileSync(filePath, JSON.stringify(conversations, null, 2));
      return filePath;
    }
  }

  getStats(username = null) {
    if (username) {
      return {
        username,
        tweet_count: this.getTweetCount(username),
        conversation_count: this.getConversationCount(username)
      };
    }

    // All users stats
    const stmt = this.db.prepare(`
      SELECT 
        username,
        COUNT(*) as tweet_count
      FROM tweets
      GROUP BY username
    `);
    return stmt.all();
  }

  close() {
    this.db.close();
  }
}

module.exports = ScraperDB;
