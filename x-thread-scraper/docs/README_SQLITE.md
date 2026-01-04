# SQLite Migration Guide

## Overview
The scraper now uses SQLite for better scalability and duplicate detection during incremental updates.

## Database Structure

### Tables
1. **tweets** - Stores individual tweets from Phase 1
   - `id` (PRIMARY KEY): Tweet ID
   - `username`: Twitter username
   - `link`: Tweet URL
   - `text`: Tweet content
   - `has_image`: Boolean flag
   - `has_video`: Boolean flag
   - `scraped_at`: Timestamp

2. **conversations** - Stores structured conversations from Phase 2
   - `root_tweet_id` (PRIMARY KEY): ID of the root tweet
   - `username`: Twitter username
   - `conversation_json`: Full conversation structure as JSON
   - `tweet_count`: Number of tweets in conversation
   - `scraped_at`: Initial scrape timestamp
   - `updated_at`: Last update timestamp

3. **scrape_progress** - Tracks scraping progress for resume capability
   - `username` + `phase` (PRIMARY KEY): Composite key
   - `last_index`: Last processed index
   - `last_tweet_id`: Last processed tweet ID
   - `last_run`: Timestamp

## Configuration

### main.js
- `USERNAMES`: Array of Twitter usernames to scrape
- `MAX_TWEETS`: Maximum tweets per user (-1 for unlimited)
- `STOP_ON_DUPLICATES`: Stop after N consecutive duplicates (enables incremental updates)
- `RUN_PHASE_1`: Enable/disable Phase 1 execution
- `RUN_PHASE_2`: Enable/disable Phase 2 execution

## Features

### Duplicate Detection
- Phase 1 now tracks consecutive duplicates
- When `STOP_ON_DUPLICATES` threshold is reached, scraping stops for that user
- Enables efficient incremental updates without re-scraping everything

### Progress Tracking
- Database tracks progress per username and phase
- Automatic resume on failure or interruption
- Phase 2 can resume from last successful conversation

### Data Export
- Use `db.exportToJSON(username)` to export user data to JSON
- Maintains backward compatibility with previous JSON-based workflow

## Usage

### Fresh Scrape
```javascript
const USERNAMES = ['username1', 'username2'];
const MAX_TWEETS = -1; // Get all tweets
const STOP_ON_DUPLICATES = 0; // Disable (use MAX_TWEETS limit)
```

### Incremental Update
```javascript
const USERNAMES = ['username1', 'username2'];
const MAX_TWEETS = -1;
const STOP_ON_DUPLICATES = 15; // Stop after 15 consecutive duplicates
```

### Database Location
- Default: `./database/scraper.db`
- Change in `db.js` constructor if needed

## Database Methods

### ScraperDB Class
- `saveTweet(tweet)`: Save single tweet
- `saveTweetsBatch(tweets)`: Save multiple tweets efficiently
- `tweetExists(id)`: Check if tweet already exists
- `getTweetsByUsername(username)`: Get all tweets for a user
- `saveConversation(rootId, username, conversation)`: Save conversation
- `getConversation(rootId)`: Retrieve conversation
- `getProgress(username, phase)`: Get scraping progress
- `updateProgress(username, phase, index, tweetId)`: Update progress
- `exportToJSON(username)`: Export user data to JSON files
- `getStats()`: Get database statistics

## Migration from JSON

No migration needed! The database starts fresh. Old JSON files in `output/` remain untouched.

To start fresh:
1. Delete `database/scraper.db` if it exists
2. Run the scraper normally
3. Data will be stored in SQLite from now on

## Troubleshooting

### Database locked
- Database uses WAL mode for better concurrency
- If issues persist, ensure no other process is accessing the database

### Missing better-sqlite3
```bash
npm install better-sqlite3
```

### Check database contents
```javascript
const db = new ScraperDB();
const stats = db.getStats();
console.log(stats);
db.close();
```
