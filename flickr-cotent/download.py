import csv
import requests
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
from utils import get_tags

photo_size_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
photo_info_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
groups_url = 'https://www.flickr.com/services/rest/?method=flickr.groups.getInfo&api_key=7c8f69d121ab603598cbba9906dfc810&group_id=:group_id:&format=json&nojsoncallback=1'
photos_in_group_url = 'https://www.flickr.com/services/rest/?method=flickr.groups.pools.getPhotos&api_key=7c8f69d121ab603598cbba9906dfc810&group_id=:group_id:&format=json&nojsoncallback=1'

group_ids = ['14765946@N24',
             '14755386@N25',
             '14801676@N21',
             '14777292@N20',
             '14822962@N22',
             '14754807@N25',
             '14829308@N22',
             '14806500@N23']

all_groups = []
all_groups_dict = {}

all_subgroups = {}
all_subgroups_is_rss = {}

cred = credentials.Certificate(
    "bdds-app-test-firebase-adminsdk-in8hd-efb77762de.json")
firebase_admin.initialize_app(cred)

db = firestore.client()


def add_to_firebase(all_groups):
    doc_ref = db.collection('image_groups')
    for group in all_groups:
        doc_ref.add(group)
    print('Added group docs to firebase')


def delete_groups():
    doc_ref = db.collection('image_groups')
    delete_collection(doc_ref, 100)   # removing is exists


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


def build_group_meta(group_name, group_id):

    parts = group_name.split(';')

    is_rss = parts[0] == 'R'
    group_name = parts[1]
    subgroup_name = parts[2]
    all_subgroups[group_id] = subgroup_name
    all_subgroups_is_rss[group_id] = is_rss

    group_key = (group_name, is_rss)
    if group_key in all_groups_dict:
        all_groups_dict[group_key]['subgroups_list'].append(subgroup_name)
    else:
        all_groups_dict[group_key] = {
            'is_rss': is_rss,
            'group_name': group_name,
            'subgroups_list': [subgroup_name],
        }


def get_all_groups():
    for group_id in group_ids:
        print(f'Searching group {group_id}')
        group_details = requests.get(
            url=groups_url.replace(":group_id:", group_id)).json()
        print(group_details['group']['name']['_content'])
        build_group_meta(
            group_details['group']['name']['_content'], group_id)

    for group in all_groups_dict.items():
        all_groups.append(group[1])

    keys = all_groups[0].keys()
    print('Creating groups file')
    with open('files/groups.csv', 'w', newline='') as output_file:
        dict_writer = csv.DictWriter(output_file, keys)
        dict_writer.writeheader()
        dict_writer.writerows(all_groups)

    print(all_groups)
    delete_groups()
    add_to_firebase(all_groups)
    print(all_subgroups)


def get_group_name(group_id):
    return all_subgroups[group_id]


def get_group_is_rss(group_id):
    return all_subgroups_is_rss[group_id]


def write_headers(filename, headers):
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()


def get_all_group_photos():
    headers = ["id", "tags", "group", "date", "description",
               "order", "display_url", "download_url", "thumbnail_url", "is_rss"]
    filename = 'files/images.csv'
    write_headers(filename=filename, headers=headers)

    for group_id in group_ids:
        print(f'Adding images for group: {group_id}')
        photos_in_group = requests.get(
            url=photos_in_group_url.replace(":group_id:", group_id)).json()
        photos = photos_in_group['photos']['photo']
        total_rows_processed = 0
        photo_csv_list = []
        for photo in photos:
            try:
                photo_details = requests.get(
                    url=photo_info_url.replace(':photo_id:', photo['id'])).json()
                size_json = requests.get(
                    url=photo_size_url.replace(':photo_id:', photo['id'])).json()
                photo_csv = {
                    'id': 'I' + photo_details['photo']['id'],
                    'date': photo_details['photo']['dates']['taken'],
                    'group': get_group_name(group_id),
                    'is_rss': get_group_is_rss(group_id),
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
            except Exception as e:
                print(e)
                print(
                    f"An error occured for photo={photo['id']}")

        with open('files/images.csv', 'a', newline='') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=headers)
            for photo_csv in photo_csv_list:
                writer.writerow(photo_csv)


def process():
    get_all_groups()
    print('Phase 1 completed; All groups added to firebase')
    get_all_group_photos()
    print('Phase 1 completed; All images added to images.csv')


if __name__ == "__main__":
    process()
