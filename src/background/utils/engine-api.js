import { verbose, delay, request } from '@/common';
import { addPublicCommands } from './message';

// TODO: register initiator before each play (engine can restart)
let gDeviceId = null;
const gInitiatorId = null;

addPublicCommands({
  GetEngineStatus() {
    return getEngineStatus();
  },
  GetAvailablePlayers(params) {
    return new Promise(resolve => {
      getAvailablePlayers(params, response => resolve(response));
    });
  },
  OpenInPlayer({ params, playerId }) {
    return new Promise(resolve => {
      openInPlayer(params, playerId, response => resolve(response));
    });
  },
  GetDeviceId() {
    return new Promise(resolve => {
      getDeviceId(response => resolve(response));
    });
  },
  GetLocale() {
    return Promise.resolve(browser.i18n.getUILanguage());
  },
  GetConfig(name) {
    const values = {
      'remote-control-url': 'http://127.0.0.1:6878/remote-control',
      _a: null,
      mode: 0,
    };

    return Promise.resolve(values[name]);
  },
  StartEngine() {
    verbose('bg: start engine');
    return new Promise(resolve => {
      try {
        browser.runtime.sendNativeMessage(
          'org.acestream.engine',
          { method: 'start_engine' },
          response => {
            const err = browser.runtime.lastError;
            if (err) {
              verbose(`bg: start engine failed: err=${err}`);
              resolve(null);
            } else {
              verbose('bg: start engine response', response);
              resolve(response);
            }
          },
        );
      } catch(error) {
        console.error(`Failed to started engine: ${error}`);
        resolve(null);
      }
    });
  },
});

function checkEngine(retryCount, retryInterval) {
  let url = 'http://127.0.0.1:6878/webui/api/service?method=get_version';
  if (gDeviceId === null) {
    url += '&params=device-id';
  }

  function makeResponse(requestResponse) {
    let errmsg = '';
    let engineRunning = false;
    let engineVersionString = null;
    let engineVersionCode = 0;

    if (requestResponse.status !== 200) {
      errmsg = `engine returned error: ${requestResponse.status}`;
    } else {
      const response = requestResponse.data;
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
        if (isNaN(engineVersionCode)) { // eslint-disable-line no-restricted-globals
          engineVersionCode = 0;
        }
        engineVersionString = response.result.version;
        if (response.result.device_id) {
          if (gDeviceId !== response.result.device_id) {
            gDeviceId = response.result.device_id;
          }
        }
      }
    }

    if (errmsg) {
      verbose(`checkEngine: error: ${errmsg}`);
    }
    engineRunning = !!engineVersionCode;

    if (!engineRunning && retryCount !== undefined && retryCount > 0) {
      verbose(`Ace Script: check engine failed (${retryCount}), next try in ${retryInterval}`);
      return delay(retryInterval).then(() => checkEngine(retryCount - 1, retryInterval));
    }

    return {
      running: !!engineVersionCode,
      versionCode: engineVersionCode,
      versionString: engineVersionString,
    };
  }

  return request(url, { responseType: 'json' })
  .then(response => makeResponse(response))
  .catch(response => makeResponse(response));
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
  return request(url, { responseType: 'json', timeout: 10000 }).then(response => {
    let err;
    if (response.status !== 200) {
      err = `Bad status code: ${response.status}`;
      throw err;
    }

    const data = response.data;
    if (data.error) {
      throw data.error;
    } else if (!data.result) {
      err = 'malformed response from engine';
      throw err;
    } else {
      return data.result;
    }
  });
}

export function getEngineStatus(callback) {
  if (typeof callback !== 'undefined') {
    throw new Error('deprecated callback in getEngineStatus()');
  }
  return new Promise(resolve => {
    checkEngine().then(checkEngineResponse => {
      function _sendResponse(running, versionCode) {
        resolve({
          running,
          version: versionCode,
        });
      }

      if (checkEngineResponse.running) {
        _sendResponse(checkEngineResponse.running, checkEngineResponse.versionCode);
      } else {
        // engine is not running, check it's version by native messaging
        try {
          browser.runtime.sendNativeMessage(
            'org.acestream.engine',
            { method: 'get_version' },
            nativeResponse => {
              // check lastError to suppress errors on console
              browser.runtime.lastError; // eslint-disable-line no-unused-expressions
              if (typeof nativeResponse === 'undefined') {
                verbose(`Ace Script: engine messaging host failed: ${browser.runtime.lastError}`);
                _sendResponse(false, 0);
              } else {
                verbose(`Ace Script: got response from engine messaging host: ${JSON.stringify(nativeResponse)}`);

                // start engine
                nativeStartEngine()
                  .then((running, version) => _sendResponse(running, version));
              }
            },
          );
        } catch (error) {
          verbose(`Ace Script: failed to get engine version: ${error}`);
          _sendResponse(false, 0);
        }
      }
    });
  });
}

async function nativeStartEngine() {
  return new Promise(resolve => {
    try {
      browser.runtime.sendNativeMessage(
        'org.acestream.engine',
        { method: 'start_engine' },
        response => {
          if (typeof response === 'undefined') {
            verbose('Ace Script: failed to start engine');
            resolve(false, 0);
          } else {
            // wait until engine is started
            const retryCount = 20;
            const retryInterval = 1000;
            checkEngine(retryCount, retryInterval).then(status => {
              verbose(`Ace Script: engine status after starting: ${JSON.stringify(status)}`);
              resolve(status.running, status.versionCode);
            });
          }
        });
    } catch (error) {
      verbose(`Ace Script: failed to start engine: ${error}`);
      resolve(false, 0);
    }
  });
}

export function startJsPlayer(callback) {
  try {
    browser.runtime.sendNativeMessage(
      'org.acestream.engine',
      { method: 'get_version' },
      response1 => {
        if (typeof response1 === 'undefined') {
          verbose('Ace Script:startJsPlayer: engine messaging host failed');
          callback(false);
        } else {
          verbose(`Ace Script:startJsPlayer: got response from engine messaging host: ${JSON.stringify(response1)}`);
          // start js player
          browser.runtime.sendNativeMessage('org.acestream.engine', { method: 'start_js_player' }, response2 => {
            if (typeof response2 === 'undefined') {
              verbose('Ace Script:startJsPlayer: failed to start js player');
              callback(false);
            } else {
              callback(response2);
            }
          });
        }
      },
    );
  } catch (error) {
    verbose(`Ace Script:startJsPlayer: failed to start js player: ${error}`);
    callback(false);
  }
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
    callback();
    return;
  }

  sendRequest({
    method: 'get_available_players',
    params,
  })
  .then(data => {
    callback(data);
  })
  .catch(() => {
    callback();
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
    callback();
  }
  if (playerId) {
    params.player_id = playerId;
  }

  sendRequest({
    method: 'open_in_player',
    params,
  })
  .then(data => {
    if (typeof callback === 'function') {
      callback(data);
    }
  })
  .catch(() => {
    if (typeof callback === 'function') {
      callback();
    }
  });
}

export function getDeviceId(callback) {
  sendRequest({
    api: 'service',
    method: 'get_public_user_key',
  })
  .then(data => {
    if (typeof callback === 'function') {
      callback(data);
    }
  })
  .catch(() => {
    if (typeof callback === 'function') {
      callback();
    }
  });
}
