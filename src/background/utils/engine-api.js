// TODO: register initiator before each play (engine can restart)
var gDeviceId = null,
    gInitiatorId = null,
    _a = null;

function getUserId(deviceId) {
    var xhr = new XMLHttpRequest(),
        url = "https://auth3.acestream.net/c?a=" + deviceId;
    xhr.open("GET", url, true);
    xhr.timeout = 30000;
    xhr.onreadystatechange = function() {
        if(xhr.readyState == 4) {
            if(xhr.status == 200) {
                var userId = xhr.responseText;
                if(userId) {
                    // register on engine
                    sendRequest({
                        method: "_a",
                        params: {
                            a: _a,
                            b: userId,
                        },
                        onsuccess: function(data) {
                            if(data) {
                                gInitiatorId = data;
                            }
                        },
                        onerror: function(errmsg) {
                        }
                    });
                }
            }
        }
    }
    xhr.send();
}

function checkEngine(callback, retry_count, retry_interval) {
    try {
        var xhr = new XMLHttpRequest();
        var url = "http://127.0.0.1:6878/webui/api/service?method=get_version";
        if(gDeviceId === null) {
            url += "&params=device-id";
        }
        xhr.open("GET", url, true);
        xhr.timeout = 10000;
        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4) {
                var errmsg = "",
                    engineRunning = false,
                    engineVersionString = null,
                    engineVersionCode = 0;
                if(xhr.status == 200) {
                    var response = JSON.parse(xhr.responseText);
                    if(response.error) {
                        engineVersionCode = 0;
                        engineVersionString = null;
                        errmsg = response.error;
                    }
                    else if(!response.result) {
                        engineVersionCode = 0;
                        engineVersionString = null;
                        errmsg = "malformed response from engine";
                    }
                    else {
                        engineVersionCode = parseInt(response.result.code);
                        if(isNaN(engineVersionCode)) {
                            engineVersionCode = 0;
                        }
                        engineVersionString = response.result.version;
                        if(response.result.device_id) {
                            if(gDeviceId !== response.result.device_id) {
                                gDeviceId = response.result.device_id;
                                if(_a) {
                                    getUserId(gDeviceId);
                                }
                            }
                        }
                    }
                }
                else {
                    engineVersionCode = 0;
                    engineVersionString = null;
                    errmsg = "engine returned error: " + xhr.status;
                }
                if(errmsg) {
                    console.log("checkEngine: error: " + errmsg);
                }
                engineRunning = !!engineVersionCode;

                if(typeof callback === "function") {

                    if(!engineRunning && retry_count !== undefined && retry_count > 0) {
                        console.log("Ace Script: check engine failed (" + retry_count + "), next try in " + retry_interval);
                        window.setTimeout(function() {
                            checkEngine(callback, retry_count-1, retry_interval);
                        }, retry_interval);
                    }
                    else {
                        callback.call(null, {
                            running: !!engineVersionCode,
                            versionCode: engineVersionCode,
                            versionString: engineVersionString
                        });
                    }
                }
            }
        }
        xhr.send();
    }
    catch(e) {
        console.log("checkEngine: error: " + e);
    }
}

function makeParams(params) {
    var name, value, result = [];
    for(name in params) {
        value = params[name];
        result.push(name + "=" + encodeURIComponent(value));
    }
    return result.join("&");
}

function sendRequest(details)
{
    function _success(data) {
        if(typeof details.onsuccess === "function") {
            details.onsuccess.call(null, data);
        }
    }

    function _failed(errmsg) {
        console.log("engineapi:request failed: " + errmsg);
        if(typeof details.onerror === "function") {
            details.onerror.call(null, errmsg);
        }
    }

    try {
        if(!details.method) {
            throw "missing method";
        }
        if(!details.params) {
            details.params = {};
        }
        if(!details.api) {
            details.api = "server";
        }
        details.params.method = details.method;

        var baseUrl;
        if(details.api == "server") {
            baseUrl = "http://127.0.0.1:6878/server/api"
        }
        else if(details.api == "service") {
            baseUrl = "http://127.0.0.1:6878/webui/api/service"
        }
        else {
            throw "unknown api: " + details.api;
        }

        var url =  baseUrl + "?" + makeParams(details.params);
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        xhr.timeout = 10000;

        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4) {
                if(xhr.status == 200) {
                    try {
                        var data = JSON.parse(xhr.responseText);
                        if(data.error) {
                            _failed(data.error);
                        }
                        else if(!data.result) {
                            _failed("malformed response from engine");
                        }
                        else {
                            _success(data.result);
                        }
                    }
                    catch(e) {
                        _failed(e);
                    }
                }
                else {
                    _failed("engine returned error: " + xhr.status);
                }
            }
        }
        xhr.send();
    }
    catch(e) {
        AWE_util.logError(e);
    }
}

export function init(a) {
    _a = a;
}

export function getEngineStatus(callback) {
    if(typeof callback !== "function") {
        throw "missing callback in getEngineStatus()";
    }
    checkEngine(function(response) {

        function _send_response(running, version_code) {
            callback.call(null, {
                running: running,
                version: version_code
            });
        }

        if(response.running) {
            _send_response(response.running, response.versionCode);
        }
        else {
            // engine is not running, check it's version by native messaging
            browser.runtime.sendNativeMessage('org.acestream.engine',
                { method: "get_version" },
                function(response) {
                    if(typeof response === "undefined") {
                        console.log("Ace Script: engine messaging host failed");
                        _send_response(false, 0)
                    }
                    else {
                        console.log("Ace Script: got response from engine messaging host: " + JSON.stringify(response));

                        // start engine
                        browser.runtime.sendNativeMessage('org.acestream.engine', {method: "start_engine"}, function(response) {
                            if(typeof response === "undefined") {
                                console.log("Ace Script: failed to start engine");
                                _send_response(false, 0);
                            }
                            else {
                                // wait until engine is started
                                var retry_count = 20, retry_interval = 1000;
                                checkEngine(function(response) {
                                    console.log("Ace Script: engine status after starting: " + JSON.stringify(response));
                                    _send_response(response.running, response.versionCode);
                                }, retry_count, retry_interval);
                            }
                        });
                    }
                });
        }
    });
}

export function startJsPlayer(callback) {
    chrome.runtime.sendNativeMessage('org.acestream.engine',
        { method: "get_version" },
        function(response) {
            if(typeof response === "undefined") {
                console.log("Ace Script:startJsPlayer: engine messaging host failed");
                callback.call(null, false);
            }
            else {
                console.log("Ace Script:startJsPlayer: got response from engine messaging host: " + JSON.stringify(response));

                // start js player
                chrome.runtime.sendNativeMessage('org.acestream.engine', {method: "start_js_player"}, function(response) {
                    if(typeof response === "undefined") {
                        console.log("Ace Script:startJsPlayer: failed to start js player");
                        callback.call(null, false);
                    }
                    else {
                        callback.call(null, response);
                    }
                });
            }
        });
}

export function getAvailablePlayers(details, callback) {
    if(typeof callback !== "function") {
        return;
    }

    var params = {};
    if(details.content_id) {
        params['content_id'] = details.content_id;
    }
    else if(details.transport_file_url) {
        params['url'] = details.transport_file_url;
    }
    else if(details.infohash) {
        params['infohash'] = details.infohash;
    }
    else {
        callback.call(null);
    }

    sendRequest({
        method: "get_available_players",
        params: params,
        onsuccess: function(data) {
            callback.call(null, data);
        },
        onerror: function(errmsg) {
            callback.call(null);
        }
    });
}

export function openInPlayer(details, playerId, callback) {
    var params = {};
    if(gInitiatorId) {
        params['a'] = gInitiatorId;
    }
    if(details.content_id) {
        params['content_id'] = details.content_id;
    }
    else if(details.transport_file_url) {
        params['url'] = details.transport_file_url;
    }
    else if(details.infohash) {
        params['infohash'] = details.infohash;
    }
    else {
        callback.call(null);
    }
    if(playerId) {
        params['player_id'] = playerId;
    }

    sendRequest({
        method: "open_in_player",
        params: params,
        onsuccess: function(data) {
            if(typeof callback === "function") {
                callback.call(null, data);
            }
        },
        onerror: function(errmsg) {
            if(typeof callback === "function") {
                callback.call(null);
            }
        }
    });
}

export function getDeviceId(sandbox, callback) {
    sendRequest({
        api: "service",
        method: "get_public_user_key",
        onsuccess: function(data) {
            if(typeof callback === "function") {
                callback.call(null, data);
            }
        },
        onerror: function(errmsg) {
            if(typeof callback === "function") {
                callback.call(null);
            }
        }
    });
}

// get_initiator_id
export function a() {
    return gInitiatorId;
}
