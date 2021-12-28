import csv
import pprint
import requests
import threading
import traceback
import firebase_admin
from random import randrange
from firebase_admin import credentials
from firebase_admin import firestore
 
csv_writer_lock = threading.Lock()
 
pp = pprint.PrettyPrinter(indent=4)
 
owner_id = '136932677@N02'
 
photo_size_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
photo_info_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
all_photosets_url = 'https://www.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=7c8f69d121ab603598cbba9906dfc810&user_id=136932677%40N02&format=json&nojsoncallback=1'
all_pics_in_photoset = 'https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=7c8f69d121ab603598cbba9906dfc810&photoset_id=:photoset_id:&user_id=136932677%40N02&format=json&nojsoncallback=1'
 
photoset_details_map = {}
 
all_cats = []
all_cats_dict = {}
all_subcats = {}
all_subcats_is_rss = {}
all_subcats_cover_image = {}
 
cred = credentials.Certificate(
   "bdds-app-test-firebase-adminsdk-in8hd-efb77762de.json")
firebase_admin.initialize_app(cred)
db = firestore.client()
 
 
def add_to_firebase(all_categories):
   doc_ref = db.collection('image_categories')
   for category in all_categories:
       doc_ref.add(category)
   print('Added category docs to firebase')
 
 
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
 
 
def delete_categories():
   doc_ref = db.collection('image_categories')
   delete_collection(doc_ref, 100)
 
 
def get_all_photos_in_photoset(photoset_id):
   photos_in_photoset = requests.get(
       url=all_pics_in_photoset.replace(':photoset_id:', photoset_id)).json()
   photos = photos_in_photoset['photoset']['photo']
   return photos
 
 
def get_cover_image(photoset_id):
   photos = get_all_photos_in_photoset(photoset_id)
   photo_id = photos[randrange(len(photos))]['id']
   photo_details = get_photo_details(photo_id)
   size_json = get_size_details(photo_id)
   for size in size_json['sizes']['size']:
       if (size['label'] == 'Small 320'):
           return size['source']
 
 
def build_cat_meta(album_title, photoset_id):
   print(f'Processing {album_title}..')
   try:
       parts = album_title.split(';')
       is_rss = parts[1] == 'R'
       cat_name = parts[2]
       subcat_name = parts[3]
       all_subcats[photoset_id] = subcat_name
       all_subcats_is_rss[photoset_id] = is_rss
       photoset_cover_image = get_cover_image(photoset_id)
 
       cat_key = (cat_name, is_rss)
       if cat_key in all_cats_dict:
           all_cats_dict[cat_key]['subcategories_list'].append(
               {'name': subcat_name, 'cover_image': photoset_cover_image})
       else:
           all_cats_dict[cat_key] = {
               'is_rss': is_rss,
               'category_name': cat_name,
               'subcategories_list': [{'name': subcat_name, 'cover_image': photoset_cover_image}]
           }
 
       if photoset_id not in photoset_details_map.keys():
           photoset_details_map[photoset_id] = {}
   except:
       print(f'An exception occured for {album_title}')
 
 
def get_all_photosets():
   cat_subcat_map = {}
   photoset_details = requests.get(url=all_photosets_url).json()
   for photoset in photoset_details['photosets']['photoset']:
       photoset_title = photoset['title']['_content']
       if photoset_title[0:2] == 'A;':
           build_cat_meta(photoset_title, photoset['id'])
 
   for cat in all_cats_dict.items():
       all_cats.append(cat[1])
 
   keys = all_cats[0].keys()
   print('Creating cats file')
   with open('files/cats.csv', 'w', newline='') as output_file:
       dict_writer = csv.DictWriter(output_file, keys)
       dict_writer.writeheader()
       dict_writer.writerows(all_cats)
 
   delete_categories()
   add_to_firebase(all_cats)
   # print('Cat: ', cat_subcat_map)
 
 
def get_cat_name(cat_id):
   return all_subcats[cat_id]
 
 
def get_cat_is_rss(cat_id):
   return all_subcats_is_rss[cat_id]
 
 
def write_headers(filename, headers):
   with open(filename, 'w', newline='') as csvfile:
       writer = csv.DictWriter(csvfile, fieldnames=headers)
       writer.writeheader()
 
 
def get_tags(photo):
   tags_list = photo['photo']['tags']['tag']
   tags_title_list = []
   for tag in tags_list:
       tags_title_list.append(tag['raw'])
   return ", ".join(tags_title_list)
 
 
def get_photo_details(photo_id):
   return requests.get(
       url=photo_info_url.replace(':photo_id:', photo_id)).json()
 
 
def get_size_details(photo_id):
   return requests.get(
       url=photo_size_url.replace(':photo_id:', photo_id)).json()
 
 
class ImageRowWriter(threading.Thread):
 
   def __init__(self, photoset_id, filename, headers):
       threading.Thread.__init__(self)
       self.photoset_id = photoset_id
       self.filename = filename
       self.headers = headers
 
   def run(self):  # write_rows_to_images_csv
       print(f'Adding images for photoset: {self.photoset_id}')
       photos = get_all_photos_in_photoset(self.photoset_id)
       total_rows_processed = 0
       photo_csv_list = []
       for photo in photos:
           try:
               photo_details = get_photo_details(photo['id'])
               size_json = get_size_details(photo['id'])
               photo_csv = {
                   'id': 'I' + photo_details['photo']['id'],
                   'date': photo_details['photo']['dates']['taken'],
                   'subcategory': get_cat_name(self.photoset_id),
                   'is_rss': get_cat_is_rss(self.photoset_id),
                   'description': photo_details['photo']['description']['_content'].replace('\n', " ")
               }
               if (len(photo_csv['description']) == 0):
                   photo_csv['description'] = ""
               photo_csv['tags'] = get_tags(photo_details)
               for size in size_json['sizes']['size']:
                   if (size['label'] == 'Original'):
                       photo_csv['download_url'] = size['source']
                   elif (size['label'] == 'Large'):
                       photo_csv['display_url'] = size['source']
                   elif (size['label'] == 'Small 320'):
                       photo_csv['thumbnail_url'] = size['source']
               # TODO write to queue
               total_rows_processed = total_rows_processed + 1
               photo_csv['order'] = total_rows_processed
               photo_csv_list.append(photo_csv)
               if total_rows_processed % 10 == 0:
                   print(
                       f'Added {total_rows_processed} images for photoset: {self.photoset_id}')
           except Exception as e:
               traceback.print_exc()
               print(
                   f"An error occured for photo={photo['id']}")
 
       print(f'Completed photoset: {self.photoset_id}')
       with csv_writer_lock:
           with open(self.filename, 'a', newline='') as csvfile:
               writer = csv.DictWriter(csvfile, fieldnames=self.headers)
               for photo_csv in photo_csv_list:
                   writer.writerow(photo_csv)
 
 
def get_all_photoset_photos():
   headers = ["id", "subcategory", "date", "description", "order",
              "display_url", "download_url", "thumbnail_url", "is_rss", "tags"]
   filename = 'files/images.csv'
   write_headers(filename=filename, headers=headers)
 
   for photoset_id in photoset_details_map:
       ImageRowWriter(photoset_id, filename, headers).start()
 
 
def process():
   get_all_photosets()
   print(all_subcats)
   get_all_photoset_photos()
   # print('Phase 1 completed; All categories added to firebase')
   # get_all_category_photos()
   # print('Phase 1 completed; All images added to images.csv')
 
 
if __name__ == "__main__":
   process()
 

