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

function initMap() {
    $("#map").hide();

    // Init map
    var map = new google.maps.Map(document.getElementById("map"), {
        zoom: 5,
        center: new google.maps.LatLng(45.543, 25.910),
        panControl: true,
        zoomControl: true,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    var infowindow = new google.maps.InfoWindow();

    var markers = []
    $.getJSON("/get_cams", function (locations) {
        for (let i = 0; i < locations.length; i++) {
            const data = locations[i];

            const lat = data['lat'];
            const lng = data['lng'];
            const city = data['city'];
            const stream = data['stream'];
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
            let marker = new google.maps.Marker({
                position: latLng,
                map: map,
                url: stream
            });

            // Marker click listener
            google.maps.event.addListener(marker, "click", (function (marker) {
                return function () {
                    const content = `
                    <table>
                        <tr>
                            <a target="_blank" href="${stream}">
                                <img src="${stream}" height='100%' width='100%'/>
                            </a>
                        </tr>
                        <tr>
                            <td class="title">Stream</td>
                            <td class="info"><a target="_blank" href="${stream}">${stream}</a></td>
                        </tr>
                        <tr>
                            <td class="title">Country</td>
                            <td class="info">${country} (${country_code})</td>
                        </tr>
                        <tr>
                            <td class="title">Coordinates</td>
                            <td class="info"><a target="_blank" href="https://www.google.com/maps/place/${lat},${lng}">${lat}, ${lng}</a></td>
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
                        <tr>
                            <td class="title">Manufacturer</td>
                            <td class="info"><a target="_blank" href="https://www.google.com/search?q=${manufacturer}">${manufacturer}</a></td>
                        </tr>
                    </table>
                    `;

                    infowindow.setContent(content);

                    infowindow.open(map, marker);
                }
            })(marker));

            markers.push(marker);
        }
        $("#loader").hide();
        $("#map").show();
    });
    
    addLocationButton(map);
    addButtonOptions(map);

    google.maps.event.addListener(map, 'click', function () {
        infowindow.close();
    });
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
            map.panTo(new google.maps.LatLng(35.543, 0));
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
    //alert(ddDivOptions.items[1]);
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
