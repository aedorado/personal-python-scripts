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
   print_df(data)
 
 
def processWeeklyInformation():
   data = getData()
   data['week_date'] = pd.to_datetime(
       data['trade_date']) - pd.to_timedelta(7, unit='d')
   data = data.groupby(
       [pd.Grouper(key='week_date', freq='W-SAT'), 'trade_type']).agg({'value': 'sum', 'value-a': 'mean'})
   print(data)
 
 
def processMonthlyInformation(data):
   print("\n\nMonthly Data")
   data['month'] = pd.to_datetime(
       data['trade_date'])
   data = data.groupby(
       [pd.Grouper(key='month', freq='M'), 'trade_type']).agg({'value': 'sum', 'value-a': 'mean'}).round(2)
   print(data)
 
 
def sharePurchase():
   data = getData()
   print_df(data.groupby(['tradingsymbol', 'trade_date', 'trade_type']).sum())
   # print(data)
 
 
def processEq():
   print("\n\n___________EQUITY___________")
   processMonthlyInformation(getEquityData())
 
 
def processGold():
   print("\n\n___________GOLD___________")
   processMonthlyInformation(getGoldData())
 
 
def processETF():
   print("\n\n___________ETF___________")
   processMonthlyInformation(getETFData())
 
 
if __name__ == "__main__":
   processEq()
   processGold()
   processETF()
 

