// https://awe-static.acestream.me/utils/ace-script-utils.js
(function() {
    const BRIDGE_ID_VERSION = 'x-acestream-awe-version';
    const BRIDGE_ID_INSTALLED_SCRIPTS = 'x-acestream-awe-installed-scripts';

    const storage = {
        version: null,
        installedScripts: [],
    };

    const versionCallbacks = [];
    const installedScriptsCallbacks = [];
    const responseCallbacks = {};

    function makeRequestId(tag) {
        if(!tag) {
            tag = 'default';
        }
        return tag + '-' + Math.random();
    }

    function onVersion(payload) {
        storage.version = payload.response;

        if (payload.requestId) {
            handleResponseCallback(payload);
        } else {
            for(var i = 0; i < versionCallbacks.length; i += 1) {
                versionCallbacks[i](payload.response);
            }
        }
    }

    function onInstalledScripts(payload) {
        storage.installedScripts = payload.response;

        if (payload.requestId) {
            handleResponseCallback(payload);
        } else {
            for(var i = 0; i < installedScriptsCallbacks.length; i += 1) {
                installedScriptsCallbacks[i](payload.response);
            }
        }
    }

    function handleResponseCallback(payload) {
        if (responseCallbacks[payload.requestId]) {
            responseCallbacks[payload.requestId](payload.response);
            delete responseCallbacks[payload.requestId];
        }
    }

    function installBridge(id, callback) {
        var bridge = document.getElementById(id);
        if(!bridge) {
            bridge = document.createElement('div');
            bridge.id = id;
            bridge.addEventListener('response', function (e) {
                callback(e.detail);
            }, false);
            document.body.appendChild(bridge);
        }
    }

    function init() {
        installBridge(BRIDGE_ID_VERSION, onVersion);
        installBridge(BRIDGE_ID_INSTALLED_SCRIPTS, onInstalledScripts);
    }

    function getVersion(callback) {
        if (typeof callback === 'function') {
            var requestId = makeRequestId();
            responseCallbacks[requestId] = callback;
            requestVersion(requestId);
        } else if (storage.version) {
            return storage.version;
        } else {
            var bridge = document.getElementById(BRIDGE_ID_VERSION);
            var version = bridge.getAttribute('data-version');
            if (!version) {
                return null;
            }
            var data = {
                version: version,
                vendor: bridge.getAttribute('data-vendor')
            };
            storage.version = data;
            return storage.version;
        }
    }

    function getInstalledScripts(callback, options) {
        if (typeof callback === 'function') {
            var requestId = makeRequestId();
            responseCallbacks[requestId] = callback;
            requestInstalledScripts(requestId, options);
        } else if (storage.installedScripts && storage.installedScripts.length) {
            return storage.installedScripts;
        } else {
            var bridge = document.getElementById(BRIDGE_ID_INSTALLED_SCRIPTS);
            var payload = bridge.getAttribute('data-scripts');
            if (!payload) {
                return [];
            }
            storage.installedScripts = JSON.parse(payload);
            return storage.installedScripts;
        }
    }

    function requestVersion(requestId) {
        var bridge = document.getElementById(BRIDGE_ID_VERSION);
        if(bridge) {
            dispatchRequest(bridge, requestId);
        }
    }

    function requestInstalledScripts(requestId, options) {
        var bridge = document.getElementById(BRIDGE_ID_INSTALLED_SCRIPTS);
        if(bridge) {
            dispatchRequest(bridge, requestId, options);
        }
    }

    function dispatchRequest(bridge, requestId, options) {
        bridge.dispatchEvent(
                new CustomEvent('request', { detail: { requestId: requestId, options: options } }));
    }

    function addVersionCallback(callback) {
        versionCallbacks.push(callback);
    }

    function addInstalledScriptsCallback(callback) {
        installedScriptsCallbacks.push(callback);
    }

    window.AceScriptUtils = {
        init: init,
        getVersion: getVersion,
        getInstalledScripts: getInstalledScripts,
        addVersionCallback: addVersionCallback,
        addInstalledScriptsCallback: addInstalledScriptsCallback,
    };

})();