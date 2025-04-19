import os
import requests
from bs4 import BeautifulSoup

# Function to create a local folder
def create_folder(folder_name):
    if not os.path.exists(folder_name):
        os.makedirs(folder_name)

# Function to download an audio file
def download_audio_file(url, folder, total_files, file_index):
    local_filename = os.path.join(folder, url.split("/")[-1])
    try:
        with requests.get(url, stream=True) as response:
            if response.status_code == 200:
                with open(local_filename, 'wb') as file:
                    for chunk in response.iter_content(chunk_size=8192):
                        file.write(chunk)
                print(f"[{file_index}/{total_files}] Successfully downloaded: {local_filename}")
            else:
                print(f"[{file_index}/{total_files}] Failed to download: {url} (HTTP {response.status_code})")
    except Exception as e:
        print(f"[{file_index}/{total_files}] Error downloading {url}: {e}")

# Function to scrape audio links and download them
def scrape_and_download_audio(webpage_url, subfolder_name, main_folder):
    print(f"Accessing webpage: {webpage_url}")
    response = requests.get(webpage_url)
    if response.status_code != 200:
        print(f"Failed to access webpage: {webpage_url} (HTTP {response.status_code})")
        return

    soup = BeautifulSoup(response.content, 'html.parser')

    # Find all audio file links (assuming .mp3 extensions)
    audio_links = [a['href'] for a in soup.find_all('a', href=True) if a['href'].endswith(('.mp3', '.wav', '.m4a'))]

    if not audio_links:
        print("No audio files found on the webpage.")
        return

    # Create a subfolder path based on the map key
    subfolder_path = os.path.join(main_folder, subfolder_name)
    create_folder(subfolder_path)

    total_files = len(audio_links)
    print(f"Found {total_files} audio files. Starting download into folder: {subfolder_path}")

    for index, link in enumerate(audio_links, start=1):
        # Build absolute URL if necessary
        if not link.startswith("http"):
            link = requests.compat.urljoin(webpage_url, link)
        print(f"Downloading file {index}/{total_files}: {link}")
        download_audio_file(link, subfolder_path, total_files, index)

    print(f"Downloads completed for {webpage_url} into folder: {subfolder_path}")

# Main script
if __name__ == "__main__":
    # Map of folder names to webpage URLs
    webpage_urls = {
        # "Gaura Krishna Das/Sampurna Bhagavatam": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Gaur_Krishna_Das_Goswami%2FHindi_Lectures%2FSeminars%2FSampurna_Bhagavatam",
        # Add more folder-name: URL pairs as needed
        # "RGS/Canto 1 - Bhishma Stuti": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FBhisma_Stuti",
        # "RGS/Canto 10 - Janma Lila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FAdvent_of_Lord_Krishna",
        # "RGS/Canto 10 - Akrura Milan": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FAkrura_milan",
        # "RGS/Canto 10 - Bhramar Gita": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FBhramar_Geet",
        # "RGS/Canto 10 - Brahma Vimohana": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FBramha_Vimohana",
        # "RGS/Canto 10 - Damodara Lila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FDamodar_lila",
        # "RGS/Canto 10 - Davagani Paan": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FDwagni_paan_leela",
        # "RGS/Canto 10 - Giriraja Dharan": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FGiriraj_Dharan_Lila",
        # "RGS/Grhastha Dharma": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FGrihasthi_Dharama",
        # "RGS/Canto 10 - Gocharan Leela": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FGocharan_Leela_-_2006",
        # "RGS/Canto 10 - Kaliya Daman": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FKaliya_daman",
        # "RGS/Canto 3 - Kaplia-Devahuti": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FKapila_and_Devahuti_katha",
        # "RGS/Canto 1 - Kunti Stuti": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FKunti_Stuti_2002",
        # "RGS/CC - Rupa Shiksha": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FRupa_Siskhya",
        # "RGS/Canto 10 - Uddhav Sandesh": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FUddhav_Sandesh",
        # "RGS/Canto 10 - Vatsalya Lila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FVatsalya_Lila",
        # "RGS/Canto 10 - Vrindavan Vihar Gita": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FVrindavan_Vihar_lila",
        # "RGS/CC - Gaura Katha": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FGaur_Katha%2F2007",
        # "MNS/Rasa Lila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F18_-_Rasalila_Katha%2FKartika_Masa_Katha_2012",
        # "BJP/CC - Advait Acharya": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSri_Caitanya_Bhagavat%2FAdvaita_Acarya",
        # "BJP/CC - Jaghai Madhai": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSri_Caitanya_Bhagavat%2FJagai_and_Madhai",
        # "BJP/CC - Nityananda Meets Chaitanya": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSri_Caitanya_Bhagavat%2FNityananda_meets_Caitanya",
        # "BJP/CC - Srivasa Thakura": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSri_Caitanya_Bhagavat%2FSrivas_Thakura",
        # "BJP/Art of Teaching": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FArt_of_Teaching",
        # "BJP/BG/Chapter 1": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-01",
        # "BJP/BG/Chapter 2": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-02",
        # "BJP/BG/Chapter 3": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-03",
        # "BJP/BG/Chapter 4": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-04",
        # "BJP/BG/Chapter 5": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-05",
        # "BJP/BG/Chapter 6": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-06",
        # "BJP/BG/Chapter 7": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-07",
        # "BJP/BG/Chapter 8": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-08",
        # "BJP/BG/Chapter 9": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhagavad_Gita_lectures_verse_wise%2FChapter-09",
        # "BJP/Bhakti Shastri/NoD": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhakti_Sastri_Course%2FNectar_of_Devotion",
        # "BJP/Bhakti Shastri/NoI": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhakti_Sastri_Course%2FNectar_of_Instructions",
        # "BJP/BG Overview": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FBhakti_Sastri_Course%2FBhagavad_Gita_overview",
        # "BJP/SB/Canto 1": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-01",
        # "BJP/SB/Canto 3": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-03",
        # "BJP/SB/Canto 4": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-04",
        # "BJP/SB/Canto 5": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-05",
        # "BJP/SB/Canto 7": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-07",
        # "BJP/SB/Canto 9": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-09",
        # "BJP/SB/Canto 10": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-10",
        # "BJP/SB/Canto 11": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-11",
        # "BJP/SB/Canto 12": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam%2FCanto-12",
        # "BJP/SB Overview/Canto 1": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-01",
        # "BJP/SB Overview/Canto 2": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-02",
        # "BJP/SB Overview/Canto 3": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-03",
        # "BJP/SB Overview/Canto 4": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-04",
        # "BJP/SB Overview/Canto 5": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-05",
        # "BJP/SB Overview/Canto 6": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-06",
        # "BJP/SB Overview/Canto 7": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-07",
        # "BJP/SB Overview/Canto 8": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-08",
        # "BJP/SB Overview/Canto 9": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-09",
        # "BJP/SB Overview/Canto 10": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FSrimad_Bhagavatam_Overview%2FCanto-10",
        # "BJP/Misc": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu",
        # "BJP/Krishna Book": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FKrishna_Book",
        # "BJP/NoI": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Bhurijana_Prabhu%2FNectar_of_Instruction"
        # "Aindra Das": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F03_-_ISKCON_Prabhujis%2FISKCON_Prabhujis_-_A_to_J%2FHis_Grace_Aindra_Prabhu%2FBhajans%2FOthers",
        # "RGS/SB/Canto 10 Misc": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F04_-_Srimad_Bhagavatam_Lectures%2FCanto-10", 
        # "RGS/CC/Sanatan Shiksha" : "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F02_-_Chaitanya_Charitamrita%2F06_-_Sanatan_Siksha-CC_Madhya_Lila_22",
        # "RGS/Canto 10.41-45 - Mathura Lila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F01_-_Srimad_Bhagavatam_Katha%2FCanto-10%2F38_-_Mathura_Leela-SB_10-41-45_-_2008_Haridwar",
        # "RGS/Canto 10.29 - Pranay Geeta": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F01_-_Srimad_Bhagavatam_Katha%2FCanto-10%2F30_-_Pranaya_Geet-SB_10-29_-_Vrindavan",
        # "RGS/Canto 6 - Ajamila": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FAjamila_Katha_-_2004",
        # "RGS/Canto 8 - Bali Maharaja": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FBali_Maharaj_-_2006_Noida",
        # "RGS/CC/Sannyasa": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FChaitanya_sanyasa",
        # "RGS/Canto 10 - Dwarka Leela": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FDwarka_leela",
        # "RGS/Canto 8 - Gajendra Moksha": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FGajendra_moksha",
        # "RGS/Canto 7/Prahalad Maharaja": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FPrahalad_Maharaj",
        # "RGS/Canto 11/24 Gurus": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2FTwenty_Four_Gurus",
        # "RGS/Canto 8.5-12/Samdhra Manthan": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F01_-_Srimad_Bhagavatam_Katha%2FCanto-08%2F07_-_Samundra_Mantha_Leela-SB_08-05-12_-_Bhubaneshwar",
        # "RGS/Canto 5.7-14": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_R_to_Y%2FHis_Holiness_Radha_Govinda_Swami%2F00_-_Canto-Wise_Katha%2F01_-_Srimad_Bhagavatam_Katha%2FCanto-05%2FBharat_Maharaj_ki_Katha-SB_05-07-14_-_2003_ISKCON_Juhu",
        # "MNS/Ekadashi": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F04_-_Ekadashi_Vratas",
        # "MNS/Radha Rasa Sudha Nidhi 1": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F12_-_Radha_Rasa_Sudha_Nidhi_-_1",
        # "MNS/Radha Rasa Sudha Nidhi 2": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F12_-_Radha_Rasa_Sudha_Nidhi_-_2",
        # "MNS/Radha Rasa Sudha Nidhi 3": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F12_-_Radha_Rasa_Sudha_Nidhi_-_3",
        # "MNS/Shiva Tattva": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F08_-_Shiva_Tattva",
        # "MNS/Vrindavan Mahimamrita 1": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F18_-_Vrindavan_Mahimamrta_Part_01",
        "MNS/Vrindavan Mahimamrita 2": "https://audio.iskcondesiretree.com/index.php?q=f&f=%2F02_-_ISKCON_Swamis%2FISKCON_Swamis_-_D_to_P%2FHis_Holiness_Mahanidhi_Swami%2F18_-_Vrindavan_Mahimarita_Part-02",
    }

    # Main folder to save all downloaded audio files
    main_download_folder = "downloaded_audios"
    create_folder(main_download_folder)

    for folder_name, webpage_url in webpage_urls.items():
        scrape_and_download_audio(webpage_url, folder_name, main_download_folder)
