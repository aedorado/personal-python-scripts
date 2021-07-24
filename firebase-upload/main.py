import firebase_admin
import pandas as pd
from firebase_admin import credentials
from firebase_admin import firestore


def delete_collection(coll_ref, batch_size):
   docs = coll_ref.limit(batch_size).stream()
   deleted = 0

   for doc in docs:
       # print(f'Deleting doc {doc.id} => {doc.to_dict()}\n')
       doc.reference.delete()
       deleted = deleted + 1
   print('Deleted ' + str(deleted) + ' docs')

   if deleted >= batch_size:
       return delete_collection(coll_ref, batch_size)


tableName = ['ssrss_images', 'maharaja_images',
            'ssrss_albums', 'maharaja_albums']
dataFile = ['ssrss_images.csv', 'maharaja_images.csv',
           'ssrss_albums.csv', 'maharaja_albums.csv']
tableName = ['series', 'seminars', 'audios']
dataFile = ['series.csv', 'seminars.csv', 'audios.csv']


cred = credentials.Certificate(
   "bdds-app-test-firebase-adminsdk-in8hd-efb77762de.json")
firebase_admin.initialize_app(cred)

db = firestore.client()

for x in range(0, len(tableName)):
   print(tableName[x])
   doc_ref = db.collection(tableName[x])
   delete_collection(doc_ref, 100)   # removing is exists
   df = pd.read_csv(dataFile[x])
   tmp = df.to_dict(orient='records')

   for doc in tmp:
       # print(f'Adding doc => {doc}\n')
       doc_ref.add(doc)

   # list(map(lambda x: doc_ref.add(x), tmp))
