import { isFirefox } from 'src/common/ua';
import { bindEvents, sendMessage, inject, attachFunction } from '../utils';
import bridge from './bridge';
import { tabOpen, tabClose, tabClosed } from './tabs';
import { onNotificationCreate, onNotificationClick, onNotificationClose } from './notifications';
import { getRequestId, httpRequest, abortRequest, httpRequested } from './requests';
import dirtySetClipboard from './clipboard';

const IS_TOP = window.top === window;

const ids = [];
const menus = [];

const badge = {
  number: 0,
  ready: false,
  willSet: false,
};

function getBadge() {
  badge.willSet = true;
  setBadge();
}

function setBadge() {
  if (badge.ready && badge.willSet) {
    sendMessage({ cmd: 'SetBadge', data: badge.number });
  }
}

const bgHandlers = {
  Command(data) {
    bridge.post({ cmd: 'Command', data });
  },
  GetPopup: getPopup,
  GetBadge: getBadge,
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

  sendMessage({ cmd: 'GetInjected', data: window.location.href })
  .then(data => {
    if (data.scripts) {
      data.scripts.forEach(script => {
        ids.push(script.props.id);
        if (script.config.enabled) badge.number += 1;
      });
    }
    bridge.post({ cmd: 'LoadScripts', data });
    badge.ready = true;
    getPopup();
    setBadge();
  });
}

const handlers = {
  GetRequestId: getRequestId,
  HttpRequest: httpRequest,
  AbortRequest: abortRequest,
  Inject: injectScript,
  TabOpen: tabOpen,
  TabClose: tabClose,
  UpdateValue(data) {
    sendMessage({ cmd: 'UpdateValue', data });
  },
  RegisterMenu(data) {
    if (IS_TOP) menus.push(data);
    getPopup();
  },
  AddStyle(css) {
    if (document.head) {
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    }
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

function onHandle(req) {
  const handle = handlers[req.cmd];
  if (handle) handle(req.data);
}

function getPopup() {
  // XXX: only scripts run in top level window are counted
  if (IS_TOP) {
    sendMessage({
      cmd: 'SetPopup',
      data: { ids, menus },
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
  inject(`!${func.toString()}(${args.join(',')})`);
}

function onDOMContentLoaded() {
  if (IS_TOP) {
    // check news for this site
    sendMessage({ cmd: 'CheckNews', data: { url: window.location.href } });
  }
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
