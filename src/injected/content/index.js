import { getVendor } from '@/common/vendor'; // eslint-disable-line no-restricted-imports
import { verbose, isDomainAllowed } from '@/common'; // eslint-disable-line no-restricted-imports
import bridge, { addBackgroundHandlers, addHandlers, onScripts } from './bridge';
import { onClipboardCopy } from './clipboard';
import { sendSetPopup } from './gm-api-content';
import { injectPageSandbox, injectScripts } from './inject';
import './notifications';
import './requests';
import './tabs';
import './acestream';
import { sendCmd } from './util';
import { isEmpty } from '../util';
import { Run } from './cmd-run';

const { [IDS]: ids } = bridge;

const IS_TOP = window.top === window;

// Make sure to call obj::method() in code that may run after CONTENT userscripts
async function init() {
  const isXml = document instanceof XMLDocument;
  const xhrData = getXhrInjection();
  const dataPromise = sendCmd('GetInjected', {
    /* In FF93 sender.url is wrong: https://bugzil.la/1734984,
     * in Chrome sender.url is ok, but location.href is wrong for text selection URLs #:~:text= */
    url: IS_FIREFOX && location.href,
    // XML document's appearance breaks when script elements are added
    [FORCE_CONTENT]: isXml,
    done: !!(xhrData || global.vmData),
  }, {
    retry: true,
  });
  // detecting if browser.contentScripts is usable, it was added in FF59 as well as composedPath
  /** @type {VMInjection} */
  const data = xhrData || (
    IS_FIREFOX && Event[PROTO].composedPath
      ? await getDataFF(dataPromise)
      : await dataPromise
  );
  assign(ids, data[IDS]);
  bridge[INJECT_INTO] = data[INJECT_INTO];
  if (data[EXPOSE] && !isXml && injectPageSandbox(data)) {
    addHandlers({ GetScriptVer: true });
    bridge.post('Expose');
  }
  if (IS_FIREFOX && !data.clipFF) {
    off('copy', onClipboardCopy, true);
  }
  if (data[SCRIPTS]) {
    onScripts.forEach(fn => fn(data));
    await injectScripts(data, isXml);
  }
  onScripts.length = 0;
  sendSetPopup();
}

addBackgroundHandlers({
  Command: data => bridge.post('Command', data, ids[data.id]),
  Run: id => Run(id, CONTENT),
  UpdatedValues(data) {
    const dataPage = createNullObj();
    const dataContent = createNullObj();
    objectKeys(data)::forEach((id) => {
      (ids[id] === CONTENT ? dataContent : dataPage)[id] = data[id];
    });
    if (!isEmpty(dataPage)) bridge.post('UpdatedValues', dataPage);
    if (!isEmpty(dataContent)) bridge.post('UpdatedValues', dataContent, CONTENT);
  },
});

addHandlers({
  TabFocus: true,
  UpdateValue: true,
});

init().catch(IS_FIREFOX && logging.error); // Firefox can't show exceptions in content scripts

async function getDataFF(viaMessaging) {
  // global !== window in FF content scripts
  const data = global.vmData || await SafePromise.race([
    new SafePromise(resolve => { global.vmResolve = resolve; }),
    viaMessaging,
  ]);
  delete global.vmResolve;
  delete global.vmData;
  return data;
}

function getXhrInjection() {
  try {
    const quotedKey = `"${INIT_FUNC_NAME}"`;
    // Accessing document.cookie may throw due to CSP sandbox
    const cookieValue = document.cookie.split(`${quotedKey}=`)[1];
    const blobId = cookieValue && cookieValue.split(';', 1)[0];
    if (blobId) {
      document.cookie = `${quotedKey}=0; max-age=0; SameSite=Lax`; // this removes our cookie
      const xhr = new XMLHttpRequest();
      const url = `blob:${VM_UUID}${blobId}`;
      xhr.open('get', url, false); // `false` = synchronous
      xhr.send();
      URL.revokeObjectURL(url);
      return JSON.parse(xhr[kResponse]);
    }
  } catch { /* NOP */ }
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

async function checkStartEngineMarker() {
  // start engine if requested by this page
  const el = document.getElementById('x-acestream-awe-start-engine');
  if (!el) {
    return false;
  }

  // notify the marker owner that we have catched it
  const response = await sendCmd('StartEngine');
  verbose('Ace Script: start engine: response', response);
  if (response) {
    el.setAttribute('data-status', 'started');
  } else {
    el.setAttribute('data-status', 'failed');
  }

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
      const version = process.env.VM_VER;
      target.setAttribute('data-vendor', vendor);
      target.setAttribute('data-version', version);

      const payload = { response: { vendor, version } };
      if (requestId) {
        payload.requestId = requestId;
      }

      let payloadToSend;
      if(IS_FIREFOX) {
        // In FF we cannot pass objects directly from content script to page script. Such objects
        // must be expicitly cloned with special "cloneInto" function.
        payloadToSend = cloneInto(payload, window);
      } else {
        payloadToSend = payload;
      }

      const event = new CustomEvent('response', { detail: payloadToSend });
      target.dispatchEvent(event);
    } catch (e) {
      if (process.env.DEV) console.error(e);
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

async function exposeInstalledScripts(node) {
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

  async function sendResponse(target, requestId) {
    const response = await sendCmd('GetInstalledScripts');
    if (response) {
      target.setAttribute('data-scripts', JSON.stringify(response));

      const payload = { response };
      if (requestId) {
        payload.requestId = requestId;
      }

      let payloadToSend;
      if(IS_FIREFOX) {
        // In FF we cannot pass objects directly from content script to page script. Such objects
        // must be expicitly cloned with special "cloneInto" function.
        payloadToSend = cloneInto(payload, window);
      } else {
        payloadToSend = payload;
      }

      const event = new CustomEvent('response', { detail: payloadToSend });
      target.dispatchEvent(event);
    };
  }

  if (isDomainAllowed(window.location.hostname)) {
    await sendResponse(el);
    el.addEventListener('request', async (e) => {
      await sendResponse(el, e.detail.requestId);
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
    sendCmd('CheckNews', { url: window.location.href });
  }
});
