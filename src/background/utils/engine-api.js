import { verbose } from 'src/common';

// TODO: register initiator before each play (engine can restart)
let gDeviceId = null;
const gInitiatorId = null;

function checkEngine(callback, retryCount, retryInterval) {
  try {
    const xhr = new XMLHttpRequest();
    let url = 'http://127.0.0.1:6878/webui/api/service?method=get_version';
    if (gDeviceId === null) {
      url += '&params=device-id';
    }
    xhr.open('GET', url, true);
    xhr.timeout = 10000;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        let errmsg = '';
        let engineRunning = false;
        let engineVersionString = null;
        let engineVersionCode = 0;

        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          if (response.error) {
            engineVersionCode = 0;
            engineVersionString = null;
            errmsg = response.error;
          } else if (!response.result) {
            engineVersionCode = 0;
            engineVersionString = null;
            errmsg = 'malformed response from engine';
          } else {
            engineVersionCode = parseInt(response.result.code, 10);
            if (isNaN(engineVersionCode)) {
              engineVersionCode = 0;
            }
            engineVersionString = response.result.version;
            if (response.result.device_id) {
              if (gDeviceId !== response.result.device_id) {
                gDeviceId = response.result.device_id;
              }
            }
          }
        } else {
          engineVersionCode = 0;
          engineVersionString = null;
          errmsg = `engine returned error: ${xhr.status}`;
        }
        if (errmsg) {
          console.log(`checkEngine: error: ${errmsg}`);
        }
        engineRunning = !!engineVersionCode;

        if (typeof callback === 'function') {
          if (!engineRunning && retryCount !== undefined && retryCount > 0) {
            console.log(`Ace Script: check engine failed (${retryCount}), next try in ${retryInterval}`);
            window.setTimeout(() => {
              checkEngine(callback, retryCount - 1, retryInterval);
            }, retryInterval);
          } else {
            callback.call(null, {
              running: !!engineVersionCode,
              versionCode: engineVersionCode,
              versionString: engineVersionString,
            });
          }
        }
      }
    };
    xhr.send();
  } catch (e) {
    console.log(`checkEngine: error: ${e}`);
  }
}

function makeParams(params) {
  let value;
  const result = [];

  Object.keys(params).forEach(name => {
    value = params[name];
    result.push(`${name}=${encodeURIComponent(value)}`);
  });

  return result.join('&');
}

function sendRequest(details) {
  function _success(data) {
    if (typeof details.onsuccess === 'function') {
      details.onsuccess.call(null, data);
    }
  }

  function _failed(errmsg) {
    console.log(`engineapi:request failed: ${errmsg}`);
    if (typeof details.onerror === 'function') {
      details.onerror.call(null, errmsg);
    }
  }

  try {
    if (!details.method) {
      throw new Error('missing method');
    }
    if (!details.params) {
      details.params = {};
    }
    if (!details.api) {
      details.api = 'server';
    }
    details.params.method = details.method;

    let baseUrl;
    if (details.api === 'server') {
      baseUrl = 'http://127.0.0.1:6878/server/api';
    } else if (details.api === 'service') {
      baseUrl = 'http://127.0.0.1:6878/webui/api/service';
    } else {
      throw new Error(`unknown api: ${details.api}`);
    }

    const url = `${baseUrl}?${makeParams(details.params)}`;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 10000;

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.error) {
              _failed(data.error);
            } else if (!data.result) {
              _failed('malformed response from engine');
            } else {
              _success(data.result);
            }
          } catch (e) {
            _failed(e);
          }
        } else {
          _failed(`engine returned error: ${xhr.status}`);
        }
      }
    };
    xhr.send();
  } catch (e) {
    console.error(e);
  }
}

export function getEngineStatus(callback) {
  if (typeof callback !== 'function') {
    throw new Error('missing callback in getEngineStatus()');
  }
  checkEngine(response => {
    function _sendResponse(running, versionCode) {
      callback.call(null, {
        running,
        version: versionCode,
      });
    }

    if (response.running) {
      _sendResponse(response.running, response.versionCode);
    } else {
      // engine is not running, check it's version by native messaging
      browser.runtime.sendNativeMessage(
        'org.acestream.engine',
        { method: 'get_version' },
        response => {
          if (typeof response === 'undefined') {
            verbose(`Ace Script: engine messaging host failed: ${browser.runtime.lastError}`);
            _sendResponse(false, 0);
          } else {
            console.log(`Ace Script: got response from engine messaging host: ${JSON.stringify(response)}`);

            // start engine
            browser.runtime.sendNativeMessage('org.acestream.engine', { method: 'start_engine' }, response => {
              if (typeof response === 'undefined') {
                console.log('Ace Script: failed to start engine');
                _sendResponse(false, 0);
              } else {
                // wait until engine is started
                const retryCount = 20;
                const retryInterval = 1000;
                checkEngine(response => {
                  console.log(`Ace Script: engine status after starting: ${JSON.stringify(response)}`);
                  _sendResponse(response.running, response.versionCode);
                }, retryCount, retryInterval);
              }
            });
          }
        },
      );
    }
  });
}

export function startJsPlayer(callback) {
  chrome.runtime.sendNativeMessage(
    'org.acestream.engine',
    { method: 'get_version' },
    response => {
      if (typeof response === 'undefined') {
        console.log('Ace Script:startJsPlayer: engine messaging host failed');
        callback.call(null, false);
      } else {
        console.log(`Ace Script:startJsPlayer: got response from engine messaging host: ${JSON.stringify(response)}`);
        // start js player
        chrome.runtime.sendNativeMessage('org.acestream.engine', { method: 'start_js_player' }, response => {
          if (typeof response === 'undefined') {
            console.log('Ace Script:startJsPlayer: failed to start js player');
            callback.call(null, false);
          } else {
            callback.call(null, response);
          }
        });
      }
    },
  );
}

export function getAvailablePlayers(details, callback) {
  if (typeof callback !== 'function') {
    return;
  }

  const params = {};
  if (details.content_id) {
    params.content_id = details.content_id;
  } else if (details.transport_file_url) {
    params.url = details.transport_file_url;
  } else if (details.infohash) {
    params.infohash = details.infohash;
  } else {
    callback.call(null);
  }

  sendRequest({
    method: 'get_available_players',
    params,
    onsuccess: data => {
      callback.call(null, data);
    },
    onerror: errmsg => {
      callback.call(null);
    },
  });
}

export function openInPlayer(details, playerId, callback) {
  const params = {};
  if (gInitiatorId) {
    params.a = gInitiatorId;
  }
  if (details.content_id) {
    params.content_id = details.content_id;
  } else if (details.transport_file_url) {
    params.url = details.transport_file_url;
  } else if (details.infohash) {
    params.infohash = details.infohash;
  } else {
    callback.call(null);
  }
  if (playerId) {
    params.player_id = playerId;
  }

  sendRequest({
    method: 'open_in_player',
    params,
    onsuccess: data => {
      if (typeof callback === 'function') {
        callback.call(null, data);
      }
    },
    onerror: errmsg => {
      if (typeof callback === 'function') {
        callback.call(null);
      }
    },
  });
}

export function getDeviceId(callback) {
  sendRequest({
    api: 'service',
    method: 'get_public_user_key',
    onsuccess: data => {
      if (typeof callback === 'function') {
        callback.call(null, data);
      }
    },
    onerror: errmsg => {
      if (typeof callback === 'function') {
        callback.call(null);
      }
    },
  });
}
