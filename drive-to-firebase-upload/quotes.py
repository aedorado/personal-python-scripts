import csv
import requests
from firebase_admin import storage
from commons import db, fetch_data_from_excel, already_processed, download_file_from_google_drive

QUOTES_FIREBASE = 'quotes'


def isnan(value):
    try:
        return math.isnan(float(value))
    except:
        return False


def malformed_quote_row(audio):
    return isnan(audio['Quote Drive Link']) or audio['Quote Drive Link'] == '-'


def get_quote_from_row(row):
    return {
        'id': row['ID'],
        'date': str(row['Date']),
        'text': row['Text'],
        'temple': row['Temple'],
        'location': row['Location'],
        'place': row['Place'],
        'order': int(row['Order'])
    }


def upload_quote(row):
    quote_file_name = row['ID'].replace(' ', '_') + '.png'
    quote_file_path = './quotes/{}'.format(quote_file_name)
    if (len(row['Quote Drive Link']) <= 3):
        print(
            f'Skipping quote as URL is not correct: {row["Quote Drive Link"]}\n')
        return
    download_file_from_google_drive(row['Quote Drive Link'], quote_file_path)

    bucket = storage.bucket()
    upload_file_path = 'quotes/{}'.format(quote_file_name)
    print('📤 Uploading quote {}'.format(upload_file_path))
    blob = bucket.blob(upload_file_path)
    blob.upload_from_filename(quote_file_path)
    blob.make_public()

    quote = get_quote_from_row(row)
    quote['url'] = blob.public_url
    print(blob.public_url)

    print(quote)
    doc_ref = db.collection(QUOTES_FIREBASE)
    doc_ref.add(quote)
    print('👨‍💻 Firebase Document Added.\n ')


def process_row(row):
    if malformed_quote_row(row):
        print('🚫 Skipping row as malformed: Quote #{}'.format(row['Quote #']))
        return
    if already_processed('quotes', row['ID']):
        print('🚫 Skipping row as quote already processed: {}'.format(
            row['ID']))
        return
    upload_quote(row)


quote_file = 'quotes.csv'


def download_csv():
    response = requests.get(
        'https://docs.google.com/spreadsheet/ccc?key=1CgGVHNyl8Vb89eVpK_zLLHajmG_cWYizAV1AuarAmUk&output=csv')
    assert response.status_code == 200, 'Wrong status code'
    with open(quote_file, 'w') as outfile:
        outfile.write(str(response.content)[2:-1].replace('\\r\\n', '\n'))


if __name__ == "__main__":
    download_csv()

with open(quote_file, 'rt') as f:
    reader = csv.DictReader(f)
    i = 0
    for row in reader:
        i = i + 1
        process_row(row)
    # rows = fetch_data_from_excel('App - Quotes.xlsx')
