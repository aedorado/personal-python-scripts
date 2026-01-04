const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function log(section, msg) {
  console.log(`[${section}] ${msg}`);
}

function saveJSON(file, data) {
  ensureOutputDir();
  const filePath = path.join(OUTPUT_DIR, file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadJSON(file, fallback) {
  const filePath = path.join(OUTPUT_DIR, file);
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  return fallback;
}

function extractTweetId(url) {
  if (!url) return null;
  const match = url.match(/status\/(\d+)/);
  return match ? match[1] : null;
}

module.exports = {
  sleep,
  log,
  saveJSON,
  loadJSON,
  extractTweetId
};
