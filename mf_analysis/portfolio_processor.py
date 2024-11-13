import requests
import pandas as pd
import json
from bs4 import BeautifulSoup
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Initialize a global dictionary to store stock data
stock_map = {}

def clean_stock_name(stock_name):
    return stock_name.replace("#\n", "").strip()

# Function to process each stock and update the stock_map
# Update the function to process stock data to include Quantity Sold, Quantity Held, and Quantity Bought
def process_stock_data(stock_data, fund_name):
    print(">>", stock_data)
    stock_name = clean_stock_name(stock_data['Stock Name'])
    
    # Handle quantity data
    try:
        quantity = stock_data['Quantity'].replace(' L', 'e5').replace(' k', 'e3')  # Handle L (lakhs) and k (thousands)
        quantity = float(quantity) if quantity else 0.0
    except ValueError:
        quantity = 0.0
    
    if stock_name not in stock_map:
        stock_map[stock_name] = {
            'Stock Name': stock_name,
            'Sector': stock_data['Sector'],
            'Quantity': 0.0,  # Start with 0
            'Mutual Funds': {},
            'Number of Funds': 0
        }

    # Calculate quantities for mutual funds
    fund_quantity = quantity

    # Initialize mutual fund entry if not present
    if fund_name not in stock_map[stock_name]['Mutual Funds']:
        stock_map[stock_name]['Mutual Funds'][fund_name] = {
            'Quantity Held': 0.0,
            'Quantity Sold': 0.0,
            'Quantity Bought': 0.0
        }

    # Update the mutual fund data
    current_data = stock_map[stock_name]['Mutual Funds'][fund_name]

    # For simplicity, we assume the current 'quantity' reflects total holdings, and any change is based on the 1M Change
    change_in_quantity = stock_data['1M Change in Quantity'].strip()  # Could be + or - values
    if 'L' in change_in_quantity:  # Check for L or k for Lakhs and Thousands
        change_value = float(change_in_quantity.replace(' L', 'e5').replace(' k', 'e3'))
    else:
        change_value = 0.0

    # Categorize the quantity changes
    if change_value > 0:
        current_data['Quantity Bought'] += change_value
    elif change_value < 0:
        current_data['Quantity Sold'] -= change_value  # Negate to represent a sale
    
    # Update the total held quantity for the mutual fund
    current_data['Quantity Held'] += fund_quantity

    # Update the total quantity for the stock
    stock_map[stock_name]['Quantity'] += fund_quantity
    stock_map[stock_name]['Mutual Funds'][fund_name] = current_data
    stock_map[stock_name]['Number of Funds'] += 1

# Function to generate the final output in the desired format
def generate_final_output():
    final_data = {}
    
    for stock_name, data in stock_map.items():
        final_data[stock_name] = {
            "Stock Name": stock_name,
            "Sector": data["Sector"],
            "Quantity": data["Quantity"],  # Use Quantity
            "Mutual Funds": {},
            "Number of Funds": data["Number of Funds"]
        }

        for fund_name, fund_data in data["Mutual Funds"].items():
            final_data[stock_name]["Mutual Funds"][fund_name] = {
                "Quantity Held": fund_data["Quantity Held"],
                "Quantity Sold": fund_data["Quantity Sold"],
                "Quantity Bought": fund_data["Quantity Bought"]
            }

    return final_data

# Function to scrape data from the portfolio table
def scrape_portfolio_table(portfolio_url, fund_name):
    logging.info(f"Scraping portfolio table from: {portfolio_url}")
    response = requests.get(portfolio_url)
    if response.status_code != 200:
        logging.warning(f"Failed to fetch data from {portfolio_url}, status code: {response.status_code}")
        return None
    
    soup = BeautifulSoup(response.content, 'html.parser')
    table = soup.find('table', {'id': 'equityCompleteHoldingTable'})
    if not table:
        logging.warning(f"No portfolio table found on page: {portfolio_url}")
        return None

    rows = table.find_all('tr')
    if not rows:
        logging.warning(f"No rows found in portfolio table on page: {portfolio_url}")
        return None

    portfolio_data = []
    data_found = False

    for row in rows:
        cols = row.find_all('td')
        if cols:
            stock_name = cols[0].text.strip()  # Stock Name
            sector = cols[1].text.strip()  # Sector
            value = cols[2].text.strip()  # Value
            percentage = cols[3].text.strip()  # % of Total Holdings
            one_month_change = cols[4].text.strip()  # 1M Change
            highest_one_year = cols[5].text.strip()  # 1Y Highest Holding
            lowest_one_year = cols[6].text.strip()  # 1Y Lowest Holding
            quantity = cols[7].text.strip()  # Quantity
            one_month_quantity_change = cols[8].text.strip()  # 1M Change in Quantity

            row_data = {
                'Stock Name': stock_name,
                'Sector': sector,
                'Value (Mn)': value,
                '% of Total Holdings': percentage,
                '1M Change': one_month_change,
                '1Y Highest Holding': highest_one_year,
                '1Y Lowest Holding': lowest_one_year,
                'Quantity': quantity,
                '1M Change in Quantity': one_month_quantity_change
            }
            # Process the stock data by adding mutual fund information
            process_stock_data(row_data, fund_name)
            data_found = True
    
    if not data_found:
        logging.warning(f"No valid stock data found in portfolio: {portfolio_url}")
    
    return portfolio_data

#  Read portfolio links from CSV file
df = pd.read_csv('mutual_fund_data_with_portfolio_links.csv')

# Extract portfolio links and mutual fund names from the CSV
portfolio_links = df['Portfolio Link'].dropna().tolist()[:10]
fund_names = df['Scheme Name'].dropna().tolist()

# Scrape data for each portfolio link and process stock data
for portfolio_url, fund_name in zip(portfolio_links, fund_names):
    portfolio_data = scrape_portfolio_table(portfolio_url, fund_name)
    if portfolio_data:
        logging.info(f"Data collected for {fund_name}")
    else:
        logging.warning(f"No data found for portfolio: {portfolio_url}")

# Save stock map to a JSON file
with open('stock_map_with_mutual_funds.json', 'w') as json_file:
    json.dump(stock_map, json_file, indent=4)

logging.info("Stock map saved to 'stock_map_with_mutual_funds.json'")
