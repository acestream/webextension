import tldRules from 'tldjs/rules.json';

global.window = global;

global.browser = {
  storage: {
    local: {
      get() {
        return Promise.resolve({
          'dat:tldRules': tldRules,
        });
      },
      set() {
        return Promise.resolve();
      },
    },
  },
  runtime: {
    getManifest() {
      return {
        version: process.env.npm_package_version,
      };
    },
    sendMessage() {
      return Promise.resolve();
    },
    sendNativeMessage(appId, options, callback) {
      if (typeof callback === 'function') {
        callback();
      }
    },
  },
  i18n: {
    getUILanguage() {
      return 'en';
    },
  },
};

global.navigator = {
  userAgent: 'firefox/test',
};
