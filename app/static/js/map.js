var uuid;


$(document).ready(function () {
    window.initMap = initMap;
    $("#download-loader").hide();
});


// Normalize overlapping markers
function correctPosition(lat, lng) {
    const min = 1;
    const max = 500;

    let random_number = Math.floor(Math.random() * (max - min + 1) + min);

    random_number = "0.000" + random_number.toString();
    random_number = parseFloat(random_number);

    return new google.maps.LatLng(lat + random_number, lng + random_number)
}

function addLocationButton(map) {
    var controlDiv = document.createElement('div');

    var firstChild = document.createElement('button');
    firstChild.classList.add("divLocation");
    firstChild.title = 'Your Location';
    controlDiv.appendChild(firstChild);

    var secondChild = document.createElement('div');
    secondChild.classList.add("divLocationInner");
    firstChild.appendChild(secondChild);

    google.maps.event.addListener(map, 'center_changed', function () {
        secondChild.style['background-position'] = '0 0';
    });

    firstChild.addEventListener('click', function () {
        var imgX = '0',
            animationInterval = setInterval(function () {
                imgX = imgX === '-18' ? '0' : '-18';
                secondChild.style['background-position'] = imgX + 'px 0';
            }, 500);

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var latlng = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
                map.setCenter(latlng);
                clearInterval(animationInterval);
                secondChild.style['background-position'] = '-144px 0';
            });
        } else {
            clearInterval(animationInterval);
            secondChild.style['background-position'] = '0 0';
        }
    });

    controlDiv.index = 1;
    map.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(controlDiv);
}

function CreateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    )
}

function requestFullscreen(element) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.mozRequestFullscreen) { /* Mozilla */
        element.mozRequestFullscreen();
    } else if (element.webkitRequestFullscreen) { /* Safari */
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE11 */
        element.msRequestFullscreen();
    }
}

function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullscreen) { /* Mozilla */
        document.mozCancelFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
    }
}

function toggleFullscreen(element) {
    if (document.fullscreenElement === null) {
        requestFullscreen(element);
    } else {
        exitFullscreen();
    }
}

function videoFullscreenClickHandler(event) {
    // `this` is the player in this context
    if (this.isFullscreen()) {
        this.exitFullscreen || this.mozCancelFullScreen || this.webkitExitFullscreen || this.msExitFullscreen
    } else {
        this.requestFullscreen || this.mozRequestFullScreen || this.webkitRequestFullscreen || this.msRequestFullscreen
    }
};

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}

function initMap() {
    $("#map").hide();

    // Init map - default zoom: 5
    var map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: new google.maps.LatLng(45.543, 25.910),
        panControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    var infowindow = new google.maps.InfoWindow();
    var markers = []

    const map_site_insecam = 'insecam';
    const map_site_wuc = 'wuc';
    var map_site = '';
    var video_type = '';

    map_site = getCookie('site');

    var get_cams = '';


    switch(map_site) {
        case 'insecam':
            get_cams = '/get_cams';
            video_type = 'mjpeg';
            break;
        case 'wuc':
            get_cams = '/whatsupcams/cams';
            video_type = 'hls';
            break;
    }

    $.getJSON(get_cams, function (locations) {
        for (let i = 0; i < locations.length; i++) {
            const data = locations[i];

            const lat = data['lat'];
            const lng = data['lng'];
            const city = data['city'];
            const stream = data['stream'];
            const stream2 = data['stream2'];
            // let id = data['id'];
            const country = data['country'];
            const country_code = data['country_code'];
            const region = data['region'];
            const zip = data['zip'];
            const timezone = data['timezone'];
            const manufacturer = data['manufacturer'];            

            let latLng = new google.maps.LatLng(lat, lng);

            // Correct position if marker has exact position with another one.
            if (markers.length != 0) {
                for (let y = 0; y < markers.length; y++) {
                    if (markers[y].getPosition().equals(latLng)) {
                        latLng = correctPosition(lat, lng);
                    }
                }
            }

            // Create marker
            // default: url: stream
            let marker = new google.maps.Marker({
                position: latLng,
                map: map,
                url: stream
            });

            // Marker click listener
            google.maps.event.addListener(marker, "click", (function (marker) {
                return function () {
                    if (video_type == 'hls') {
                        // remove the html associated with videojs player
                        if(document.getElementById('video-' + uuid)) {
                            var oldPlayer = document.getElementById('video-' + uuid);
                            videojs(oldPlayer).dispose();
                        }
                    }

                    uuid = CreateUUID();

                    const video_hls = `
                        <video id="video-${uuid}" width=100% height=100% class="video-js vjs-default-skin" controls autoplay>
                            <source src="${stream}" type="application/x-mpegURL">
                            <p class="vjs-no-js">
                                To view this video please enable JavaScript, and consider upgrading to a web browser that
                                <a href="https://videojs.com/html5-video-support/" target="_blank">supports HTML5 video</a>
                            </p>
                        </video>
                    `;

                    const video_mjpeg = `
                        <div align="center" style="background-color:#000000">
                            <img id="video-${uuid}" class="canfullscreen" src="${stream}" width='480' height='270'/>
                        </div>
                    `;

                    var video = '';

                    switch(video_type) {
                        case 'hls':
                            video = video_hls;
                            break;
                        case 'mjpeg':
                            video = video_mjpeg;
                            break;
                    }
                    
                    stream2_url = ''
                    if (stream2 != undefined) {
                        stream2_url = '<a target="_blank" href="' + stream2 + '">' + stream2 + '</a>'
                    }

                    const content = `
                    <table>
                        <tr>
                            ` + video + `
                        </tr>
                        <tr>
                            <td class="title">Stream</td>
                            <td class="info"><a target="_blank" href="${stream}">${stream}</a></td>
                        </tr>
                        <tr class="tr-stream2">
                            <td class="title">Stream</td>
                            <td class="info">` + stream2_url + `</td>
                        </tr>
                        <tr>
                            <td class="title">Coordinates</td>
                            <td class="info"><a target="_blank" href="https://www.google.com/maps/place/${lat},${lng}">${lat}, ${lng}</a></td>
                        </tr>
                        <tr>
                            <td class="title">Country</td>
                            <td class="info">${country} (${country_code})</td>
                        </tr>
                        <tr>
                            <td class="title">Region</td>
                            <td class="info"class="info">${region}</td>
                        </tr>
                        <tr>
                            <td class="title">City</td>
                            <td class="info">${city}</td>
                        </tr>
                        <tr>
                            <td class="title">ZIP</td>
                            <td class="info">${zip}</td>
                        </tr>
                        <tr>
                            <td class="title">Timezone</td>
                            <td class="info">${timezone}</td>
                        </tr>
                        <tr class="manufacturer">
                            <td class="title">Manufacturer</td>
                            <td class="info"><a target="_blank" href="https://www.google.com/search?q=${manufacturer}">${manufacturer}</a></td>
                        </tr>
                    </table>
                    `;

                    infowindow.setContent(content);
                    infowindow.open(map, marker);

                    google.maps.event.addListener(infowindow, 'domready', function () {
                        if (video_type == 'mjpeg') {
                            document.addEventListener('click', function(e){
                                var target = e.target
                                if (target.tagName == "IMG" && target.classList.contains('canfullscreen')) {
                                    image = this.getElementById('video-' + uuid);
                                    // Full screen
                                    toggleFullscreen(image);
                                }
                            }, false)
                        }

                        if (video_type == 'hls') {
                            // videojs player - via the constructor
                            var player = videojs('video-' + uuid, {
                                fluid: true,
                                controlBar: {
                                    fullscreenToggle: true,
                                    pictureInPictureToggle: false,
                                    playToggle: false
                                },
                                html5: {
                                    vhs: {
                                        overrideNative: true
                                    },
                                    nativeAudioTracks: false,
                                    nativeVideoTracks: false
                                },
                                userActions: {
                                    // Click on video - Fullscreen
                                    click: videoFullscreenClickHandler,
                                    hotkeys: function(event) {
                                        // `F` key = Fullscreen
                                        if (event.which === 70) {
                                            /*
                                            if (this.isFullscreen()) {
                                                this.exitFullscreen();
                                            } else {
                                                this.requestFullscreen();
                                            }
                                            */
                                            toggleFullscreen(this);
                                        }
                                    }
                                }
                            });
                            
                            player.play();
                        }
                        
                        // Set focus on video
                        $("#video-" + uuid).focus();
                    });

                }
            })(marker));

            markers.push(marker);
        }
        $("#loader").hide();
        $("#map").show();
    });

    google.maps.event.addListener(map, 'click', function () {
        if (video_type == 'hls') {
            // remove the html associated with videojs player
            if(document.getElementById('video-' + uuid)) {
                var oldPlayer = document.getElementById('video-' + uuid);
                videojs(oldPlayer).dispose();
            }
        }

        infowindow.close();
    });

    addLocationButton(map);
    addButtonOptions(map);

}// InitMap

function addButtonOptions(map) {
    //start process to set up custom drop down
    //create the options that respond to click
    var divOptions1 = {
        gmap: map,
        name: '<i class="fa-solid fa-video"></i> Insecam',
        title: "This acts like a button or click event",
        id: "mapOpt",
        action: function() {
            window.location.replace("/");
        }
    }
    var optionDiv1 = new optionDiv(divOptions1);
    
    var divOptions2 = {
        gmap: map,
        name: '<i class="fa-solid fa-video"></i> WhatsupCams',
        title: "This acts like a button or click event",
        id: "satelliteOpt",
        action: function(){
            window.location.replace("/whatsupcams");
        }
    }
    var optionDiv2 = new optionDiv(divOptions2);

    //possibly add a separator between controls        
    var sep1 = new separator();

    var divOptions3 = {
        gmap: map,
        name: '<i class="fa-solid fa-home"></i> Home',
        title: "This acts like a button or click event",
        id: "satelliteOpt",
        action: function(){
            map.panTo(new google.maps.LatLng(45.543, 25.910));
        }
    }
    var optionDiv3 = new optionDiv(divOptions3);

    //possibly add a separator between controls        
    var sep2 = new separator();

    var divOptions4 = {
        gmap: map,
        name: '<i class="fa-solid fa-toolbox"></i> Admin',
        title: "This acts like a button or click event",
        id: "satelliteOpt",
        action: function(){
            window.location.replace("/admin");
        }
    }
    var optionDiv4 = new optionDiv(divOptions4);


    //put them all together to create the drop down       
    var ddDivOptions = {
        items: [optionDiv1, optionDiv2, sep1, optionDiv3, sep2, optionDiv4],
        id: "myddOptsDiv"        		
    }
    var dropDownDiv = new dropDownOptionsDiv(ddDivOptions);
            
    var dropDownOptions = {
            gmap: map,
            name: '<i class="fa-solid fa-bars"></i> Cams',
            id: 'ddControl',
            title: 'A custom drop down select with mixed elements',
            position: google.maps.ControlPosition.TOP_RIGHT,
            dropDown: dropDownDiv 
    }
    
    var dropDown1 = new dropDownControl(dropDownOptions);  
}
