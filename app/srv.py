import json
import resource
from os import makedirs, path, remove, rename, system
from pathlib import Path
from threading import Thread
from time import sleep

import logging
from flask_compress import Compress
from flask import Flask, render_template, redirect, url_for, send_from_directory, jsonify
from logging.config import fileConfig

if not path.exists('log'):
    makedirs('log')

from config import country_list, country_list_wuc, FLASK_HOST, FLASK_PORT, FLASK_DEBUG, FLASK_THREADED, FLASK_SECRET, markers_list
from controllers import scrape, markers_list, wuc_streams, wuc_stream, wuc_cams_update


if not path.exists('data'):
    makedirs('data')

if not path.exists('data/whatsupcams'):
    makedirs('data/whatsupcams')

log_file_path = path.join(path.dirname(path.abspath(__file__)), 'logging.conf')
fileConfig(log_file_path, disable_existing_loggers=False)
logger = logging.getLogger(__name__)

# Issue: NetworkError
# NOFILE=1024 - to many CLOSE_WAIT and resource busy
resource.setrlimit(resource.RLIMIT_NOFILE, (4096, 4096))

app = Flask(__name__)
Compress(app)
app.secret_key = FLASK_SECRET


@app.route('/favicon.ico', methods=['GET'])
def favicon():
    return send_from_directory(path.join(app.root_path, 'static/img'),
    'favicon.ico', mimetype='image/vnd.microsoft.icon')


@app.route('/', methods=['GET'])
def map_page():
    """Map page

    Return:
        index page: Map page
    """
    return render_template('index.html')


@app.route('/get_cams', methods=['GET'])
def get_scrape_cams_json():
    """Load markers from JSON file

    Return:
        markers (json): Markers data
    """
    try:
        data_file = open('data/markers.json')
        data = json.load(data_file)
        data_file.close()
        return jsonify(data), 200
    except Exception:
        return {}, 200


@app.route('/scrape_cams', methods=['GET'])
def scrape_cams_json():
    """Update markers JSON file

    Returns:
        redirect: Map page
    """
    try:
        system('rm data/markers_loading.json')
    except Exception:
        pass

    system('touch data/markers_loading.json')

    threads = []
    for y in range(0, len(country_list)):
        threads.append(Thread(target=scrape, args=(country_list[y], )))

    for x in threads:
        x.start()

    for x in threads:
        x.join()

    with open('./data/markers_loading.json', 'w', encoding='utf8') as markers_file:
        json.dump(markers_list, markers_file)

    system('mv data/markers_loading.json data/markers.json')
    return redirect(url_for('map_page'))


#
# Whatsupcams
#
@app.route('/whatsupcams', methods=['GET'])
def map_wuc_page():
    """Render template map Whatsupcams

    Return
        render template: /whatsupcams
    """
    return render_template('map-whatsupcams.html')


@app.route('/whatsupcams/cams', methods=['GET'])
def wuc_cams():
    """Read Whatsupcams markers in JSON

    Return
        Markers (json): Camera Markers
    """
    try:
        data_file = open('data/markers-whatsupcams.json')
        data = json.load(data_file)
        data_file.close()
        return jsonify(data), 200
    except Exception:
        return {}, 200


@app.route('/whatsupcams/streams/update', methods=['GET'])
def wuc_streams_json_update():
    """Update Whatsupcams streams data/whatsupcams/streams.json

    Return
        redirect (URL): /whatsupcams
    """
    wuc_streams_json = wuc_streams()
    with open('./data/whatsupcams/streams.json', 'w', encoding='utf-8') as streams_file:
        json.dump(wuc_streams_json, streams_file, ensure_ascii=False, indent=4)
    return redirect(url_for('map_wuc_page'))


# Update files streams/<stream_id>.json
@app.route('/whatsupcams/streams/stream/update', methods=['GET'])
def wuc_stream_json_update():
    """Update Whatsupcams stream files data/whatsupcams/streams/<stream_id>.json

    Return
        redirect (URL): /whatsupcams
    """
    stream_list = []

    if not path.exists('data/whatsupcams/streams'):
        makedirs('data/whatsupcams/streams')

    # Load stream ID (stream name) from JSON file
    data_file = open('data/whatsupcams/streams.json')
    data = json.load(data_file)
    data_file.close()
    stream_list = sorted([i for i in data if i])
    app.logger.info(stream_list)

    # Add stream_id to list if json file doesn't exist
    for stream_id in stream_list:
        stream_json = 'data/whatsupcams/streams/%s.json' % stream_id

        if not path.exists(stream_json):
            app.logger.info('Update JSON file: %s' % stream_json)
            wuc_stream_json = wuc_stream(stream_id)

            with open(stream_json, 'w', encoding='utf-8') as stream_file:
                json.dump(wuc_stream_json, stream_file, ensure_ascii=False, indent=4)

    return redirect(url_for('map_wuc_page'))


@app.route('/whatsupcams/cams/update', methods=['GET'])
def wuc_cams_json_update():
    """Update Whatsupcams camera markers

    Returns:
        redirect: url_page /whatsupcams
    """
    if path.exists('./data/markers-whatsupcams_loading.json'):
        remove('./data/markers-whatsupcams_loading.json')
        
    Path('./data/markers-whatsupcams_loading.json').touch()

    for y in range(0, len(country_list)):
        wuc_cams_update(country_list[y])

    with open('./data/markers-whatsupcams_loading.json', 'w', encoding='utf8') as markers_file:
        json.dump(markers_list, markers_file)

    rename('./data/markers-whatsupcams_loading.json', 'data/markers-whatsupcams.json')
    return redirect(url_for('map_wuc_page'))


#
# Admin
#
@app.route('/admin', methods=['GET'])
def admin_page():
    """Administration page

    Return:
        admin page (302): Administration page
    """
    return render_template('admin.html')


if __name__ == '__main__':
    app.logger.info('Started')
    app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        debug=FLASK_DEBUG,
        threaded=FLASK_THREADED
    )
    app.logger.info('Finished')
