# X-Thread Scraper: SQLite Quick Start Guide

## 🚀 Getting Started

### Installation (First Time)
```bash
cd x-thread-scraper
npm install
```

### Configuration
Edit `main.js` to set your target users:
```javascript
const USERNAMES = ['username1', 'username2', 'username3'];
const MAX_TWEETS = 10;                    // Set -1 for unlimited
const STOP_ON_DUPLICATES = 15;            // Enables incremental updates
const RUN_PHASE_1 = true;
const RUN_PHASE_2 = true;
```

### Run the Scraper
```bash
npm start
```

The scraper will:
1. ✅ Launch a Brave browser with your X session
2. ✅ Phase 1: Scrape tweets from each user's timeline → Database
3. ✅ Phase 2: Extract full conversations → Database

## 📊 Understanding the Database

### Where is the data stored?
- **Location**: `./database/scraper.db` (SQLite file)
- **Size**: Typically small (~50KB per 1000 tweets)
- **Format**: SQLite (can be inspected with any SQLite viewer)

### Tables
1. **tweets** - Individual tweets from Phase 1 scraping
2. **conversations** - Full conversation threads from Phase 2
3. **scrape_progress** - Tracks where scraping left off

## 🔄 Incremental Updates

The scraper now supports smart incremental updates!

### How it works:
1. Scraper loads existing tweets from database
2. Scrolls through timeline looking for new tweets
3. Stops after finding 15 consecutive duplicates (configurable)
4. Only new tweets are added to database

### To enable:
```javascript
const STOP_ON_DUPLICATES = 15;  // Stop after 15 duplicates
const MAX_TWEETS = -1;           // Don't use tweet limit
```

### To disable (full rescan):
```javascript
const STOP_ON_DUPLICATES = 0;   // Disabled
const MAX_TWEETS = 500;          // Use tweet limit instead
```

## 🧪 Testing

### Test the database
```bash
node test-db.js
```

This will:
- Create test data
- Verify all database operations
- Show database statistics
- Clean up test data

## 📁 File Structure
```
x-thread-scraper/
├── main.js                              # Entry point
├── phase1_timeline.js                   # Tweet collection (updated)
├── phase2_resolve_conversations.js      # Conversation extraction (updated)
├── db.js                               # ✨ NEW: SQLite database layer
├── utils.js                            # Utility functions
├── test-db.js                          # ✨ NEW: Database tests
├── database/
│   └── scraper.db                      # ✨ NEW: SQLite database file
├── README_SQLITE.md                    # ✨ NEW: Detailed SQLite docs
├── MIGRATION_COMPLETE.md               # ✨ NEW: Migration summary
├── output/                             # Old JSON files (optional)
└── pw-profile/                         # Brave browser profile
```

## 🔍 Viewing the Data

### Option 1: Using JavaScript
```javascript
const ScraperDB = require('./db');
const db = new ScraperDB();

// Get stats
console.log(db.getStats());

// Get tweets for a user
const tweets = db.getTweetsByUsername('username');
console.log(`${tweets.length} tweets found`);

// Get conversation
const conv = db.getConversation('tweet_id');
console.log(JSON.stringify(conv, null, 2));

db.close();
```

### Option 2: SQLite CLI
```bash
# Install SQLite (if needed)
brew install sqlite3

# Open database
sqlite3 database/scraper.db

# List tables
.tables

# View tweets
SELECT id, username, text FROM tweets LIMIT 5;

# View progress
SELECT * FROM scrape_progress;

# Exit
.quit
```

### Option 3: SQLite GUI Tools
- [DB Browser for SQLite](https://sqlitebrowser.org/)
- [Beekeeper Studio](https://www.beekeeperstudio.io/)
- VS Code: SQLite extension

## ⚙️ Advanced Configuration

### Scraper Limits
```javascript
const MAX_TWEETS = 100;         // Stop after 100 tweets per user
const MAX_TWEETS = -1;          // Get all available tweets
```

### Duplicate Detection
```javascript
const STOP_ON_DUPLICATES = 15;  // Stop after 15 consecutive duplicates
const STOP_ON_DUPLICATES = 0;   // Disable (use MAX_TWEETS instead)
```

### Run Only Phase 1 or Phase 2
```javascript
const RUN_PHASE_1 = true;       // Collect tweets
const RUN_PHASE_2 = false;      // Skip conversations

// Or:
const RUN_PHASE_1 = false;      // Skip collection
const RUN_PHASE_2 = true;       // Only extract conversations
```

## 🐛 Troubleshooting

### "Not logged into X"
- The scraper couldn't log in to Twitter/X
- Solution: Manually log in using the opened browser window

### Database locked error
- Another process is using the database
- Solution: Close any other scripts using the database

### No tweets found
- Might be a network issue or rate limit
- Solution: Check your internet connection, wait, and retry

### Conversations not extracted
- Make sure Phase 1 completed first (should have tweets in database)
- Check database stats: `node test-db.js`

## 📈 Monitoring Progress

The scraper logs progress to console:
```
[PHASE 1] Starting timeline scrape
[PHASE 1] Loaded 45 tweets from database
[PHASE 1] Added 3 tweets (total 48)
[PHASE 1] ✔ 48 total tweets

[PHASE 2] (1/48) Processing: https://x.com/...
[PHASE 2] ✔ Collected 12 tweets: @username1(5), @username2(7)
```

## 🔐 Privacy & Security

- Database is local (no cloud storage)
- Browser session is saved in `pw-profile/`
- No API keys or credentials stored
- You remain fully in control of your data

## 📚 More Documentation

- `README_SQLITE.md` - Detailed SQLite configuration
- `MIGRATION_COMPLETE.md` - Technical migration details
- Database methods - See `db.js` for all available operations

## 💡 Pro Tips

1. **Efficient updates**: Use `STOP_ON_DUPLICATES = 15` for daily incremental scrapes
2. **Full syncs**: Set `STOP_ON_DUPLICATES = 0` and `MAX_TWEETS = 10000` for complete history
3. **Multiple users**: Run with array of usernames in `USERNAMES`
4. **Export data**: Use `db.exportToJSON(username)` for backward compatibility

## 🆘 Need Help?

1. Check `MIGRATION_COMPLETE.md` for technical details
2. Review `db.js` for database method documentation
3. Run `node test-db.js` to verify setup
4. Check browser console in opened window for errors

---

**Happy scraping!** 🎉
