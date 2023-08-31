import geopy
import pickle
import pprint
import sqlite3
import sys
from os import path

import logging
from logging.config import fileConfig


log_file_path = path.join(path.dirname(path.abspath(__file__)), 'logging.conf')
fileConfig(log_file_path, disable_existing_loggers=False)
logger = logging.getLogger(__name__)


class Cache(object):
    """Geolocation SQLite cache"""
    def __init__(self, fn='data/openeyes.sqlite'):
       self.conn = conn = sqlite3.connect(fn)
       cur = conn.cursor()
       cur.execute('CREATE TABLE IF NOT EXISTS '
                   'geo ( '
                   'address STRING PRIMARY KEY, '
                   'location BLOB '
                   ')')
       conn.commit()

    def address_cached(self, address):
        cur = self.conn.cursor()
        cur.execute('SELECT location FROM geo WHERE address=?', (address,))
        res = cur.fetchone()
        if res is None:
            return False
        return pickle.loads(res[0])

    def save_to_cache(self, address, location):
        cur = self.conn.cursor()
        cur.execute('INSERT INTO geo(address, location) VALUES(?, ?)',
                    (address, sqlite3.Binary(pickle.dumps(location, -1))))
        self.conn.commit()


def get_location(address):
    """Get location from cache and OpenStreetmap Nominatim server

    Args:
        address (string): Address
    
    Returns:
        location (string): Raw location data
    """
    cache = Cache()
    location = cache.address_cached(address)

    if location != False:
        logging.debug('CACHE - search string "%s" - location "%s"' %
        (address, location.raw['display_name']))
        return location.raw
    
    logging.info('Nominatim - search string "%s"' % address)
    # OpenStreetMap Nominatim (Policy: 1 request / sec)
    g = geopy.geocoders.Nominatim(user_agent='myapplication')
    location = g.geocode(address, language='en')

    if location == None:
        logger.warning('Nominatim - search string "%s" - not found' % address)
        return
    else:
        logging.info('found as: %s' % (location.raw['display_name']))
        cache.save_to_cache(address, location)
        logging.info('CACHED - search string "%s" - now cached address' % address)
        return location.raw


def get_location_data(location):
    """Location data

    Args:
        location (string): Location (example: City, Country)

    Returns:
        latitude, longitude, address (dict): Latitude, Longitude, Address
    """
    try:
        loc = get_location(location)
        logger.debug('latitude: "%s", longitude: "%s", address: "%s"' % (loc['lat'], loc['lon'], loc['display_name']))
        return {'latitude': loc['lat'], 'longitude': loc['lon'], 'address': loc['display_name']}
    except Exception:
        return {}


# location example: "Zagreb, Croatia"
def timezone_offset(location_data):
    """ Timezone and UTC offset for location
    
    Args
        location (dict): longitude, latitude

    Returns
        timezone, utc_offset (list): Timezone, UTC offset
    """
    try:
        tf = TimezoneFinder()
        timezone = tf.timezone_at(lng=location_data['longitude'], lat=location_data['latitude'])
        utc_offset = datetime.now(pytz.timezone(timezone)).strftime('%z')
        return {'timezone': timezone, 'utc_offset': utc_offset}
    except Exception:
        return {}
