import csv
import threading
import requests

all_albums = []

all_albums_url = 'https://www.flickr.com/services/rest/?method=flickr.photosets.getList&api_key=7c8f69d121ab603598cbba9906dfc810&user_id=136932677%40N02&format=json&nojsoncallback=1'


def write_headers(filename, headers):
    with open(filename, 'w', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()


def write_rows_to_album_csv(album_filename, headers, albums):
    with open(album_filename, 'a', newline='') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        for album in albums:
            print(album['title']['_content'])
            if not (album['title']['_content'][0:2] == 'A;' or album['title']['_content'][0:2] == 'S;'):
                continue
            album_to_write = {
                'id': 'A' + album['id'],
                'name': album['title']['_content'],
                'description': album['description']['_content'].replace('\n', ' '),
                'total_images': album['photos'],
                'total_videos': 0,
                'cover_url': 'TBD'
            }
            writer.writerow(album_to_write)
            all_albums.append(album['id'])


def write_albums():
    # fetch the photosets
    all_albums_json = requests.get(url=all_albums_url).json()
    albums = all_albums_json['photosets']['photoset']

    headers = ["id", "name", "description",
               "total_images", "total_videos", "cover_url"]

    ssrss_album_filename = 'files/albums.csv'
    write_headers(ssrss_album_filename, headers)
    write_rows_to_album_csv(ssrss_album_filename,
                            headers, albums)


def process():
    write_albums()
    # get_all_groups()
    # write_images()


if __name__ == "__main__":
    process()
