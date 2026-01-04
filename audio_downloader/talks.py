import csv
import os
import sqlite3
import subprocess
import threading
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm


# ------------------------------
# CONFIG BASED ON ARGUMENT
# ------------------------------
def get_config(arg):
    """
    Return configuration settings depending on argument (e.g., hpd)
    """
    config = {
        "CSV_FILE": "talks.csv",
        "OUTPUT_ROOT": "Downloads",
        "DB_FILE": "downloads.db",
        "THREADS": 2,
        "AUDIO_FORMAT": "mp3",       # smaller + clear
        "AUDIO_QUALITY": "5",         # ~96 kbps, ~40–60MB/hour
    }

    if arg == "hpd":
        config.update({
            "CSV_FILE": "talks - HPD.csv",
            "OUTPUT_ROOT": "Downloads_hpd",
            "DB_FILE": "downloads_hpd.db",
            "THREADS": 3,
        })
    elif arg == "rrd":
        config.update({
            "CSV_FILE": "talks - RRD.csv",
            "OUTPUT_ROOT": "Downloads_rrd",
            "DB_FILE": "downloads_rrd.db",
            "THREADS": 4,
        })
    # You can add more profiles below:
    # elif arg == "xyz":
    #     config.update({...})

    return config


# ------------------------------
# ARGUMENT HANDLING
# ------------------------------
if len(sys.argv) < 2:
    print("⚠️  Usage: python download_script.py [profile]")
    print("   e.g.  python download_script.py hpd")
    sys.exit(1)

profile = sys.argv[1].lower()
cfg = get_config(profile)

CSV_FILE = cfg["CSV_FILE"]
OUTPUT_ROOT = cfg["OUTPUT_ROOT"]
DB_FILE = cfg["DB_FILE"]
THREADS = cfg["THREADS"]
AUDIO_FORMAT = cfg["AUDIO_FORMAT"]
AUDIO_QUALITY = cfg["AUDIO_QUALITY"]
COOKIES_FILE = "www.youtube.com_cookies.txt"
MAX_RETRIES = 3


# ------------------------------
# DATABASE FUNCTIONS
# ------------------------------
def init_db():
    conn = sqlite3.connect(DB_FILE, check_same_thread=False)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS downloaded (
            url TEXT PRIMARY KEY,
            title TEXT,
            folder TEXT,
            status TEXT DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    return conn


def already_downloaded(conn, url):
    cur = conn.cursor()
    cur.execute("SELECT status FROM downloaded WHERE url = ?", (url,))
    row = cur.fetchone()
    if row and row[0] == "done":
        return True
    return False


def mark_status(conn, url, title, folder, status):
    conn.execute(
        "INSERT OR REPLACE INTO downloaded (url, title, folder, status, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
        (url, title, folder, status)
    )
    conn.commit()


# ------------------------------
# DOWNLOAD FUNCTION
# ------------------------------
lock = threading.Lock()

def download_audio(row, conn, pbar):
    url = row["link"].strip()
    folder = row["folder"].strip()
    title = row["title_updated"].strip()

    with lock:
        if already_downloaded(conn, url):
            pbar.write(f"⏭️  Skipping (already done): {title}")
            pbar.update(1)
            return

    output_dir = os.path.join(OUTPUT_ROOT, folder)
    os.makedirs(output_dir, exist_ok=True)

    safe_title = "".join(c for c in title if c not in r'\/:*?"<>|').strip()
    output_template = os.path.join(output_dir, f"{safe_title}.%(ext)s")

    cmd = [
        "yt-dlp",
        "--cookies-from-browser", "chrome",
        "--no-playlist",
        "--format", "bestaudio/best",
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5",
        "--sleep-interval", "5", "--max-sleep-interval", "15",   # ✅ avoid rate-limit
        "--retries", "3",
        "--fragment-retries", "3",
        "--external-downloader", "aria2c",
        "--external-downloader-args", "-x 8 -s 8 -k 1M",
        "--no-overwrites",
        "--quiet", "--no-warnings",
        "-o", output_template,
        url
    ]



    success = False
    for attempt in range(1, MAX_RETRIES + 1):
        start = time.time()
        try:
            result = subprocess.run(
                cmd + [url],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            duration = time.time() - start
            with lock:
                mark_status(conn, url, title, folder, "done")
                pbar.write(f"✅ [{attempt}/{MAX_RETRIES}] Done ({duration:.1f}s): {title}")
                pbar.update(1)
            success = True
            break
        except subprocess.CalledProcessError as e:
            elapsed = time.time() - start
            stderr_lines = e.stderr.strip().splitlines()
            err_summary = next(
                (l.strip() for l in stderr_lines if "ERROR:" in l or "ExtractorError" in l),
                stderr_lines[-1] if stderr_lines else "Unknown error"
            )
            with lock:
                pbar.write(f"⚠️  [{attempt}/{MAX_RETRIES}] Failed ({elapsed:.1f}s): {title}")
                pbar.write(f"   ↳ Reason: {err_summary}")
            time.sleep(3)

    if not success:
        with lock:
            mark_status(conn, url, title, folder, "failed")
            pbar.write(f"❌ Gave up after {MAX_RETRIES} attempts: {title}")
            pbar.update(1)


# ------------------------------
# MAIN
# ------------------------------
def main():
    conn = init_db()

    # Read CSV
    with open(CSV_FILE, newline='', encoding='utf-8') as f:
        all_rows = list(csv.DictReader(f))

    # Filter out completed
    rows = [r for r in all_rows if not already_downloaded(conn, r["link"])]

    total = len(rows)
    print(f"\n📊 Total new/failed to process: {total}")
    if total == 0:
        print("🎉 Everything already done!")
        conn.close()
        return

    # Threaded downloading with progress bar
    with tqdm(total=total, desc=f"📥 Download Progress ({profile})", ncols=100) as pbar:
        with ThreadPoolExecutor(max_workers=THREADS) as executor:
            futures = [executor.submit(download_audio, row, conn, pbar) for row in rows]
            for _ in as_completed(futures):
                pass

    conn.close()
    print("\n✅ All downloads processed.\n")


if __name__ == "__main__":
    main()
