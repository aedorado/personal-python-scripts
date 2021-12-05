import csv
import threading
import requests

groups = [
    {
        'type': 'color',
        'name': 'Green',
        'id': '14822957@N22'
    },
    {
        'type': 'color',
        'name': 'Red',
        'id': '14822957@N22'
    },
    {
        'type': 'color',
        'name': 'Blue',
        'id': '14805326@N23'
    },
    {
        'type': 'location',
        'name': 'Mauritius',
        'id': '14823704@N22'
    },
    {
        'type': 'location',
        'name': 'GEV',
        'id': '14822962@N22'
    },
    {
        'type': 'location',
        'name': 'Mumbai',
        'id': '14763956@N24'
    },
    {
        'type': 'location',
        'name': 'Pune',
        'id': '14805371@N23'
    },
]

ssrss_albums = ['72157690449465555', '72157719250166952',
                '72157677029564726', '72157674042736540', '72157666606335405']
maharaja_albums = ['72157719682246698', '72157689261440966']

all_albums_url = 'https://www.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=7c8f69d121ab603598cbba9906dfc810&user_id=136932677%40N02&format=json&nojsoncallback=1'
all_photos_url = 'https://www.flickr.com/services/rest/?method=flickr.photosets.getPhotos&api_key=7c8f69d121ab603598cbba9906dfc810&photoset_id=:photoset_id:&user_id=136932677%40N02&per_page=2500&format=json&nojsoncallback=1'
photo_size_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getSizes&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
photo_info_url = 'https://www.flickr.com/services/rest/?method=flickr.photos.getInfo&api_key=7c8f69d121ab603598cbba9906dfc810&photo_id=:photo_id:&format=json&nojsoncallback=1'
photos_in_group_url = 'https://www.flickr.com/services/rest/?method=flickr.groups.pools.getPhotos&api_key=7c8f69d121ab603598cbba9906dfc810&group_id=:group_id:&format=json&nojsoncallback=1'

all_albums = []

color_map = {}
location_map = {}

csv_writer_lock = threading.Lock()


def get_all_groups():
    for group in groups:
        photos_in_group = requests.get(
            url=photos_in_group_url.replace(":group_id:", group['id'])).json()
        photos = photos_in_group['photos']['photo']
        for photo in photos:
            if group['type'] == 'color':
                color_map[photo['id']] = group['name']
            elif group['type'] == 'location':
                location_map[photo['id']] = group['name']
    print(color_map)
    print(location_map)


def get_color(photo_id):
    if photo_id in color_map.keys():
        print('Color Detected', photo_id, color_map[photo_id])
        return color_map[photo_id]
    return "-"


def get_location(photo_id):
    if photo_id in location_map.keys():
        print('Location Detected', photo_id, location_map[photo_id])
        return location_map[photo_id]
    return "-"


def get_tags(photo):
    tags_list = photo['photo']['tags']['tag']
    tags_title_list = []
    for tag in tags_list:
        tags_title_list.append(tag['raw'])
    return ", ".join(tags_title_list)


def write_images():
    headers = ["id", "album_id", "tags", "display_url", "download_url", "thumbnail_url",
               "type", "date", "color", "location", "description", "order"]

    filename = 'files/ssrss_images.csv'
    write_headers(filename=filename, headers=headers)
    filename = 'files/maharaja_images.csv'
    write_headers(filename=filename, headers=headers)

    for album in all_albums:
        if album in ssrss_albums:
            print(f'Adding images for the album {album}')
            filename = 'files/ssrss_images.csv'
            ImageRowWriter(album, filename, headers).start()
        elif album in maharaja_albums:
            print(f'Adding images for the album {album}')
            filename = 'files/maharaja_images.csv'
            ImageRowWriter(album, filename, headers).start()


class ImageRowWriter(threading.Thread):

    def __init__(self, album_id, filename, headers):
        threading.Thread.__init__(self)
        self.album_id = album_id
        self.filename = filename
        self.headers = headers

    def run(self):  # write_rows_to_images_csv
        total_rows_processed = 0
        all_albums_json = requests.get(
            url=all_photos_url.replace(":photoset_id:", self.album_id)).json()
        photos = all_albums_json['photoset']['photo']
        print(f'Album has {len(photos)} photos.')

        photo_csv_list = []
        for photo in photos:
            if total_rows_processed % 25 == 0:
                print('{} images added for album {}'.format(
                    total_rows_processed, self.album_id))
            try:
                photo_details = requests.get(
                    url=photo_info_url.replace(':photo_id:', photo['id'])).json()
                size_json = requests.get(
                    url=photo_size_url.replace(':photo_id:', photo['id'])).json()
                photo_csv = {
                    'id': 'I' + photo_details['photo']['id'],
                    'album_id': 'A' + self.album_id,
                    'type': 'image',
                    'date': photo_details['photo']['dates']['taken'],
                    'color': get_color(photo_details['photo']['id']),
                    'location': get_location(photo_details['photo']['id']),
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
                if (total_rows_processed % 50 == 0):
                    print(
                        f'Processed {total_rows_processed} rows. {round(total_rows_processed / len(photos) * 100, 2)}%')
            except Exception:
                print(
                    f"An error occured for album={self.album_id} photo={photo['id']}")

        with csv_writer_lock:
            with open(self.filename, 'a', newline='') as csvfile:
                writer = csv.DictWriter(csvfile, fieldnames=self.headers)
                for photo_csv in photo_csv_list:
                    writer.writerow(photo_csv)


def write_headers(filename, headers):
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()


def write_albums():
    # fetch the photosets
    all_albums_json = requests.get(url=all_albums_url).json()
    albums = all_albums_json['photosets']['photoset']

    headers = ["id", "name", "description",
               "total_images", "total_videos", "cover_url"]

    # write ssrss headers
    ssrss_album_filename = 'files/ssrss_albums.csv'
    write_headers(ssrss_album_filename, headers)
    write_row_to_album_csv(ssrss_album_filename,
                           headers, albums, is_ssrss=True)

    # write maharaja headers
    maharaja_album_filename = 'files/maharaja_albums.csv'
    write_headers(maharaja_album_filename, headers)
    write_row_to_album_csv(maharaja_album_filename,
                           headers, albums, is_ssrss=False)


def write_row_to_album_csv(album_filename, headers, albums, is_ssrss):
    with open(album_filename, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        for album in albums:
            album_to_write = {
                'id': 'A' + album['id'],
                'name': album['title']['_content'],
                'description': album['description']['_content'].replace('\n', ' '),
                'total_images': album['photos'],
                'total_videos': 0,
                'cover_url': 'TBD'
            }
            if is_ssrss and ssrss_albums.__contains__(album['id']):
                writer.writerow(album_to_write)
                all_albums.append(album['id'])
            elif not is_ssrss and maharaja_albums.__contains__(album['id']):
                writer.writerow(album_to_write)
                all_albums.append(album['id'])


def process():
    write_albums()
    get_all_groups()
    write_images()


if __name__ == "__main__":
    process()
