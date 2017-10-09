import 'src/common/browser';
import { i18n, defaultImage, verbose } from 'src/common';
import { objectGet } from 'src/common/object';
import * as sync from './sync';
import * as news from './utils/news';
import {
  cache,
  getRequestId, httpRequest, abortRequest, confirmInstall,
  newScript, parseMeta,
  setClipboard, checkUpdate,
  getOption, setOption, hookOptions, getAllOptions,
  initialize, broadcast,
} from './utils';
import {
  getScripts, removeScript, getData, checkRemove, getScriptsByURL,
  updateScriptInfo, getExportData, getScriptCode,
  getScriptByIds, moveScript, vacuum, parseScript, getScript,
  normalizePosition, getInstalledScripts,
} from './utils/db';
import { resetBlacklist } from './utils/tester';
import { setValueStore, updateValueStore } from './utils/values';

import {
  getEngineStatus,
  getAvailablePlayers,
  openInPlayer,
  getDeviceId,
} from './utils/engine-api';

const VM_VER = browser.runtime.getManifest().version;

// not supported by Firefox yet
const NOTIFICATIONS_BUTTONS_SUPPORTED = false;
const registeredNotifications_ = {};
let contextMenuCreated = false;

hookOptions(changes => {
  if ('isApplied' in changes) setIcon(changes.isApplied);
  browser.runtime.sendMessage({
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
    return;
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
  NewScript() {
    return newScript();
  },
  RemoveScript(id) {
    return removeScript(id)
    .then(() => { sync.sync(); });
  },
  GetData() {
    return checkRemove()
    .then(changed => {
      if (changed) sync.sync();
      return getData();
    })
    .then(data => {
      data.sync = sync.getStates();
      data.version = VM_VER;
      return data;
    });
  },
  GetInjected({ url, isTop }, src) {
    const data = {
      isApplied: getOption('isApplied'),
      version: VM_VER,
    };
    setTimeout(() => {
      // delayed to wait for the tab URL updated
      if (src.tab && url === src.tab.url) {
        browser.tabs.sendMessage(src.tab.id, { cmd: 'GetBadge' });
      }
    });
    return data.isApplied ? (
      getScriptsByURL(url, isTop).then(res => Object.assign(data, res))
    ) : data;
  },
  UpdateScriptInfo({ id, config }) {
    return updateScriptInfo(id, {
      config,
      custom: {
        modified: Date.now(),
      },
    })
    .then(([script]) => {
      sync.sync();
      browser.runtime.sendMessage({
        cmd: 'UpdateScript',
        data: {
          where: { id: script.props.id },
          update: script,
        },
      });
    });
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
    .then(() => { sync.sync(); });
  },
  Vacuum: vacuum,
  ParseScript(data) {
    return parseScript(data).then(res => {
      browser.runtime.sendMessage(res).catch(() => {});
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
  AutoUpdate: autoUpdate,
  GetRequestId: getRequestId,
  HttpRequest(details, src) {
    httpRequest(details, res => {
      browser.tabs.sendMessage(src.tab.id, {
        cmd: 'HttpRequested',
        data: res,
      });
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
  Notification(data) {
    return browser.notifications.create({
      type: 'basic',
      title: data.title || i18n('extName'),
      message: data.text,
      iconUrl: data.image || defaultImage,
    });
  },
  SetClipboard: setClipboard,
  TabOpen(data, src) {
    const srcTab = src.tab || {};
    return browser.tabs.create({
      url: data.url,
      active: data.active,
      windowId: srcTab.windowId,
      index: srcTab.index + 1,
    })
    .then(tab => ({ id: tab.id }));
  },
  TabClose(data, src) {
    const tabId = (data && data.id) || (src.tab && src.tab.id);
    if (tabId) browser.tabs.remove(tabId);
  },
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
    return normalizePosition();
  },
  GetEngineStatus() {
    return new Promise(resolve => {
      getEngineStatus(response => resolve(response));
    });
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
          buttons.push({ title: newsList[i].btnTitle || browser.i18n.getMessage('show_more') });
          buttons.push({ title: browser.i18n.getMessage('do_not_show_anymore') });
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
        registeredNotifications_[newNotificationId] = {
          onClicked: () => {
            if (targetUrl) {
              browser.tabs.create({ url: targetUrl });
            }
            news.markAsRead(newsId);
            browser.notifications.clear(newNotificationId, () => {});
          },
          onButtonClicked: index => {
            if (index === 0) {
              if (targetUrl) {
                browser.tabs.create({ url: targetUrl });
              }
              news.markAsRead(newsId);
            } else if (index === 1) {
              news.markAsRead(newsId);
            }
            browser.notifications.clear(newNotificationId, () => {});
          },
        };
      });

      news.registerImpression(newsId);

      window.setTimeout(() => {
        browser.notifications.clear(notificationId, () => {});
      }, 15000);
    }

    return Promise.resolve();
  },
};

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
    return res;
  });
  setTimeout(autoUpdate, 2e4);
  sync.initialize();
  resetBlacklist();
  checkRemove();
  news.initialize();
});

// Common functions

const badges = {};
function setBadge(num, src) {
  let data = badges[src.id];
  if (!data) {
    data = { num: 0 };
    badges[src.id] = data;
  }
  data.num += num;
  browser.browserAction.setBadgeBackgroundColor({
    color: '#808',
    tabId: src.tab.id,
  });
  const text = ((getOption('showBadge') && data.num) || '').toString();
  browser.browserAction.setBadgeText({
    text,
    tabId: src.tab.id,
  });
  if (data.timer) clearTimeout(data.timer);
  data.timer = setTimeout(() => { delete badges[src.id]; }, 300);
}

function setIcon(isApplied) {
  browser.browserAction.setIcon({
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

// request data from host legacy extension
browser.runtime.sendMessage('get-all-userscripts')
.then(response => {
  if (!response) {
    return;
  }

  const { scripts } = response;

  getInstalledScripts().then(installed => {
    verbose('bg:init: installed scripts', installed);

    scripts.forEach(script => {
      if (!installed.includes(script.id)) {
        verbose(`bg:init: install new script: id=${script.id}`);
        parseScript({
          url: script.url,
          code: script.code,
        });
      } else {
        verbose(`bg:init: script already installed: id=${script.id}`);
      }
    });
  });
})
.catch(() => {});

// request news
browser.runtime.sendMessage('get-news')
.then(response => {
  if (!response) {
    return;
  }

  if (!response.news) {
    return;
  }

  news.importData(response.news);
})
.catch(() => {});
