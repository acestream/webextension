import { isFirefox, getVendor } from '#/common/ua';
import { verbose, isDomainAllowed } from '#/common';
import bridge, { addBackgroundHandlers, addHandlers, onScripts } from './bridge';
import { onClipboardCopy } from './clipboard';
import { sendSetPopup } from './gm-api-content';
import { injectPageSandbox, injectScripts } from './inject';
import './notifications';
import './requests';
import './tabs';
import { sendCmd } from './util';
import { isEmpty } from '../util';
import { Run } from './cmd-run';

const { [IDS]: ids } = bridge;

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

function watchDOM(func, retryCount, retryInterval) {
  if (!func()) {
    if (retryCount && retryCount > 0) {
      setTimeout(() => {
        watchDOM(func, retryCount - 1, retryInterval);
      }, retryInterval);
    }
  }
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

function exposeVersion() {
  // set version in special container
  const el = document.getElementById('x-acestream-awe-version');
  if (!el) {
    return false;
  }

  if (isDomainAllowed(window.location.host)) {
    el.setAttribute('data-vendor', getVendor());
    el.setAttribute('data-version', browser.runtime.getManifest().version);
  }

  return true;
}

function exposeInstalledScripts() {
  // expose installed scripts to a limited set of domains
  const el = document.getElementById('x-acestream-awe-installed-scripts');
  if (!el) {
    return false;
  }

  if (isDomainAllowed(window.location.host)) {
    sendMessage({ cmd: 'GetInstalledScripts' })
    .then(response => {
      if (response) {
        el.setAttribute('data-scripts', JSON.stringify(response));
      }
    });
  }

  return true;
}

function onDOMContentLoaded() {
  watchDOM(checkStartEngineMarker, 60, 500);

  if (isDomainAllowed(window.location.host)) {
    watchDOM(exposeVersion, 240, 500);
    watchDOM(exposeInstalledScripts, 60, 500);
  }

  if (IS_TOP) {
    // check news for this site
    sendMessage({ cmd: 'CheckNews', data: { url: window.location.href } });
  }
}

document.addEventListener('DOMContentLoaded', onDOMContentLoaded, false);
