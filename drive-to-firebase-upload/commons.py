import re
import csv
import math
import pandas
import requests
import firebase_admin
from firebase_admin import storage
from firebase_admin import firestore
from firebase_admin import credentials
 
cred = credentials.Certificate(
   "bdds-app-test-firebase-adminsdk-in8hd-efb77762de.json")
firebase_admin.initialize_app(cred, {
   'storageBucket': 'bdds-app-test.appspot.com'
})
 
db = firestore.client()
 
 
def save_response_content(response, destination):
   CHUNK_SIZE = 32768
 
   with open(destination, "wb") as f:
       for chunk in response.iter_content(CHUNK_SIZE):
           if chunk:  # filter out keep-alive new chunks
               f.write(chunk)
 
 
def get_confirm_token(response):
   for key, value in response.cookies.items():
       if key.startswith('download_warning'):
           return value
 
   return None
 
 
def get_file_id_from_drive_url(url):
   m = re.search('/[-\w]{25,}/', url)
   return (m.group(0)[1:-1])
 
 
def download_file_from_google_drive(drive_url, destination):
   id = get_file_id_from_drive_url(drive_url)
   # id = '1ou1SHdjgYuq0aAH2nd1m-bFp6_Y8ny1x'
   print('📥 Downloading file {}'.format(destination))
   URL = "https://docs.google.com/uc?export=download"
 
   session = requests.Session()
 
   response = session.get(URL, params={'id': id}, stream=True)
   token = get_confirm_token(response)
 
   if token:
       params = {'id': id, 'confirm': token}
       response = session.get(URL, params=params, stream=True)
 
   save_response_content(response, destination)
   print('😺 Downloading file {} finished'.format(destination))
 
 
def already_processed(table_name, id):
   results = db.collection(table_name).where('id', '==', id).get()
   return len(results) == 1
 
 
def fetch_data_from_excel(filename):
   df = pandas.read_excel(filename, engine='openpyxl')
   return df.to_dict(orient='records')
