	var device;
	var cookieDomain = "jibarra64.github.io";
	var cookiePath = "/";
    var deviceArray;

    var particle = new Particle();

    function QueueCallFunc(device, func, param) {
        this.device = device;
        this.func = func;
        this.param = param;
    }

    function getDeviceForId(id) {
        var dev;
        for (var i = 0; i < deviceArray.length; i++) {
            if (deviceArray[i].id == id) {
                dev = deviceArray[i];
            }
        }
        return (dev);
    }

    function callbackOnLoggedIn(callback) {
        var token = checkTokenExists();
        if (token) {
            particle.listDevices({auth: token}).then(function(devices) {
                                     var id = getCookie('id');
                                     for (var i = 0; i < devices.body.length; i++) {
                                         if (devices.body[i].id == id) {
                                            device = devices.body[i];
                                            if (callback) {
                                                callback();
                                            }
                                            break;
                                         }
                                     }
                                     });
        }
        else {
            window.location.href = '../signin/index.html';
        }
    }

	function setDevice(id) {
        console.log('set id' + id)
    
        setSessionCookie('id', id);
        window.location='actions.html';
	}

    function formatRSSI(rssi) {
        var signalPercent = Math.round((Number(rssi) + 127)/127 * 100);
        return (signalPercent + '%');
    }

    function updateDeviceStatus(statusObject) {
        var id = statusObject.coreid;
        var id = document.getElementById(id);
        var status = id.getElementsByClassName('status');
        var rssi = id.getElementsByClassName('rssi');
        var buf = statusObject.data.split(",");
        status[0].innerHTML = buf[0]; // status
        rssi[0].innerHTML = formatRSSI(buf[7]); // RSSI
    }
	
    function setActiveTarget(evt) {
        var target = evt.target.value;
        //console.log('set active target:' + this.value);
        console.log('set active target:' + target);
        addFunctionToQueue(device.id, 'cmd', 'setActiveTarget' + ',' + target);
    }

    function doAction() {
        console.log('doAction');
        console.log("Update setting " + this.id + " " + this.value);
        addFunctionToQueue(device.id, 'cmd', this.id + ',' + this.value);
    }

    function updateStatus(str) {
		var i = 0;
		if (!str) {
			document.getElementById("status").innerHTML = "ERROR: status timed out";
		}
		else {
			var buf = str.split(",");
			
			// status string
			var val = buf[i++];
			var status = document.getElementById("status");
			status.innerHTML = val;
			if (val == "Sleeping") {
				status.style.color = "blue";
			}
			if (val == "Resetting") {
				status.style.color = "yellow";
			}
			if (val == "Tracking") {
				status.style.color = "green";
			}
			
			var date = new Date(buf[i++] * 1000);
			var hours = date.getUTCHours();
			var minutes = "0" + date.getUTCMinutes();
			var seconds = "0" + date.getUTCSeconds();
			// will display time in 10:30:23 format
			var formattedTime = hours + ':' + minutes.substr(-2) + ':' + seconds.substr(-2);
			document.getElementById("time").innerHTML = formattedTime;
			
			// active target
			document.getElementById("activeTarget").innerHTML = (Number(buf[i++]) + 1);
			
			// sun position
			document.getElementById("sunPositionAlt").innerHTML = buf[i++];
			document.getElementById("sunPositionAz").innerHTML = buf[i++];
			
			// heliostat position
			document.getElementById("helioPositionAlt").innerHTML = buf[i++];
			document.getElementById("helioPositionAz").innerHTML = buf[i++];
		}
    }

    function saveSettings() {
        console.log('save settings');
        var settingElements = document.getElementsByClassName("setting");
        for (var i = 0; i < settingElements.length; i++) {
            updateSetting(settingElements[i]);
        }
    }

    function updateSetting(element) {
        callbackOnLoggedIn();
        
        if (element.id.substring(0, 6) == "target") {
            console.log("Update target " + element.id.slice(-1) + " " + element.id.substring(6, 8));
            //device.callFunction('cmd', 'target' + ',' + element.id.slice(-1) + ',' + element.id.substring(6, 8) + ',' + element.value);
            addFunctionToQueue(device.id, 'cmd', 'target' + ',' + element.id.slice(-1) + ',' + element.id.substring(6, 8) + ',' + element.value);
        }
        else {
            console.log("Update setting " + element.id + " " + element.value);
            //device.callFunction('cmd', element.id + ',' + element.value);
            addFunctionToQueue(device.id, 'cmd', element.id + ',' + element.value);
        }
    }

    // Utility func - similar behavior to select input for bootstrap
    function setDriveType(e, val) {
        e.value = val; // set input value (hidden)
        e.previousElementSibling.previousElementSibling.innerHTML = val + ' <span class="caret"></span>'; // update button text
        
        var laDisabled = false;
        if (val == 'Wormgear') {
            laDisabled = true;
        }

        if (e.id == "driveAlt") {
            var laElements = document.getElementsByClassName("la-setting-alt");
        }
        else {
            // driveAz
            var laElements = document.getElementsByClassName("la-setting-az");
        }
        
        for (var i = 0; i < laElements.length; i++) {
            laElements[i].disabled = laDisabled;
        }
    }

    function callbackQueueEmpty() {
        // Notify operation complete
    }

    function callbackFunctionComplete(err, data) {
        var queueObj = funcQ.slice(0)[0];
        console.log('callbackfunctionQueue ' + queueObj);
        if (err) {
            console.log('error');
        }
        else {
            console.log('success' + queueObj);
            funcQ.shift();
        }
        if (funcQ.length) {
            // Peek at the next item in the queue. 
            queueObj = funcQ.slice(0)[0];
            console.log(queueObj);
            var dev = queueObj.device;
            var func = queueObj.func;
            var param = queueObj.param;

            funcPr = particle.callFunction( {   deviceId: dev,
                                                name: func,
                                                argument: param,
                                                auth: checkTokenExists()
                                            });
            funcPr.then(
                    function(data) {
                        callbackFunctionComplete(0, data);
                    }, 
                    function(error) {
                        callbackFunctionComplete(error, 0);
                    });        
        }
        else {
            callbackQueueEmpty();
        }
    }

    var funcQ = [];
    function addFunctionToQueue(dev, func, param) {
        var queueItem = new QueueCallFunc(dev, func, param);
        funcQ.push(queueItem);
        console.log('addFunctionToQueue ' + dev + ' ' + func + ' ' + param);
        console.log(funcQ);
        
        if (funcQ.length == 1) {
            // prime first function call
            funcPr = particle.callFunction(   {   deviceId: dev,
                                                name: func,
                                                argument: param,
                                                auth: checkTokenExists()
                                            });
            funcPr.then(
                         function(data) {
                            callbackFunctionComplete(0, data);
                         },
                         function(error) {
                            callbackFunctionComplete(error, 0);
                         });
        }
    }

    function getTargets(callback) {
        funcPr = particle.callFunction({    deviceId: device.id,
                                            name: 'cmd',
                                            argument: 'getTargets',
                                            auth: checkTokenExists()
                           });
        funcPr.then(
                     function(data) {
                            console.log('Function called succesfully:', data);
                            particle.getVariable({  deviceId: device.id,
                                                    name: 'cloudBuf',
                                                    auth: checkTokenExists()
                                              }).then(function(data) {
                                                      console.log("Event: " + JSON.stringify(data.body));
                                                      var str = JSON.parse(JSON.stringify(data.body));
                                                      var target = str.result.split(",");
                                                      console.log(target);
                                                      for (var i = 0; i < 4; i++) {
                                                        document.getElementById("targetal" + i).value = target[2*i];
                                                        document.getElementById("targetaz" + i).value = target[2*i + 1];
                                                      }
                                                      if (callback) callback();
                                                },
                                                function(error) {
                                                      console.log("error!");
                                                });
                     },
                     function(error) {
                        console.log('An error occurred:', error);
                     });
    }

    function getBasicSettings(callback) {
        funcPr = particle.callFunction({    deviceId: device.id,
                                            name: 'cmd',
                                            argument: 'getBasicSettings',
                                            auth: checkTokenExists()
                                       });
        funcPr.then(
                    function(data) {
                        particle.getVariable({  deviceId: device.id,
                                                name: 'cloudBuf',
                                                auth: checkTokenExists()
                                         }).then(function(data) {
                                                 console.log("Event: " + JSON.stringify(data.body));
                                                 var str = JSON.parse(JSON.stringify(data.body));
                                                 var buf = str.result.split(",");
                                                 var i = 0;
                                                 document.getElementById("helioVersion").innerHTML = buf[i++];
                                                 document.getElementById("latitude").value = buf[i++];
                                                 document.getElementById("longitude").value = buf[i++];
                                                 document.getElementById("timezone").value = buf[i++];
                                                 document.getElementById("motorspeed").value = buf[i++];
                                                 document.getElementById("setInterval").value = buf[i++];
                                                 document.getElementById("buildTime").innerHTML = buf[i++];
                                                 if (callback) callback();
                                            },
                                            function(error) {
                                                 console.log("error");
                                            });
                    },
                    function(error) {
                        console.log("An error occured:", error);
                    });
        
    }

    function getAdvancedSettings(callback) {
        funcPr = particle.callFunction({    deviceId: device.id,
                                            name: 'cmd',
                                            argument: 'getAdvSettings',
                                            auth: checkTokenExists()
                                       });
        funcPr.then(
                    function(data) {
                        particle.getVariable({  deviceId: device.id,
                                                name: 'cloudBuf',
                                                auth: checkTokenExists()
                                           }).then(function(data) {
                                               console.log("Event: " + JSON.stringify(data.body));
                                               var str = JSON.parse(JSON.stringify(data.body));
                                               var buf = str.result.split(",");
                                               var i = 0;
                                               document.getElementById("azAlen").value = buf[i++];
                                               document.getElementById("azBlen").value = buf[i++];
                                               document.getElementById("altAlen").value = buf[i++];
                                               document.getElementById("altBlen").value = buf[i++];
                                               document.getElementById("altStartAngle").value = buf[i++];
                                               document.getElementById("azStartAngle").value = buf[i++];
                                               document.getElementById("altMinAngle").value = buf[i++];
                                               document.getElementById("altMaxAngle").value = buf[i++];
                                               document.getElementById("azMinAngle").value = buf[i++];
                                               document.getElementById("azMaxAngle").value = buf[i++];
                                               
                                               var driveAlt = buf[i++];
                                               if (driveAlt == 0) {
                                                   // linear actuator type
                                                   setDriveType(document.getElementById("driveAlt"), 'Linear Actuator');
                                               }
                                               else if (driveAlt == 1) {
                                                   // wormgear type
                                                   setDriveType(document.getElementById("driveAlt"), 'Wormgear');
                                               }
                                               
                                               var driveAz = buf[i++];
                                               if (driveAz == 0) {
                                               // linear actuator type
                                                   setDriveType(document.getElementById("driveAz"), 'Linear Actuator');
                                               }
                                               else if (driveAz == 1) {
                                                   // wormgear type
                                                   setDriveType(document.getElementById("driveAz"), 'Wormgear');
                                               }
                                               
                                               document.getElementById("gearRatioAlt").value = buf[i++];
                                               document.getElementById("gearRatioAz").value = buf[i++];
                                               
                                               document.getElementById("safetyTimeout").value = buf[i++];
                                               document.getElementById("trackingTimeout").value = buf[i++];
                                               
                                               if (callback) callback();
                                            },
                                            function(error) {
                                                   console.log('error: ', error);
                                            });
                    },
                    function(error) {
                        console.log('error: ', error);
                    });
    }

	function updateDeviceList(devices) {
		console.log("update device list");
		var devTable = document.getElementById("deviceTable");
		//devList.innerHTML = '';
		console.log(devices);
		devTable.size = devices.length;
        
        particle.getEventStream({   deviceId: 'mine',
                                    name: 'status',
                                    auth: checkTokenExists()
                                }).then(function(stream) {
                                        stream.on('event', function(data) {
                                            console.log("Status: " + JSON.stringify(data));
                                            var statusObject = JSON.parse(JSON.stringify(data));
                                            updateDeviceStatus(statusObject);
                                        });
                                });
        
		for (var i = 0; i < devices.length; i++) {
            var id = devices[i].id;
            var state = devices[i].connected ? 'online' : 'offline';
			devTable.innerHTML += "<tr id=" + id + " class=" + state + "> \
			  <td><input type='checkbox'></td> \
              <td class=clickable>" + devices[i].name + "</td> \
			  <td>" + state + "</td> \
			  <td class='status'></td> \
			  <td class='rssi'></td> \
			  <td></td> \
			</tr>";
		}
	}

    function updateTargetControls(statusObject) {
        console.log("updateTargetControls");
        var buf = statusObject.data.split(",");
        var targetIndex = buf[2]; // target
        var targetElement = document.getElementById('target' + targetIndex);
        targetElement.innerHTML = " \
         <div class='btn-group-vertical'> \
             <button type='button' class='btn btn-primary'>^</button> \
             <div class='btn-group-horizontal'> \
                 <button type='button' class='btn btn-primary'><</button> \
                 <button type='button' class='btn btn-primary'>></button> \
             </div> \
             <button type='button' class='btn btn-primary'>V</button> \
         </div>";
    }

    function showTargetControls() {
        particle.getEventStream({   deviceId: device.id,
                                    name: 'status',
                                    auth: checkTokenExists()
                                    }).then(function(stream) {
                                            stream.on('event', function(data) {
                                                      console.log("Status: " + JSON.stringify(data));
                                                      var statusObject = JSON.parse(JSON.stringify(data));
                                                      updateTargetControls(statusObject);
                                                      });
                                            });
    }

    function batchCmd(cmds) {
        console.log("batch cmds: " + cmds.length);
        var inputs = document.getElementsByTagName("input");
        var checked = [];
        for (var i = 1; i < inputs.length; i++) {
            if (inputs[i].type == "checkbox") {
                if (inputs[i].checked) {
                    checked.push(inputs[i]);
                }
            }
        }
        for (var i = 0; i < checked.length; i++) {
            var e = checked[i];
            while (e && e.nodeName != "TR") {
                e = e.parentNode;
            }
            console.log(e.id);
            var dev = getDeviceForId(e.id);
            if (dev.connected) {
                for (var j = 0; j < cmds.length; j++) {
                    addFunctionToQueue(e.id, 'cmd', cmds[j]);
                    console.log(cmds[j]);
                }
            }
            else {
                console.log("Device " + dev.name + " not connected!");
            }
        }
    }

    function showOfflineDevices(val) {
        var e = document.getElementsByClassName("offline");
        var display = '';
        if (!val) {
            display = 'none';
        }
        for (var i = 0; i < e.length; i++) {
            e[i].style.display = display;
        }
    }

    function manualMove() {
        var relAlt = document.getElementById("manualAltPos").value;
        var relAz = document.getElementById("manualAzPos").value;
        console.log('manual move alt: ' + relAlt + ' az: ' + relAz);
        //device.callFunction('cmd', 'manualMove' + ',' + relAlt + ',' + relAz);
        addFunctionToQueue(device.id, 'cmd', 'manualMove' + ',' + relAlt + ',' + relAz);
    }

    function deviceList() {
        console.log('list');
        var token = checkTokenExists();
        if (token) {
            particle.listDevices({auth: token}).then(function(data) {
                                                     deviceArray = data.body;
                                                     updateDeviceList(data.body);
                                     });
        }
        else {
            window.location.href = '../signin/index.html';
        }
    }
	
	function login() {
        console.log("login called");
		var children = this.parentNode.children;
        particle.login({username: children.inputEmail.value, password: children.inputPassword.value}).then(
			function(data) {
                document.cookie = 'token=' + data.body.access_token + ';domain=' + cookieDomain + ';path=' + cookiePath;
                if (children.rememberme.checked) {
                    document.cookie = 'user=' + children.inputEmail.value + ';domain=' + cookieDomain + ';path=' + cookiePath + ';expires=Thu, 31 Dec 2020 12:00:00 UTC';
                }
                else {
                    document.cookie = 'user=' + ';domain=' + cookieDomain + ';path=' + cookiePath
                }
                window.location.href = '../dashboard/devices.html';
			},
			function(err) {
				console.log('error');
                var loginStatus = document.getElementById('loginStatus');
                loginStatus.innerHTML = "<div class='alert alert-danger alert-dismissible' role='alert'><button type='button' class='close' data-dismiss='alert' aria-label='Close'><span aria-hidden='true'>&times;</span></button>Incorrect username or password!</div>";
			}
		);
	}

    function logout() {
        console.log("logout");
        document.cookie = 'token=;' + 'domain=' + cookieDomain + ';path=' + cookiePath;
        window.location.href = '../signin/index.html';
    }

	function checkTokenExists() {
		var token = getCookie('token');
		if (token != "") {
			console.log("found valid token");
			particle.accessToken = token;
            return token;
		}
		 else {
			console.log("no valid token, login..");
			return false;
		 }
	}
	
	function getCookie(cname) {
	console.log('cookie ' + document.cookie);
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
    }
    return "";
	}

    function setSessionCookie(name, value) {
        document.cookie = name + '=' + value +';domain=' + cookieDomain + ';path=' + cookiePath;
    }

    function toggleAllCheckboxesSelected(val) {
        var inputs = document.getElementsByTagName("input");
        for (var i = 0; i < inputs.length; i++) {
            if (inputs[i].type == "checkbox") {
                inputs[i].checked = val;
            }
        }
    }

    function adjustTargetPosition(evt) {
        console.log("adjust target position");
        var increment = $('#increment').val();
        var activeTarget = $('.targetSelect:checked').val();
        var altitude = $('#targetal' + activeTarget).val();
        var azimuth = $('#targetaz' + activeTarget).val();
        console.log("current alt: " + altitude + "current az: " + azimuth);
        if (evt.currentTarget.id == "up") {
            altitude = parseFloat(altitude) + parseFloat(increment);
        }
        else if (event.currentTarget.id == "down") {
            altitude = parseFloat(altitude) - parseFloat(increment);
        }
        else if (event.currentTarget.id == "left") {
            azimuth = parseFloat(azimuth) - parseFloat(increment);
        }
        else if (event.currentTarget.id == "right") {
            azimuth = parseFloat(azimuth) + parseFloat(increment);
        }
        console.log("increment: " + increment);
        console.log("new alt: " + altitude + "new az: " + azimuth);
        $('#targetal' + activeTarget).val(altitude);
        $('#targetaz' + activeTarget).val(azimuth);
        addFunctionToQueue(device.id, 'cmd', 'testTargetPos' + ',' + altitude + ',' + azimuth);
    }
