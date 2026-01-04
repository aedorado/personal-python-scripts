import pandas as pd


def getData():
    df = pd.read_csv('tradebook.csv')
    del df['order_id']
    del df['trade_id']
    df['value'] = df['quantity'] * df['price']
    df['value-a'] = df['quantity'] * df['price']
    return df


def getEquityData():
    df = getData()
    df = df[(df.symbol != "N100") & (df.symbol != "N100-E")
            & (df.symbol != "GOLDBEES") & (df.symbol != "NIFTYBEES") & (df.symbol != "JUNIORBEES")]
    return df


def getETFData():
    df = getData()
    df = df[(df.symbol == "N100") | (df.symbol == "N100-E") |
            (df.symbol == "GOLDBEES") | (df.symbol == "NIFTYBEES") |
            (df.symbol == "JUNIORBEES")]
    return df


def getGoldData():
    df = getData()
    df = df[df.symbol == "GOLDBEES"]
    return df


def processDailyInformation():
    data = getData()
    data = data.groupby(['trade_date', 'trade_type']).sum()
    del data['price']
    del data['quantity']
    print(data)


def processWeeklyInformation():
    data = getData()
    data['week_date'] = pd.to_datetime(
        data['trade_date']) - pd.to_timedelta(7, unit='d')
    data = data.groupby(
        [pd.Grouper(key='week_date', freq='W-SAT'), 'trade_type']).agg({'value': 'sum', 'value-a': 'mean'})
    print(data)


def processMonthlyInformation(data):
    print("\n\nMonthly Data")
    data['month'] = pd.to_datetime(data['trade_date'])
    data = data.groupby(
        [pd.Grouper(key='month', freq='ME'), 'trade_type']).agg({'value': 'sum'}).round(2)
    print(data)


def sharePurchase():
    data = getData()
    print(data.groupby(['tradingsymbol', 'trade_date', 'trade_type']).sum())
    # print(data)


def processEq():
    print("\n\n____EQUITY____")
    processMonthlyInformation(getEquityData())


def processGold():
    print("\n\n____GOLD____")
    processMonthlyInformation(getGoldData())


def processETF():
    print("\n\n____ETF____")
    processMonthlyInformation(getETFData())


# New function to process mutual fund data
def getMutualFundData():
    # Load data from tb-mf.csv (in your case, mutual fund data)
    df = pd.read_csv('tradebook-MF.csv')
    # Calculate the value for each trade (quantity * price)
    df['value'] = df['quantity'] * df['price']
    return df


def processMutualFundData():
    df = getMutualFundData()
    
    # Convert trade_date to datetime
    df['trade_date'] = pd.to_datetime(df['trade_date'])
    
    # Group by month and symbol, calculate sum of value for each group
    monthly_symbol_data = df.groupby([pd.Grouper(key='trade_date', freq='ME'), 'symbol', 'trade_type']).agg({'value': 'sum'}).round(1)
    
    # Group by month only, calculate total value for each month
    monthly_total_data = df.groupby([pd.Grouper(key='trade_date', freq='ME'), 'trade_type']).agg({'value': 'sum'}).round(1)
    
    print("\n\nMutual Fund Data per Symbol per Month:")
    print(monthly_symbol_data)
    
    print("\n\nTotal Mutual Fund Data per Month:")
    print(monthly_total_data)


if __name__ == "__main__":
    processEq()
    processGold()
    processETF()
    processMutualFundData()  # Call the new function to process mutual fund data