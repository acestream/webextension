import {
  noop, verbose, getUniqId, i18n,
} from '#/common';
import { objectGet } from '#/common/object';
import { isChrome } from '#/common/ua';
import { getPrivacyOptions } from '#/common/privacy';
import * as sync from './sync';
import * as news from './utils/news';
import * as tmWrapper from './utils/tampermonkey';
import * as statistics from './utils/statistics';
import {
  cache,
  getRequestId, httpRequest, abortRequest, confirmInstall,
  newScript, parseMeta,
  setClipboard, checkUpdate,
  getOption, getDefaultOption, setOption, hookOptions, getAllOptions,
  initialize, sendMessageOrIgnore, broadcast,
} from './utils';
import { tabOpen, tabClose } from './utils/tabs';
import createNotification from './utils/notifications';
import {
  getScripts, removeScript, getData, checkRemove, getScriptsByURL,
  updateScriptInfo, getExportData, getScriptCode,
  getScriptByIds, moveScript, vacuum, parseScript, getScript,
  getInstalledScripts,
  sortScripts, getValueStoresByIds,
} from './utils/db';
import { resetBlacklist } from './utils/tester';
import {
  setValueStore, updateValueStore, resetValueOpener, addValueOpener,
} from './utils/values';

import {
  getEngineStatus,
  getAvailablePlayers,
  openInPlayer,
  getDeviceId,
} from './utils/engine-api';

const VM_VER = browser.runtime.getManifest().version;
const NOTIFICATIONS_BUTTONS_SUPPORTED = isChrome;
const registeredNotifications_ = {};
let contextMenuCreated = false;

// Firefox Android does not support such APIs, use noop
const browserAction = [
  'setIcon',
  'setBadgeText',
  'setBadgeBackgroundColor',
].reduce((actions, key) => {
  const fn = browser.browserAction[key];
  actions[key] = fn ? fn.bind(browser.browserAction) : noop;
  return actions;
}, {});

hookOptions(changes => {
  if ('isApplied' in changes) setIcon(changes.isApplied);
  if ('autoUpdate' in changes) autoUpdate();
  if ('showBadge' in changes) updateBadges();
  const SCRIPT_TEMPLATE = 'scriptTemplate';
  if (SCRIPT_TEMPLATE in changes && !changes[SCRIPT_TEMPLATE]) {
    setOption(SCRIPT_TEMPLATE, getDefaultOption(SCRIPT_TEMPLATE));
  }
  sendMessageOrIgnore({
    cmd: 'UpdateOptions',
    data: changes,
  });
});

function onGlobalContextMenuClick(info, tab) {
  browser.tabs.sendMessage(tab.id, {
    cmd: 'WatchOnlineMenuClicked',
    data: {
      url: info.linkUrl,
    },
  });
}

function createGlobalContextMenu() {
  if (contextMenuCreated) {
    return Promise.resolve();
  }

  contextMenuCreated = true;
  verbose('bg:create context menu');

  return new Promise(resolve => {
    browser.contextMenus.create(
      {
        id: 'awe-watch-online',
        title: 'Watch online',
        contexts: ['link'],
        onclick: onGlobalContextMenuClick,
      },
      () => {
        // check lastError to suppress errors on console
        browser.runtime.lastError; // eslint-disable-line no-unused-expressions
        resolve();
      },
    );
  });
}

function checkUpdateAll() {
  setOption('lastUpdate', Date.now());
  getScripts()
  .then(scripts => {
    const toUpdate = scripts.filter(item => objectGet(item, 'config.shouldUpdate'));
    return Promise.all(toUpdate.map(checkUpdate));
  })
  .then(updatedList => {
    if (updatedList.some(Boolean)) sync.sync();
  });
}

let autoUpdating;
function autoUpdate() {
  if (autoUpdating) return;
  autoUpdating = true;
  check();
  function check() {
    new Promise((resolve, reject) => {
      if (!getOption('autoUpdate')) return reject();
      if (Date.now() - getOption('lastUpdate') >= 864e5) resolve(checkUpdateAll());
    })
    .then(() => setTimeout(check, 36e5), () => { autoUpdating = false; });
  }
}

const commands = {
  NewScript(id) {
    return id && cache.get(`new-${id}`) || newScript();
  },
  CacheNewScript(data) {
    const id = getUniqId();
    cache.put(`new-${id}`, newScript(data));
    return id;
  },
  RemoveScript(id) {
    return removeScript(id)
    .then(() => { sync.sync(); });
  },
  GetData(clear) {
    return (clear ? checkRemove() : Promise.resolve())
    .then(getData)
    .then(data => {
      data.sync = sync.getStates();
      data.version = VM_VER;
      return data;
    });
  },
  GetInjected({ url, reset, isTop }, src) {
    const srcTab = src.tab || {};
    if (reset && srcTab.id) resetValueOpener(srcTab.id);
    const data = {
      isApplied: getOption('isApplied'),
      version: VM_VER,
    };
    if (!data.isApplied) return data;
    return getScriptsByURL(url, isTop)
    .then(res => {
      addValueOpener(srcTab.id, Object.keys(res.values));
      return Object.assign(data, res);
    });
  },
  UpdateScriptInfo({ id, config }) {
    return updateScriptInfo(id, {
      config,
      props: {
        lastModified: Date.now(),
      },
    })
    .then(([script]) => {
      sync.sync();
      sendMessageOrIgnore({
        cmd: 'UpdateScript',
        data: {
          where: { id: script.props.id },
          update: script,
        },
      });
    });
  },
  GetValueStore(id) {
    return getValueStoresByIds([id]).then(res => res[id] || {});
  },
  SetValueStore({ where, valueStore }) {
    // Value store will be replaced soon.
    return setValueStore(where, valueStore);
  },
  UpdateValue({ id, update }) {
    // Value will be updated to store later.
    return updateValueStore(id, update);
  },
  ExportZip({ ids, values }) {
    return getExportData(ids, values);
  },
  GetScriptCode(id) {
    return getScriptCode(id);
  },
  GetMetas(ids) {
    return getScriptByIds(ids);
  },
  Move({ id, offset }) {
    return moveScript(id, offset)
    .then(() => {
      sync.sync();
    });
  },
  Vacuum: vacuum,
  ParseScript(data) {
    return parseScript(data).then(res => {
      sync.sync();
      return res.data;
    });
  },
  CheckUpdate(id) {
    getScript({ id }).then(checkUpdate)
    .then(updated => {
      if (updated) sync.sync();
    });
  },
  CheckUpdateAll: checkUpdateAll,
  ParseMeta(code) {
    return parseMeta(code);
  },
  GetRequestId: getRequestId,
  HttpRequest(details, src) {
    httpRequest(details, res => {
      browser.tabs.sendMessage(src.tab.id, {
        cmd: 'HttpRequested',
        data: res,
      })
      .catch(noop);
    });
  },
  AbortRequest: abortRequest,
  SetBadge: setBadge,
  SyncAuthorize: sync.authorize,
  SyncRevoke: sync.revoke,
  SyncStart: sync.sync,
  CacheLoad(data) {
    return cache.get(data) || null;
  },
  CacheHit(data) {
    cache.hit(data.key, data.lifetime);
  },
  Notification: createNotification,
  SetClipboard: setClipboard,
  TabOpen: tabOpen,
  TabClose: tabClose,
  GetAllOptions: getAllOptions,
  GetOptions(data) {
    return data.reduce((res, key) => {
      res[key] = getOption(key);
      return res;
    }, {});
  },
  SetOptions(data) {
    const items = Array.isArray(data) ? data : [data];
    items.forEach(item => { setOption(item.key, item.value); });
  },
  ConfirmInstall: confirmInstall,
  CheckScript({ name, namespace }) {
    return getScript({ meta: { name, namespace } })
    .then(script => (script ? script.meta.version : null));
  },
  GetInstalledScripts() {
    return getInstalledScripts();
  },
  CheckPosition() {
    return sortScripts();
  },
  GetEngineStatus() {
    return getEngineStatus();
  },
  GetAvailablePlayers(data) {
    return new Promise(resolve => {
      getAvailablePlayers(data.params, response => resolve(response));
    });
  },
  OpenInPlayer(data) {
    return new Promise(resolve => {
      openInPlayer(data.params, data.playerId, response => resolve(response));
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
  GetConfig(data) {
    const values = {
      'remote-control-url': 'http://127.0.0.1:6878/remote-control',
      _a: null,
      mode: 0,
    };

    return Promise.resolve(values[data.name]);
  },
  RegisterContextMenuCommand() {
    return createGlobalContextMenu();
  },
  StartEngine() {
    verbose('bg: start engine');
    return new Promise(resolve => {
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
    });
  },
  CheckNews({ url }) {
    verbose(`bg: check news: url=${url}`);

    if (!url) {
      return Promise.reject('missing url');
    }

    const newsList = news.getNewsForUrl(url);
    for (let i = 0; i < newsList.length; i += 1) {
      let targetUrl;
      const newsId = newsList[i].id;
      const buttons = [];
      const notificationId = `awe-notification-${Math.ceil(Math.random() * 1000000)}`;

      if (newsList[i].btnUrl) {
        targetUrl = newsList[i].btnUrl;

        if (NOTIFICATIONS_BUTTONS_SUPPORTED) {
          buttons.push({ title: newsList[i].btnTitle || i18n('notifShowMore') });
          buttons.push({ title: i18n('notifDontShowAnymore') });
        }
      }

      const options = {
        type: 'basic',
        title: newsList[i].title || '',
        iconUrl: '/public/images/icon128.png',
        message: newsList[i].text,
      };

      if (NOTIFICATIONS_BUTTONS_SUPPORTED) {
        options.buttons = buttons;
      }

      browser.notifications.create(
        notificationId,
        options,
      ).then(newNotificationId => {
        verbose(`notification created: id=${newNotificationId}`);
        registeredNotifications_[newNotificationId] = {
          onClicked: () => {
            // Use has clicked notification itself.
            if (targetUrl) {
              browser.tabs.create({ url: targetUrl });
            }
            news.onInstallButtonClicked(newsId);
            browser.notifications.clear(newNotificationId);
          },
          onButtonClicked: index => {
            if (index === 0) {
              // User has pressed 'Install' button
              if (targetUrl) {
                browser.tabs.create({ url: targetUrl });
              }
              news.onInstallButtonClicked(newsId);
            } else if (index === 1) {
              // User has pressed 'No, thanks' button
              news.onSkipButtonClicked(newsId);
            }
            browser.notifications.clear(newNotificationId);
          },
        };
      });

      news.registerImpression(newsId);

      if (!NOTIFICATIONS_BUTTONS_SUPPORTED) {
        window.setTimeout(() => {
          browser.notifications.clear(notificationId);
        }, 15000);
      }
    }

    return Promise.resolve();
  },
};

// Import scripts from tampermonkey extension
function importScripts() {
  if (typeof chrome === 'undefined') {
    // Not Chrome, do nothing
    return Promise.resolve();
  }

  // Chrome, import scripts from tampermonkey database
  return getInstalledScriptsTm().then(scripts => {
    verbose('tm scripts', scripts);

    getInstalledScripts().then(installed => {
      verbose('bg:init: installed scripts', installed);

      scripts.forEach(script => {
        if (!installed.includes(script.scriptId)) {
          verbose(`bg:init: install new script: id=${script.scriptId}`);
          parseScript({
            url: script.fileURL,
            code: script.code,
          });
        } else {
          verbose(`bg:init: script already installed: id=${script.scriptId}`);
        }
      });
    });
  });
}

function getInstalledScriptsTm() {
  return new Promise(resolve => {
    const rea = tmWrapper.getRea();
    const registry = tmWrapper.getRegistry();
    const storage = registry.get('storage');
    const installedScripts = [];

    storage.init().then(() => {
      storage.listValues().forEach(e => {
        if (e.match(`^${rea.FEATURES.CONSTANTS.PREFIX.META}`)) {
          const s = storage.getValue(e);
          let scriptId = '';
          if (s.namespace) {
            scriptId = `${s.namespace}/`;
          }
          scriptId += s.name;
          s.scriptId = scriptId;
          installedScripts.push(s);
        }
      });

      // get code
      installedScripts.forEach(script => {
        script.code = storage.getValue(rea.FEATURES.CONSTANTS.PREFIX.SCRIPT + script.uuid);

        // cleanup (we need to import scripts only once)
        storage.deleteValue(rea.FEATURES.CONSTANTS.PREFIX.META + script.uuid);
        storage.deleteValue(rea.FEATURES.CONSTANTS.PREFIX.SCRIPT + script.uuid);
      });

      resolve(installedScripts);
    });
  });
}

initialize()
.then(() => {
  browser.runtime.onMessage.addListener((req, src) => {
    const func = commands[req.cmd];
    let res;
    if (func) {
      res = func(req.data, src);
      if (typeof res !== 'undefined') {
        // If res is not instance of native Promise, browser APIs will not wait for it.
        res = Promise.resolve(res)
        .then(data => ({ data }), error => {
          if (process.env.DEBUG) console.error(error);
          return { error };
        });
      }
    }
    // undefined will be ignored
    return res || null;
  });
  setTimeout(autoUpdate, 2e4);
  sync.initialize();
  resetBlacklist();
  checkRemove();

  importScripts()
  .then(news.initialize);
});

// Common functions

const badges = {};
function setBadge({ ids, reset }, src) {
  const srcTab = src.tab || {};
  let data = !reset && badges[srcTab.id];
  if (!data) {
    data = {
      number: 0,
      unique: 0,
      idMap: {},
    };
    badges[srcTab.id] = data;
  }
  data.number += ids.length;
  if (ids) {
    ids.forEach(id => {
      data.idMap[id] = 1;
    });
    data.unique = Object.keys(data.idMap).length;
  }
  browserAction.setBadgeBackgroundColor({
    color: '#808',
    tabId: srcTab.id,
  });
  updateBadge(srcTab.id);
}
function updateBadge(tabId) {
  const data = badges[tabId];
  if (data) {
    const showBadge = getOption('showBadge');
    let text;
    if (showBadge === 'total') text = data.number;
    else if (showBadge) text = data.unique;
    browserAction.setBadgeText({
      text: `${text || ''}`,
      tabId,
    });
  }
}
function updateBadges() {
  browser.tabs.query({})
  .then(tabs => {
    tabs.forEach(tab => {
      updateBadge(tab.id);
    });
  });
}
browser.tabs.onRemoved.addListener(id => {
  delete badges[id];
});

function setIcon(isApplied) {
  browserAction.setIcon({
    path: {
      19: `/public/images/icon19${isApplied ? '' : 'w'}.png`,
      38: `/public/images/icon38${isApplied ? '' : 'w'}.png`,
    },
  });
}
setIcon(getOption('isApplied'));

browser.notifications.onClicked.addListener(id => {
  broadcast({
    cmd: 'NotificationClick',
    data: id,
  });

  if (registeredNotifications_[id] && typeof registeredNotifications_[id].onClicked === 'function') {
    registeredNotifications_[id].onClicked();
  }
});

browser.notifications.onClosed.addListener(id => {
  broadcast({
    cmd: 'NotificationClose',
    data: id,
  });

  if (registeredNotifications_[id]) {
    delete registeredNotifications_[id];
  }
});

if (NOTIFICATIONS_BUTTONS_SUPPORTED) {
  // Show notifications each 60 seconds until skipped by user.
  news.setConfig({
    notificationBaseInterval: 60000,
    notificationIntervalAdjust: 0,
    notificationMaxImpressions: 0,
  });
  browser.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (registeredNotifications_[notificationId] && typeof registeredNotifications_[notificationId].onButtonClicked === 'function') {
      registeredNotifications_[notificationId].onButtonClicked(buttonIndex);
    }
  });
}

browser.tabs.onRemoved.addListener(id => {
  broadcast({
    cmd: 'TabClosed',
    data: id,
  });
});

statistics.init();

// Check privacy opt-in
getPrivacyOptions().then(result => {
  if (!result.confirmed) {
    browser.tabs.create({ url: '/options/index.html#privacySettings' });
  }
});
