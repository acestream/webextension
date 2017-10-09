import { verbose } from 'src/common';
import { getVendor } from 'src/common/ua';
import { getEngineStatus } from './engine-api';
import { getInstalledScripts, eventEmitter } from './db';

// minimum interval between showing same news
const NOTIFICATION_BASE_INTERVAL = 3600000;
const NOTIFICATION_INTERVAL_ADJUST = 3600000;
const NOTIFICATION_MAX_IMPRESSIONS = 10;

eventEmitter.on('scriptSaved', data => {
  verbose('news:scriptSaved: data', data);
  updateInstalledScripts();
});

eventEmitter.on('scriptRemoved', data => {
  verbose('news:scriptRemoved: data', data);
  updateInstalledScripts();
});

const store = {
  checkInterval: 14400000,
  initDone: false,
  lastEngineVersion: 0,
  news: {},
  installedScripts: {},
};

function updateInstalledScripts() {
  getInstalledScripts().then(installed => {
    store.installedScripts = {};
    installed.forEach(id => {
      store.installedScripts[id] = 1;
    });
    verbose('news:updateInstalledScripts', store.installedScripts);
  });
}

function getLocale() {
  return browser.i18n.getUILanguage();
}

function loadConfig() {
  browser.storage.local.get(
    'news',
    response => {
      if (response && response.news) {
        store.news = JSON.parse(response.news);
      }
    },
  );
}

function saveConfig() {
  browser.storage.local.set({
    news: JSON.stringify(store.news),
  });
}

function check() {
  checkEngine(checkNews);
}

function checkEngine(callback) {
  getEngineStatus(response => {
    callback(response);
  });
}

function checkNews(engineStatus) {
  try {
    verbose('checkNews: engineStatus', engineStatus);

    const appVersion = browser.runtime.getManifest().version;
    if (engineStatus && engineStatus.version > 0) {
      store.lastEngineVersion = engineStatus.version;
    }

    const xhr = new XMLHttpRequest();
    const url = `http://awe-api.acestream.me/news/get?vendor=${getVendor()}&locale=${getLocale()}&appVersion=${appVersion}&engineVersion=${store.lastEngineVersion}&_=${Math.random()}`;

    verbose(`news: request: url=${url}`);
    xhr.open('GET', url, true);
    xhr.timeout = 10000;
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          let updated = false;
          const remote = JSON.parse(xhr.responseText);

          const keys = Object.keys(remote);
          verbose(`news: loaded ${keys.length} news`);

          keys.forEach(id => {
            if (!store.news[id]) {
              store.news[id] = remote[id];
              store.news[id].read = false;
              updated = true;
            }
          });

          Object.keys(store.news).forEach(id => {
            if (!remote[id]) {
              delete store.news[id];
              updated = true;
            }
          });

          if (updated) {
            saveConfig();
          }
        } catch (e) {
          console.error(`news:check: error: ${e}`);
        }
      }
    };
    xhr.send();
  } catch (e) {
    console.error(`checkEngine: error: ${e}`);
  }
  window.setTimeout(check, store.checkInterval);
}

export function initialize() {
  if (!store.initDone_) {
    store.initDone_ = true;
    loadConfig();
    updateInstalledScripts();
    check();
  }
}
export function importData(news) {
  verbose(`import news: count=${Object.keys(news).length}`);
  store.news = news;
  saveConfig();
}

export function getNewsForUrl(url) {
  const result = [];

  Object.keys(store.news).forEach(id => {
    if (store.news[id].read) {
      return;
    }

    const impressionCount = store.news[id].impressionCount || 0;
    if (impressionCount >= NOTIFICATION_MAX_IMPRESSIONS) {
      return;
    }
    const impressionUpdatedAt = store.news[id].impressionUpdatedAt || 0;
    const age = Date.now() - impressionUpdatedAt;
    const minAge = NOTIFICATION_BASE_INTERVAL + (impressionCount * NOTIFICATION_INTERVAL_ADJUST);

    if (age < minAge) {
      return;
    }

    let gotMatch = false;
    if (store.news[id].includes && store.news[id].includes.length) {
      verbose(`getNewsForUrl: match against includes: url=${url}`);
      for (let i = 0; i < store.news[id].includes.length; i += 1) {
        const re = new RegExp(store.news[id].includes[i]);
        if (re.test(url)) {
          verbose(`getNewsForUrl: got includes match: re=${store.news[id].includes[i]} url=${url}`);
          gotMatch = true;
          break;
        }
      }
    } else if (store.news[id].excludes && store.news[id].excludes.length) {
      gotMatch = true;
      verbose(`getNewsForUrl: match against excludes: url=${url}`);
      for (let i = 0; i < store.news[id].excludes.length; i += 1) {
        const re = new RegExp(store.news[id].excludes[i]);
        if (re.test(url)) {
          verbose(`getNewsForUrl: got excludes match: re=${store.news[id].excludes[i]} url=${url}`);
          gotMatch = false;
          break;
        }
      }
    }

    if (gotMatch) {
      let notifyUser = true;
      if (store.news[id].excludeScripts && store.news[id].excludeScripts.length) {
        // check all installed scripts
        verbose('getNewsForUrl: installedScripts', store.installedScripts);
        for (let i = 0; i < store.news[id].excludeScripts.length; i += 1) {
          if (store.installedScripts[store.news[id].excludeScripts[i]] === 1) {
            verbose(`getNewsForUrl: skip user notify, got installed script: ${store.news[id].excludeScripts[i]}`);
            notifyUser = false;
            break;
          }
        }
      }

      if (notifyUser) {
        result.push({
          id,
          title: store.news[id].title,
          text: store.news[id].text,
          btnUrl: store.news[id].btnUrl,
          btnTitle: store.news[id].btnTitle,
        });
      }
    }
  });
  return result;
}

export function markAsRead(id) {
  if (store.news[id] && !store.news[id].read) {
    store.news[id].read = true;
    saveConfig();
  }
}

export function registerImpression(id) {
  if (store.news[id]) {
    if (typeof store.news[id].impressionCount === 'undefined') {
      store.news[id].impressionCount = 0;
    }
    store.news[id].impressionUpdatedAt = Date.now();
    store.news[id].impressionCount += 1;
    saveConfig();
  }
}
