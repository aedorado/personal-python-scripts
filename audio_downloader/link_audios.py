import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

# Dictionary containing the retreat title as the key and URLs as values
audio_files = {
    "SNS 2024": [
        "https://www.saranagati-library.net/2024.11.25_SSNS-others_Holy-Name-Retreat7--Closing-of-the-Retreat_GRC_EN.mp3",
        "https://www.saranagati-library.net/2024.11.24_SSNS_Holy-Name-Retreat6--Learning-to-Chant-with-Devotion3_GRC_EN.mp3",
        "https://www.saranagati-library.net/2024.11.23_SSNS-others_Holy-Name-Retreat5--64-Rounds-Day-Inspiration_TK_EN.mp3",
        # Add more URLs as needed...
    ]
}

# Function to download a single file
def download_audio(url, folder):
    filename = os.path.basename(url.split("?")[0])  # Remove query parameters
    file_path = os.path.join(folder, filename)
    
    print(f"  Starting download: {filename}")
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()  # Raise HTTPError for bad responses

        # Save the file
        with open(file_path, "wb") as file:
            for chunk in response.iter_content(chunk_size=8192):
                file.write(chunk)

        print(f"  Completed: {filename}")
    except requests.exceptions.RequestException as e:
        print(f"  Failed to download {filename}: {e}")

# Function to download files for a specific category
def download_category(category_name, urls):
    print(f"\nStarting downloads for category: {category_name}")
    folder_path = category_name  # Use the dictionary key as the folder name
    os.makedirs(folder_path, exist_ok=True)  # Create the folder if it doesn't exist
    
    with ThreadPoolExecutor(max_workers=7) as executor:  # Up to 7 threads for this category
        futures = [executor.submit(download_audio, url, folder_path) for url in urls]
        for future in as_completed(futures):
            future.result()  # Wait for all threads to complete

    print(f"Completed downloads for category: {category_name}")

# Main execution
if __name__ == "__main__":
    print("Starting all downloads...\n")
    
    # Start threads for categories
    with ThreadPoolExecutor(max_workers=7) as executor:
        futures = [executor.submit(download_category, category, urls) 
                   for category, urls in audio_files.items()]
        for future in as_completed(futures):
            future.result()  # Ensure all category downloads complete

    print("\nAll downloads completed successfully!")
