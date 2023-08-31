import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from glob import glob
from os import path
from time import sleep

import logging
import pytz
import requests
from geopy.geocoders import Nominatim
from logging.config import fileConfig
from random import randint
from requests.adapters import HTTPAdapter
from time import sleep
from timezonefinder import TimezoneFinder
from urllib3.util import Retry

from config import markers_list, headers, executor_workers, country_list
from geolocation import get_location, get_location_data, timezone_offset
from site_whatsupcams import stream_location, stream_prefix


log_file_path = path.join(path.dirname(path.abspath(__file__)), 'logging.conf')
fileConfig(log_file_path, disable_existing_loggers=False)
logger = logging.getLogger(__name__)


def http_get(url):
    """Send Http request

    Args:
        url (string): URL

    Return:
        response: HTTP Response
    """
    session =  requests.Session()
    try:
        retry = Retry(connect=3, backoff_factor=0.5)
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        logger.info('URL "%s"' % (url))
        sleep(1)
        response = session.get(url, headers=headers)
        return response
    except requests.exceptions.ConnectionError:
        logger.error('Connection ERROR, URL "%s"' % url)
        return


def request_executor(urls):
    """HTTP Request Executor
    
    Args:
        urls (list): List of URLs

    Returns:
        response (list):
    """
    with ThreadPoolExecutor(max_workers=executor_workers) as pool:
        return list(pool.map(http_get, urls))


def scrape(country_code):
    """Scrape insecam.org

    Args:
        country_code (string): Country code

    Returns:
        id, country, country_code, region, city, zip, timezone, manufacturer,
        lat, lng, stream (json): ID, Country, Country code, Region, City,
        Zip code, Timezone, Manufacturer, Latitude, Longitude, Stream
    """
    print(country_code)
    urls = []

    # Get number of pages
    r = requests.get('http://insecam.org/en/bycountry/{}/?page=1'.format(country_code), headers=headers)

    try:
        pages = int(r.text.split('pagenavigator("?page=", ')[1].split(",")[0])
    except:
        pages = 0  # No detected Cameras in a country

    if pages == 1:
        pages = pages + 1

    _urls = []
    for i in range(1, pages):
        _urls.append('http://insecam.org/en/bycountry/{}/?page={}'.format(country_code, str(i)))

    response_list = request_executor(_urls)

    for r in response_list:
        # find the URL for all Cameras on that pages (usual 6)
        for x in range(0, r.text.count('/en/view/')):
            urls.append(r.text.split('/en/view/')[x + 1].split('/"')[0])

    _urls = []
    response_list = []

    for id in urls:
        _urls.append('http://insecam.org/en/view/{}'.format(id))

    response_list = request_executor(_urls)

    for r in response_list:
        try:
            country = r.text.split('Country:')[1].split('title="')[1].split('">')[1].split('</a>')[0].strip()
        except Exception:
            country = ""

        try:
            region = r.text.split('Region:')[1].split('title="')[1].split('">')[1].split('</a>')[0].strip()
        except Exception:
            region = ""

        try:
            city = r.text.split('City:')[1].split('title="')[1].split('">')[1].split('</a>')[0].strip()
        except Exception:
            city = ""

        try:
            zip_code = r.text.split("ZIP:")[1].split('">\n')[1].split("\n")[0].strip()
        except Exception:
            zip_code = ""

        try:
            timezone = r.text.split('Timezone:')[1].split('title="')[1].split('">')[1].split('</a>')[0].strip()
        except Exception:
            timezone = ""

        try:
            manufacturer = r.text.split('Manufacturer:')[1].split('title="')[1].split('">')[1].split('</a>')[0].strip()
        except Exception:
            manufacturer = ""

        try:
            lat = float(r.text.split("Latitude:")[1].split('">\n')[1].split("\n")[0].strip())
        except Exception:
            continue

        try:
            lng = float(r.text.split("Longitude:")[1].split('">\n')[1].split("\n")[0].strip())
        except Exception:
            continue

        try:
            stream = r.text.split('image0')[1].split('src="')[1].split('"')[0]
        except Exception:
            stream = ""

        markers_list.append({
            "id": id,
            "country": country,
            "country_code": country_code,
            "region": region,
            "city": city,
            "zip": zip_code,
            "timezone": timezone,
            "manufacturer": manufacturer,
            "lat": lat,
            "lng": lng,
            "stream": stream
        })


"""Whatsupcams
www.whatsupcams.com
"""
def stream_place(stream_id):
    try:
        country = pytz.country_names[country_code]
    except Exception:
        country = ''

    # Example: cc_city
    stream_cc_place = ''.join([i for i in stream_name if not i.isdigit()])
    # Example: city
    stream_place = stream_cc_place.split('%s_' % country_code.lower())[1]

    if stream_cc_place in stream_prefix:
        stream_place = stream_prefix[stream_cc_place]

    # Example: "City, Country"
    location = '%s, %s' % (stream_place.title(), country)

    if location == '':
        location = country
        
    return {'location:', location}


def wuc_streams():
    """Whatsupcams Streams

    Returns:
        streams (json): List of available streams (ID - Stream name)
    """
    logger.info('Update Whatsupcams Streams')
    api_url = 'https://services.whatsupcams.com/streams'
    response = requests.get(api_url)
    return response.json()


def wuc_stream(stream_id):
    """Whatsupcams Streams/Stream

    Agrs:
        param1 (list): Stream info (Stream)
    """
    api_url = 'https://services.whatsupcams.com/streams'
    url = '%s/%s' % (api_url, stream_id)
    response = requests.get(url)
    return response.json()


def wuc_cams_update(country_code):
    """ Update Whatsupcams cams. Read streams and locations data and create new markers list.
    JSON stream example URL "https://services.whatsupcams.com/streams/hr_zagreb01".
    JSON stream example local file "./data/whatsupcams/streams/hr_zagreb01.json".

    Args:
        country_code (string): Country code

    Returns:
        id, country_code, country, region, city, zip, timezone, manufacturer,
        lat, lng, stream, stream2 (list): Stream name (example: hr_zagreb01), Country code, Country,
        Region, City (example: Zagreb), Zip code (example: 10000), Timezone, Manufacturer, Latitude, Longitude,
        Stream (HLS), Stream 2 (RTMP)
    """
    urls = []
    _urls = []
    api_url = 'https://services.whatsupcams.com/streams/'
    logger.info('Country Code: %s' % country_code)
    
    # Load stream ID (stream name) from JSON file
    data_file = open('data/whatsupcams/streams.json')
    data = json.load(data_file)
    data_file.close()
    country_streams = sorted([i for i in data if i.startswith('%s_' % country_code.lower())])
    # 0 - No detected Camera in a country
    len_country_streams = len(country_streams)

    # stream_id example: cc_city01
    for stream_id in country_streams:
        # Append URL if file does not exist
        if not path.isfile('data/whatsupcams/streams/%s.json' % stream_id):
            _urls.append('{}/{}'.format(api_url, stream_id))

    for json_file in glob('data/whatsupcams/streams/%s_*.json' % country_code.lower()):
        # Load stream data from JSON file
        data_file = open(json_file)
        data = json.load(data_file)
        data_file.close()
        
        try:
            stream_name = data['name']
        except Exception:
            stream_name = ''

        try:
            country = pytz.country_names[country_code]
        except Exception:
            country = ''

        # Stream ID location, Country
        # Stream Location Examples:
        #   "hr_igrane3": ["igrane central beach", "Beach, Igrane"],
        #   "hr_japetic01": ["japetic jastrebarsko", ""],
        stream_id = stream_name
        logger.info('Stream ID: "%s"' % stream_id)
        try:
            if stream_location[stream_id]:
                location = '%s, %s' % (stream_location[stream_id][1], country)

                if location == '':
                    if stream_location[stream_id][0] != '':
                        location = '%s, %s' % (stream_location[stream_id][0], country)
        except KeyError:
            logger.debug('stream_location KeyError: "%s"' % stream_id)

            # example: cc_city ({country code}_city)
            stream_cc_place = ''.join([i for i in stream_name if not i.isdigit()])
            # city
            stream_place = stream_cc_place.split('%s_' % country_code.lower())[1]

            # stream_prefix example: cc_city
            if stream_cc_place in stream_prefix:
                stream_place = stream_prefix[stream_cc_place]
            if stream_place == '':
                location = country
            else:
                location = '%s, %s' % (stream_place.title(), country)
            
        if location == '':
            location = country

        try:
            location_data = get_location_data(location)
        except Exception:
            location_data = {}

        try:
            region = location_data['address'].split(',')[1].strip()
        except Exception:
            region = ''

        # City == Location Address [0]
        try:
            city = location_data['address'].split(',')[0]
        except Exception:
            city = ''

        try:
            zip_code = int(location_data['address'].split(',')[-2].strip())
        except Exception:
            zip_code = ''

        timezone_data = timezone_offset(location_data)
        try:
            timezone = '%s (%s)' % (timezone_data['timezone'], timezone_data['utc_offset'])
        except Exception:
            timezone = ''

        manufacturer = ''

        try:
            lat = location_data['latitude']
        except Exception:
            continue

        try:
            lng = location_data['longitude']
        except Exception:
            continue

        try:
            # HLS URL
            stream = data['hls']['url']
        except Exception:
            stream = ''

        try:
            # RTMP URI
            stream2 = data['rtmp']['uri']
        except Exception:
            stream2 = ''

        logger.debug('id: %s; location_address: %s; timezone: %s; latitude: %s; longitude: %s; stream: %s' %
        (stream_name, location_data, timezone, lat, lng, stream))

        markers_list.append({
            "id": stream_name,
            "country_code": country_code,
            "country": country,
            "region": region,
            "city": city,
            "zip": zip_code,
            "timezone": timezone,
            "manufacturer": manufacturer,
            "lat": lat,
            "lng": lng,
            "stream": stream,
            "stream2": stream2
        })
