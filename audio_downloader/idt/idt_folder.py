import os
import requests
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = "https://audio.iskcondesiretree.com"
ROOT_URL = "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_A_to_C%2FHis_Holiness_Bhakti_Tirtha_Swami"

# Create a directory to save downloads
DOWNLOAD_DIR = "downloads"
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

# Function to download a file
def download_file(url, file_path):
    if os.path.exists(file_path):
        print(f"File already exists, skipping: {file_path}")
        return

    try:
        print(f"Downloading: {file_path}")
        response = requests.get(url, stream=True)
        response.raise_for_status()

        with open(file_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        print(f"Downloaded: {file_path}")
    except requests.RequestException as e:
        print(f"Failed to download {url}: {e}")

# Function to scrape a folder recursively
# Function to scrape a folder recursively
def scrape_folder(url, local_dir):
    try:
        response = requests.get(url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")

        # Find all table rows
        rows = soup.find_all("tr")
        for row in rows:
            third_td = row.select_one("td:nth-of-type(3)")
            if not third_td:
                continue

            link = third_td.find("a")
            if not link:
                continue

            href = link.get("href")
            if not href:
                continue

            if "index.php?q=f" in href:  # Folder
                folder_name = link.text.strip()
                new_local_dir = os.path.join(local_dir, folder_name)
                os.makedirs(new_local_dir, exist_ok=True)

                folder_url = f"{BASE_URL}/{href}"
                scrape_folder(folder_url, new_local_dir)

            elif href.endswith(".mp3") or "index.php?q=m" in href:  # File
                # Ensure the full URL for the MP3 file
                file_url = href if href.startswith("http") else f"{BASE_URL}/{href}"
                file_name = os.path.basename(file_url.split("?")[0])  # Extract filename
                file_path = os.path.join(local_dir, file_name)

                download_file(file_url, file_path)

    except requests.RequestException as e:
        print(f"Failed to scrape {url}: {e}")


# Main execution
def main():
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = []
        # Start scraping from the root URL
        futures.append(executor.submit(scrape_folder, ROOT_URL, DOWNLOAD_DIR))

        for future in as_completed(futures):
            future.result()

if __name__ == "__main__":
    main()
