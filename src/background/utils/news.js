import { verbose, request, assertTestMode, i18n } from '@/common';
import { getVendor } from '@/common/vendor';
import { getPrivacyOptions } from '@/common/privacy';
import { getEngineStatus } from './engine-api';
import { getInstalledScripts, eventEmitter, updateScriptInfo } from './db';
import { addPublicCommands } from './message';
import { preInitialize } from './init';
import { addOpener } from './notifications';

const NOTIFICATIONS_BUTTONS_SUPPORTED = !IS_FIREFOX;

preInitialize.push(async () => initialize());

addPublicCommands({
  CheckNews({ url }) {
    verbose(`bg: check news: url=${url}`);

    if (!url) {
      return Promise.reject('missing url');
    }

    const newsList = getNewsForUrl(url);
    for (let i = 0; i < newsList.length; i += 1) {
      const targetUrl = newsList[i].btnUrl;
      const scriptIdToEnable = newsList[i].scriptIdToEnable;
      const newsId = newsList[i].id;
      const buttons = [];
      const notificationId = `awe-notification-${Math.ceil(Math.random() * 1000000)}`;

      if (targetUrl || scriptIdToEnable) {
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

        addOpener(newNotificationId, (isClick, buttonIndex) => {
          verbose(`notification event: isClick=${isClick} buttonIndex=${buttonIndex}`);
          if(isClick) {
            if(buttonIndex === 1) {
              // user clicked skip button
              onSkipButtonClicked(newsId);
            } else {
              // user clicked notification itself or "install" button
              if (targetUrl) {
                browser.tabs.create({ url: targetUrl });
              } else if(scriptIdToEnable) {
                enableScript(scriptIdToEnable);
              }
              onInstallButtonClicked(newsId);
            }
          }
        });
      });

      registerImpression(newsId);

      if (!NOTIFICATIONS_BUTTONS_SUPPORTED) {
        window.setTimeout(() => {
          browser.notifications.clear(notificationId);
        }, 15000);
      }
    }

    return Promise.resolve();
  }
});

function enableScript(scriptId) {
  updateScriptInfo(scriptId, {
      config: {
        enabled: 1,
      },
    })
    .then(() => console.log('script enabled'))
    .catch(error => console.log(`failed to enable script: ${error}`));
}

eventEmitter.on('scriptSaved', data => {
  verbose('news:scriptSaved: data', data);
  updateInstalledScripts();
});

eventEmitter.on('scriptRemoved', data => {
  verbose('news:scriptRemoved: data', data);
  updateInstalledScripts();
});

eventEmitter.on('scriptUpdated', data => {
  verbose('news:scriptUpdated: data', data);
  updateInstalledScripts();
});


const store = {
  config: {
    checkInterval: 14400000,
    // for testing
    notificationBaseInterval: 60000,
    // notificationBaseInterval: 3600000,
    notificationIntervalAdjust: NOTIFICATIONS_BUTTONS_SUPPORTED ? 0 : 3600000,
    notificationMaxImpressions: NOTIFICATIONS_BUTTONS_SUPPORTED ? 0 : 10,
    notificationMaxSkip: 2,
    notificationBaseSkipInterval: 7 * 86400 * 1000, // 1 week
    notificationSkipIntervalAdjust: 0,
    forceLocale: false,
  },
  initDone: false,
  lastEngineVersion: 0,
  news: {},
  installedScripts: {},
  excludeByScript: {},
  privacyOptInAccepted: false,
};

function updateInstalledScripts() {
  return getInstalledScripts({ mode: 'full' }).then(installed => {
    store.installedScripts = {};
    installed.forEach(script => {
      store.installedScripts[script.props.scriptId] = script;
    });
    verbose('news:updateInstalledScripts', store.installedScripts);
  });
}

function getLocale() {
  return browser.i18n.getUILanguage();
}

function loadPrivacyOptions() {
  return getPrivacyOptions().then(response => {
    store.privacyOptInAccepted = response.accepted;
  });
}

function loadConfig() {
  return browser.storage.local.get('news')
  .then(response => {
    if (response && response.news) {
      store.news = JSON.parse(response.news);
    }
  });
}

function updateExcludes() {
  const excludeByScript = {};
  Object.keys(store.news).forEach(id => {
    if (typeof store.news[id].read !== 'undefined') {
      delete store.news[id].read;
    }

    if (store.news[id].excludeScripts) {
      store.news[id].excludeScripts.forEach(scriptId => {
        if (typeof excludeByScript[scriptId] === 'undefined') {
          excludeByScript[scriptId] = {};
        }

        const fields = [
          'skipCount',
          'skipUpdatedAt',
          'impressionCount',
          'impressionUpdatedAt',
        ];

        fields.forEach(field => {
          if (store.news[id][field]) {
            excludeByScript[scriptId][field] = store.news[id][field];
          }
        });
      });
    }
  });
  store.excludeByScript = excludeByScript;
  verbose('updateExcludes: excludeByScript', excludeByScript);
  return Promise.resolve();
}

function saveConfig() {
  updateExcludes();
  browser.storage.local.set({
    news: JSON.stringify(store.news),
  });
}

function check() {
  return getEngineStatus()
  .then(checkNews)
  .catch(err => {
    verbose(`failed to check news: err=${err}`);
  });
}

function checkNews(engineStatus) {
  verbose('checkNews: engineStatus', engineStatus);

  const appVersion = browser.runtime.getManifest().version;
  if (engineStatus && engineStatus.version > 0) {
    store.lastEngineVersion = engineStatus.version;
  }

  const forceLocale = store.config.forceLocale ? 1 : 0;
  const url = `https://awe-api.acestream.me/news/get?vendor=${getVendor()}&locale=${getLocale()}&force_locale=${forceLocale}&appVersion=${appVersion}&engineVersion=${store.lastEngineVersion}&privacy_opt_in=${store.privacyOptInAccepted}&_=${Math.random()}`;
  verbose(`news: request: url=${url}`);

  // schedule next update
  if (store.config.checkInterval > 0) {
    verbose(`news: schedule next check in ${store.config.checkInterval}ms`);
    window.setTimeout(check, store.config.checkInterval);
  }

  return request(url, { responseType: 'json' }).then(response => {
    if (response.status !== 200) {
      return Promise.reject(`Bad status code: ${response.status}`);
    }

    let updated = false;
    const remote = response.data;

    const keys = Object.keys(remote);
    verbose(`news: loaded ${keys.length} news`);

    keys.forEach(id => {
      if (!store.news[id]) {
        store.news[id] = remote[id];
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
  });
}

function shouldShowNotification(id, item) {
  const skipCount = item.skipCount || 0;
  if (store.config.notificationMaxSkip > 0 && skipCount >= store.config.notificationMaxSkip) {
    verbose(`shouldShowNotification: max skip: id=${id} count=${skipCount}`);
    return false;
  }

  const impressionCount = item.impressionCount || 0;
  if (store.config.notificationMaxImpressions > 0
      && impressionCount >= store.config.notificationMaxImpressions) {
    verbose(`shouldShowNotification: max impressions: id=${id} count=${impressionCount}`);
    return false;
  }

  if (item.skipUpdatedAt) {
    const skipUpdatedAt = item.skipUpdatedAt || 0;
    const skipAge = Date.now() - skipUpdatedAt;
    const skipMinAge = store.config.notificationBaseSkipInterval
      + (skipCount * store.config.notificationSkipIntervalAdjust);

    if (skipAge < skipMinAge) {
      verbose(`shouldShowNotification: skip age: id=${id} age=${skipAge} minAge=${skipMinAge}`);
      return false;
    }
  }

  if (item.impressionUpdatedAt) {
    const impressionUpdatedAt = item.impressionUpdatedAt || 0;
    const age = Date.now() - impressionUpdatedAt;
    const minAge = store.config.notificationBaseInterval
      + (impressionCount * store.config.notificationIntervalAdjust);

    if (age < minAge) {
      verbose(`shouldShowNotification: impression age: id=${id} age=${age} minAge=${minAge}`);
      return false;
    }
  }


  return true;
}

export function initialize() {
  if (store.initDone_) {
    return Promise.resolve();
  }

  store.initDone_ = true;
  return loadPrivacyOptions()
  .then(loadConfig)
  .then(updateInstalledScripts)
  .then(updateExcludes)
  .then(check)
  .catch(err => {
    verbose(`news: init failed: err=${err}`);
  });
}

export function importData(news) {
  verbose(`import news: count=${Object.keys(news).length}`);
  store.news = news;
  saveConfig();
}

export function getNewsForUrl(url) {
  const result = [];

  Object.keys(store.news).forEach(id => {
    let gotMatch = false;
    if (store.news[id].includes && store.news[id].includes.length) {
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
      if (!shouldShowNotification(id, store.news[id])) {
        verbose(`getNewsForUrl: skip: id=${id} url=${url}`);
        return;
      }

      if (store.news[id].excludeBasedOnOther
        && store.news[id].excludeScripts
        && store.news[id].excludeScripts.length) {
        for (let i = 0; i < store.news[id].excludeScripts.length; i += 1) {
          const scriptId = store.news[id].excludeScripts[i];
          if (store.excludeByScript[scriptId]) {
            if (!shouldShowNotification(id, store.excludeByScript[scriptId])) {
              verbose(`getNewsForUrl: skip (other): id=${id} scriptId=${scriptId}`);
              return;
            }
          }
        }
      }

      let scriptInstalled = false;
      let scriptEnabled = false;
      let targetScriptId;
      let targetScriptName;
      if (store.news[id].excludeScripts && store.news[id].excludeScripts.length) {
        // check all installed scripts
        verbose('getNewsForUrl: installedScripts', store.installedScripts);
        for (let i = 0; i < store.news[id].excludeScripts.length; i += 1) {
          targetScriptId = store.news[id].excludeScripts[i];
          const script = store.installedScripts[targetScriptId];
          targetScriptName = script.meta.name;
          if (script) {
            scriptInstalled = true;
            scriptEnabled = script.config.enabled;
            verbose(`getNewsForUrl: got installed script: id=${id} script=${targetScriptId} enabled=${scriptEnabled}`);
            break;
          }
        }
      }

      if (!scriptInstalled) {
        result.push({
          id,
          title: store.news[id].title,
          text: store.news[id].text,
          btnUrl: store.news[id].btnUrl,
          btnTitle: store.news[id].btnTitle,
        });
      } else if (!scriptEnabled) {
        result.push({
          id,
          title: i18n('notifEnableTitle'),
          text: i18n('notifEnableText', [ targetScriptName ]),
          //TODO: implement one-click script enabling
          // scriptIdToEnable: targetScriptId,
          btnUrl: '/options/index.html#scripts',
          btnTitle: i18n('notifEnableScript'),
        });
      }
    }
  });
  return result;
}

export function onInstallButtonClicked(id) {
  if (store.news[id]) {
    // Update impression to prevent showing notification for some short time.
    // We assume that user will install userscript during this time.
    verbose(`news:onInstallButtonClicked: id=${id}`);
    store.news[id].impressionUpdatedAt = Date.now();
    saveConfig();
  }
}

export function onSkipButtonClicked(id) {
  if (store.news[id]) {
    verbose(`news:onSkipButtonClicked: id=${id}`);
    if (typeof store.news[id].skipCount === 'undefined') {
      store.news[id].skipCount = 0;
    }
    store.news[id].skipUpdatedAt = Date.now();
    store.news[id].skipCount += 1;
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

export function setConfig(values) {
  Object.assign(store.config, values);
}

export function setInstalledScripts(scripts) {
  assertTestMode();
  store.installedScripts = {};
  scripts.forEach(id => {
    store.installedScripts[id] = 1;
  });
}

export function reset() {
  assertTestMode();
  Object.keys(store.news).forEach(id => {
    ['impressionCount', 'impressionUpdatedAt', 'skipCount', 'skipUpdatedAt'].forEach(field => {
      delete store.news[id][field];
    });
  });
  setInstalledScripts([]);
  updateExcludes();
}

export function setReadFlag(id) {
  assertTestMode();
  store.news[id].read = true;
}
