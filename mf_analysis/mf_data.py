import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# List of URLs
urls = [
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/multi-cap-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/large-cap-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/large-and-mid-cap-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/mid-cap-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/small-cap-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/elss.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/dividend-yield-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/sectoralthematic.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/contra-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/focused-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/value-fund.html",
    "https://www.moneycontrol.com/mutual-funds/performance-tracker/returns/flexi-cap-fund.html"
]

# Function to generate portfolio link
def generate_portfolio_link(fund_link):
    match = re.search(r'(\w+)$', fund_link)  # Extract the fund ID at the end of the URL
    if match:
        fund_id = match.group(1)
        portfolio_link = f"https://www.moneycontrol.com/mutual-funds/{fund_id}/portfolio-holdings/{fund_id}"
        return portfolio_link
    return None

# Function to scrape each URL and get the table data
def scrape_data(url):
    logging.info(f"Starting to scrape data from: {url}")
    response = requests.get(url)
    if response.status_code != 200:
        logging.warning(f"Failed to fetch data from {url}, status code: {response.status_code}")
        return []
    
    soup = BeautifulSoup(response.content, 'html.parser')
    table = soup.find('table', {'id': 'dataTableId'})
    if not table:
        logging.warning(f"No table found on page: {url}")
        return []

    rows = table.find_all('tr')
    logging.info(f"Found {len(rows)} rows in the table on {url}")
    
    data = []
    for row in rows:
        cols = row.find_all('td')
        if cols:
            # Extracting the link and text
            fund_name_tag = cols[0].find('a')
            fund_name = fund_name_tag.text.strip() if fund_name_tag else cols[0].text.strip()
            fund_link = fund_name_tag['href'] if fund_name_tag else None
            portfolio_link = generate_portfolio_link(fund_link) if fund_link else None

            row_data = [fund_name] + [col.text.strip() for col in cols[1:]] + [portfolio_link]
            data.append(row_data)
            
    logging.info(f"Extracted {len(data)} rows of data from {url}")
    return data

# Collect data from all URLs
all_data = []
for url in urls:
    data = scrape_data(url)
    if data:
        all_data.extend(data)
    logging.info(f"Total rows collected so far: {len(all_data)}")

# Define column names (excluding 'Fund Link' column)
columns = ["Scheme Name", "Plan", "Category Name", "Crisil Rating", "AuM (Cr)", "1W", "1M", "3M", "6M", "YTD", "1Y", "2Y", "3Y", "5Y", "10Y", "Portfolio Link"]

# Create DataFrame and save to CSV
df = pd.DataFrame(all_data, columns=columns)
df.to_csv('mutual_fund_data_with_portfolio_links.csv', index=False)

logging.info("Data saved to 'mutual_fund_data_with_portfolio_links.csv'")
logging.info(f"Total rows saved: {len(df)}")
