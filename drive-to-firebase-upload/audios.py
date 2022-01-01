import re
import csv
import math
import pandas
import requests
import firebase_admin
from firebase_admin import storage
from firebase_admin import firestore
from firebase_admin import credentials
 
from commons import db, fetch_data_from_excel, already_processed, download_file_from_google_drive, sanitize, isnan
 
AUDIOS_FIREBASE = 'audios'
 
seminar_map = {}
series_map = {}
 
 
def upload_rows(table_name, df):
   for row in df.to_dict(orient="records"):
       if (not already_processed(table_name, row['id'])):
           print('Adding {}: {}'.format(table_name, row))
           add_sem_series_to_firestore(table_name, row)
 
 
def setup_seminar_series_maps():
   # df.to_dict(orient='records')[0].keys()
   df = pandas.read_excel('App - Audios.xlsx', 'seminars', engine='openpyxl')
   df['isSeries'] = False
   upload_rows('seminars', df)
 
   df = df[['id', 'name']]
   sm = df.set_index('name').T.to_dict()
   for k, v in sm.items():
       seminar_map[k] = v['id']
   print(seminar_map)
 
   df = pandas.read_excel('App - Audios.xlsx', 'series', engine='openpyxl')
   df['isSeries'] = True
   upload_rows('series', df)
 
   df = df[['id', 'name']]
   sm = df.set_index('name').T.to_dict()
   for k, v in sm.items():
       series_map[k] = v['id']
   print(series_map)
 
 
def get_seminar_id(seminar_name):
   if seminar_name in seminar_map:
       return seminar_map[seminar_name]
   return "-"
 
 
def get_series_id(series_name):
   if series_name in series_map:
       return series_map[series_name]
   return "-"
 
 
def add_sem_series_to_firestore(table_name, row):
   object_to_upload = {
       'id': row['id'],
       'name': row['name'],
       'description': row['description'],
       'isSeries': row['isSeries'],
       'thumbnailUrl': row['thumbnail_url'],
       'totalContents': 0
   }
   print(object_to_upload)
   doc_ref = db.collection(table_name)
   doc_ref.add(object_to_upload)
 
 
def add_audio_to_firestore(audio, public_url):
   # print('👩‍💻 Adding firebase document: {}'.format(public_url))
   print('👩‍💻 Adding firebase document')
   audio_object_to_upload = {
       'url': public_url,
       'id': str(audio['Lecture ID']),
       'name': audio['Title'],
       'seminar': get_seminar_id(audio['Seminar']),
       'series': get_series_id(audio['Series']),
       'duration': str(audio['Length']),
       'tags': sanitize(audio['Tags']),
       'year': str(audio['Year']),
       'temple': audio['Temple'],
       'location': audio['Location'],
       'place': audio['Place'],
       'country': audio['Country'],
       'isShortAudio': False,
       # TODO get this form excel ask shantal to fix
       'thumbnailUrl': 'https://firebasestorage.googleapis.com/v0/b/bdds-app-test.appspot.com/o/audio_thumbnails%2FThumbnail_audios_2020.png?alt=media&token=c7279e29-0952-454c-a8f5-b4b75c26d3b4',
       # 'thumbnailUrl': audio['thumbnail_url']
   }
   # print(audio_object_to_upload)
   doc_ref = db.collection(AUDIOS_FIREBASE)
   doc_ref.add(audio_object_to_upload)
   print('👨‍💻 Firebase Document Added.')
 
 
def malformed_audio_row(audio):
   return isnan(audio['Audio Upload Link'])
 
 
def process_audio(row_num, audio):
   audio_id = audio['Lecture ID']
   print(audio_id)
   if (malformed_audio_row(audio)):
       print('⚠️ Malformed Audio: {}, {}'.format(audio_id, row_num))
   elif (already_processed(AUDIOS_FIREBASE, str(audio_id))):
       print('⚠️ Audio already uploaded')
   # else:
   #     print('Uploading .. ')
   else:
       try:
           audio_file_name = audio['Title'].replace(' ', '_') + '.mp3'
           audio_file_path = f'./audios/' + audio_file_name
           download_file_from_google_drive(
               audio['Audio Upload Link'], audio_file_path)
 
           # firebase upload
           bucket = storage.bucket()
           upload_file_path = f'audios/upload_from_python_test/{audio_file_name}'
           print('📤 Uploading audio {}'.format(upload_file_path))
           blob = bucket.blob(upload_file_path)
           blob.chunk_size = 5 * 1024 * 1024
           blob.upload_from_filename(audio_file_path)
           blob.make_public()
           # print(blob.public_url)
           print(
               "✅ Audio ID ({}) {} is publicly accessible at {}".format(
                   audio_id, blob.name, blob.public_url
               )
           )
           add_audio_to_firestore(audio, blob.public_url)
       except Exception as err:
           # print(err)
           print("❌ Audio ID ({}) {} could not be processed".format(
               audio_id, audio['Title']
           ))
           raise Exception('Error occured of {}'.format(audio_id))
 
 
def _update_sem_series_count(sem_ser, column, id):
   print(sem_ser)
   count = len(db.collection('audios').where(column, '==', id).get())
   documents = db.collection(sem_ser).where('id', '==', id).get()
   for doc in documents:
       print('Updating document {} with count={}'.format(
           doc.to_dict()['id'], count))
       db.collection(sem_ser).document(
           doc.id).update({u'totalContents': count})
       # doc.update({u'totalContents': True})
 
 
def update_sem_series_count():
   for key, value in seminar_map.items():
       _update_sem_series_count('seminars', 'seminar', value)
   for key, value in series_map.items():
       _update_sem_series_count('series', 'series', value)
 
 
if __name__ == "__main__":
   # 1. Setup Series & Seminar Maps
   setup_seminar_series_maps()
   rows = fetch_data_from_excel('App - Audios.xlsx')
   i = 0
   for row in rows:
       i = i + 1
       process_audio(i, row)
       print('\n')
   update_sem_series_count()
