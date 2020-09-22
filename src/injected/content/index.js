import {
  getUniqId, verbose, isDomainAllowed, noop,
} from '#/common';
import { isFirefox, getVendor } from '#/common/ua';
import {
  bindEvents, sendMessage, inject, attachFunction,
} from '../utils';
import bridge from './bridge';
import { tabOpen, tabClose, tabClosed } from './tabs';
import { onNotificationCreate, onNotificationClick, onNotificationClose } from './notifications';
import {
  getRequestId, httpRequest, abortRequest, httpRequested,
} from './requests';
import dirtySetClipboard from './clipboard';

const IS_TOP = window.top === window;

const ids = [];
const enabledIds = [];
const menus = {};

function setBadge() {
  // delay setBadge in frames so that they can be added to the initial count
  new Promise(resolve => setTimeout(resolve, IS_TOP ? 0 : 300))
  .then(() => sendMessage({
    cmd: 'SetBadge',
    data: {
      ids: enabledIds,
      reset: IS_TOP,
    },
  }));
}

const bgHandlers = {
  Command(data) {
    bridge.post({ cmd: 'Command', data });
  },
  GetPopup: getPopup,
  HttpRequested: httpRequested,
  TabClosed: tabClosed,
  UpdatedValues(data) {
    bridge.post({ cmd: 'UpdatedValues', data });
  },
  NotificationClick: onNotificationClick,
  NotificationClose: onNotificationClose,
  WatchOnlineMenuClicked(data) {
    bridge.post({ cmd: 'WatchOnlineMenuClicked', data });
  },
};

export default function initialize(contentId, webId) {
  bridge.post = bindEvents(contentId, webId, onHandle);
  bridge.destId = webId;

  browser.runtime.onMessage.addListener((req, src) => {
    const handle = bgHandlers[req.cmd];
    if (handle) handle(req.data, src);
  });

  return sendMessage({
    cmd: 'GetInjected',
    data: {
      url: window.location.href,
      reset: IS_TOP,
      isTop: IS_TOP,
    },
  })
  .then(data => {
    if (data.scripts) {
      data.scripts = data.scripts.filter(script => {
        ids.push(script.props.id);
        if ((IS_TOP || !script.meta.noframes) && script.config.enabled) {
          enabledIds.push(script.props.id);
          return true;
        }
        return false;
      });
    }
    getPopup();
    setBadge();
    const needInject = data.scripts && data.scripts.length;
    if (needInject) {
      bridge.ready.then(() => {
        bridge.post({ cmd: 'LoadScripts', data });
      });
    }
    return needInject;
  });
}

const handlers = {
  GetRequestId: getRequestId,
  HttpRequest: httpRequest,
  AbortRequest: abortRequest,
  Inject: injectScript,
  TabOpen: tabOpen,
  TabClose: tabClose,
  Ready() {
    bridge.ready = Promise.resolve();
  },
  UpdateValue(data) {
    sendMessage({ cmd: 'UpdateValue', data });
  },
  RegisterMenu(data) {
    if (IS_TOP) {
      const [key] = data;
      menus[key] = data;
    }
    getPopup();
  },
  UnregisterMenu(data) {
    if (IS_TOP) {
      const [key] = data;
      delete menus[key];
    }
    getPopup();
  },
  AddStyle({ css, callbackId }) {
    let styleId = null;
    if (document.head) {
      styleId = getUniqId('VMst');
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = css;
      document.head.appendChild(style);
    }
    bridge.post({ cmd: 'Callback', data: { callbackId, payload: styleId } });
  },
  Notification: onNotificationCreate,
  SetClipboard(data) {
    if (isFirefox) {
      // Firefox does not support copy from background page.
      // ref: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Interact_with_the_clipboard
      // The dirty way will create a <textarea> element in web page and change the selection.
      dirtySetClipboard(data);
    } else {
      sendMessage({ cmd: 'SetClipboard', data });
    }
  },
  PostCommand({ cmd, requestId, data }) {
    sendMessage({ cmd, data })
    .then(result => {
      bridge.post({
        cmd: 'CommandResponse',
        data: { result, requestId },
      });
    });
  },
};

bridge.ready = new Promise(resolve => {
  handlers.Ready = resolve;
});

function onHandle(req) {
  const handle = handlers[req.cmd];
  if (handle) handle(req.data);
}

function getPopup() {
  // XXX: only scripts run in top level window are counted
  if (IS_TOP) {
    sendMessage({
      cmd: 'SetPopup',
      data: { ids, menus: Object.values(menus) },
    });
  }
}

function injectScript(data) {
  const [vId, wrapperKeys, code, vCallbackId] = data;
  const func = (attach, id, cb, callbackId) => {
    attach(id, cb);
    const callback = window[callbackId];
    if (callback) callback();
  };
  const args = [
    attachFunction.toString(),
    JSON.stringify(vId),
    `function(${wrapperKeys.join(',')}){${code}}`,
    JSON.stringify(vCallbackId),
  ];
  const injectedCode = `!${func.toString()}(${args.join(',')})`;
  inject(injectedCode);
}

function watchDOM(func) {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      [].forEach.call(mutation.addedNodes, node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          func(node);
        }
        [].forEach.call(node.childNodes, child => {
          if (child.nodeType === Node.ELEMENT_NODE) {
            func(child);
          }
        });
      });
    });
  });

  func();
  observer.observe(document.body, { childList: true, subtree: true });
}

function checkStartEngineMarker() {
  // start engine if requested by this page
  const el = document.getElementById('x-acestream-awe-start-engine');
  if (!el) {
    return false;
  }

  // notify the marker owner that we have catched it
  sendMessage({ cmd: 'StartEngine' })
  .then(response => {
    verbose('Ace Script: start engine: response', response);
    if (response) {
      el.setAttribute('data-status', 'started');
    } else {
      el.setAttribute('data-status', 'failed');
    }
  });

  return true;
}

function exposeVersion(node) {
  const BRIDGE_ID = 'x-acestream-awe-version';
  let el = node;
  if (!el) {
    el = document.getElementById(BRIDGE_ID);
    if (!el) {
      return false;
    }
  } else if (el.id !== BRIDGE_ID) {
    return false;
  }

  function sendResponse(target, requestId) {
    try {
      const vendor = getVendor();
      const version = browser.runtime.getManifest().version;
      target.setAttribute('data-vendor', vendor);
      target.setAttribute('data-version', version);

      const payload = { response: { vendor, version } };
      if (requestId) {
        payload.requestId = requestId;
      }
      const event = new CustomEvent('response', { detail: payload });
      target.dispatchEvent(event);
    } catch (e) {
      if (process.env.DEBUG) console.error(e);
    }
  }

  if (isDomainAllowed(window.location.hostname)) {
    sendResponse(el);
    el.addEventListener('request', e => {
      sendResponse(el, e.detail.requestId);
    }, false);
  }

  return true;
}

function exposeInstalledScripts(node) {
  const BRIDGE_ID = 'x-acestream-awe-installed-scripts';
  let el = node;
  if (!el) {
    el = document.getElementById(BRIDGE_ID);
    if (!el) {
      return false;
    }
  } else if (el.id !== BRIDGE_ID) {
    return false;
  }

  function sendResponse(target, requestId) {
    sendMessage({ cmd: 'GetInstalledScripts' })
    .then(response => {
      if (response) {
        target.setAttribute('data-scripts', JSON.stringify(response));

        const payload = { response };
        if (requestId) {
          payload.requestId = requestId;
        }
        const event = new CustomEvent('response', { detail: payload });
        target.dispatchEvent(event);
      }
    })
    .catch(noop);
  }

  if (isDomainAllowed(window.location.hostname)) {
    sendResponse(el);
    el.addEventListener('request', e => {
      sendResponse(el, e.detail.requestId);
    }, false);
  }

  return true;
}

function onDomReady(callback) {
  if (document.readyState === 'complete'
    || document.readyState === 'loaded'
    || document.readyState === 'interactive') {
    setTimeout(callback, 0);
  } else {
    document.addEventListener('DOMContentLoaded', callback, false);
  }
}

onDomReady(() => {
  watchDOM(checkStartEngineMarker);

  if (isDomainAllowed(window.location.hostname)) {
    watchDOM(exposeVersion);
    watchDOM(exposeInstalledScripts);
  }

  if (IS_TOP) {
    // check news for this site
    sendMessage({ cmd: 'CheckNews', data: { url: window.location.href } });
  }
});
