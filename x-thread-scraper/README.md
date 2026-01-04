# X Thread Scraper

A Playwright-based scraper for Twitter/X threads with SQLite storage and PDF export capabilities.

## 📁 Project Structure

```
x-thread-scraper/
├── main.js                    # Entry point - orchestrates scraping
├── package.json              # Dependencies and scripts
├── playwright.config.js      # Playwright configuration
│
├── src/
│   ├── scrapers/             # Scraping logic
│   │   ├── phase1_timeline.js          # Timeline tweet collection
│   │   ├── phase2_resolve_conversations.js  # Thread & reply extraction (with images)
│   │   ├── utils.js                    # Logging and utilities
│   │   └── scrape.js                   # Additional scraping helpers
│   │
│   ├── database/             # Database management
│   │   └── db.js             # SQLite operations & schema
│   │
│   └── export/               # Export functionality
│       └── export-pdf.js     # PDF generation with embedded images
│
├── tests/                    # Test scripts
│   ├── test-db.js           # Database functionality tests
│   └── test-image-extraction.js  # Image extraction tests
│
├── docs/                     # Documentation
│   ├── README_SQLITE.md     # SQLite migration details
│   ├── QUICKSTART.md        # Quick start guide
│   ├── START_HERE.md        # Getting started
│   └── STATUS_REPORT.md     # Project status
│
├── samples/                  # Sample DOM structures
│   ├── xdomsample.html      # Example tweet DOM
│   └── xdomsample2.html     # Example with images
│
├── fonts/                    # Font files
│   └── NotoSansDevanagari-Regular.ttf  # Devanagari support
│
├── database/                 # SQLite database (auto-created)
│   └── scraper.db           # Main database
│
├── output/                   # Generated files (auto-created)
│   └── {username}_threads.pdf
│
└── pw-profile/              # Playwright browser profile
```

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Run Scraper
```bash
npm start
```

### Export to PDF
```bash
npm run export-pdf
```

### Run Tests
```bash
npm test
```

## 📊 Features

- ✅ **Multi-user scraping** - Configure multiple Twitter usernames
- ✅ **SQLite database** - Efficient storage with better-sqlite3
- ✅ **Image extraction** - Downloads and stores images as base64
- ✅ **PDF export** - Professional PDFs with embedded images
- ✅ **Devanagari support** - Proper rendering of Devanagari script
- ✅ **Thread preservation** - Maintains complete conversation structure
- ✅ **Incremental updates** - STOP_ON_DUPLICATES prevents re-scraping

## 🗄️ Database Schema

### Tables
- **tweets** - Basic tweet information
- **conversations** - Full thread structure with images stored as JSON
- **scrape_progress** - Tracks scraping progress per user

### Conversation JSON Structure
```javascript
{
  root_tweet: { id, author, link, text, timestamp, images: [] },
  thread: [ { id, author, link, text, timestamp, images: [] } ],
  replies: [
    {
      tweet: { id, author, link, text, timestamp, images: [] },
      author_responses: [ { id, author, link, text, timestamp, images: [] } ]
    }
  ]
}
```

## ⚙️ Configuration

Edit `main.js`:
```javascript
const USERNAMES = ['username1', 'username2'];
const MAX_TWEETS = 10;
const STOP_ON_DUPLICATES = 15;
```

## 📝 Notes

- Images are stored as base64 data URIs within the conversation JSON
- Only replies with author responses are saved to reduce noise
- PDF export includes proper Devanagari font rendering
- Browser profile persists login state in `pw-profile/`

## 📚 More Documentation

See the `docs/` folder for detailed guides:
- [SQLite Migration](docs/README_SQLITE.md)
- [Quick Start Guide](docs/QUICKSTART.md)
- [Getting Started](docs/START_HERE.md)
