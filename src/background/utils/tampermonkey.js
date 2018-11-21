// Module to access tampermonkey database (used for migration)
(function (h) {
  h.rea = {
    globals: window,
    extend(a) {
      var c = function (a, d) {
        for (const b in a) {
          if (a.hasOwnProperty(b)) {
            if (Object.getOwnPropertyDescriptor(a, b).get) d.__defineGetter__(b, a.__lookupGetter__(b));
            else {
              let e = a[b],
                f = typeof e;
              f != 'undefined' && (e === null ? d[b] = e : f == 'object' ? (d[b] = d[b] || {}, c(e, d[b])) : f == 'array' ? (d[b] = d[b] || [], c(e, d[b])) : d[b] = e);
            }
          }
        }
      };
      c(a, h.rea);
    },
  };
  h.rea.extend({
    content: {
      onReady(a) {
        var c = function () {
          document.webkitVisibilityState !== 'prerender' && (document.removeEventListener(
            'webkitvisibilitychange',
            c, !1,
          ), a());
        };
        document.webkitVisibilityState !== 'prerender' ? a() : document.addEventListener('webkitvisibilitychange', c, !1);
      },
    },
    runtime: (function () {
      const a = {};
      a.__defineGetter__('lastError', () => chrome.runtime.lastError);
      a.__defineGetter__('id', () => chrome.runtime.id);
      a.__defineGetter__('short_id', () => a.id.replace(/[^0-9a-zA-Z]/g, '').substr(0, 4));
      return a;
    }()),
    extension: {
      getURL(a) {
        return chrome.runtime.getURL(a);
      },
      sendMessage(a, c) {
        return chrome.runtime.sendMessage(
          a,
          c,
        );
      },
      onMessage: {
        addListener(a) {
          return chrome.runtime.onMessage.addListener(a);
        },
      },
      connect(a) {
        return chrome.runtime.connect(a);
      },
    },
  });
  h.rea.extend(function () {
    let a = 20,
      c = '537.33',
      g = !1;
    try {
      g = navigator.userAgent.search('OPR/') != -1;
    } catch (d) {}
    try {
      c = parseInt(navigator.userAgent.match(/AppleWebKit\/([0-9]+\.[0-9]+)/)[1]);
    } catch (b) {}
    try {
      a = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]);
    } catch (e) {}
    var f = {
      CONSTANTS: {
        STORAGE: {
          SCHEMA: '#schema',
          TYPE: '#storage',
          CONFIG: '#config',
          VERSION: '#version',
          LEGACY_VERSION: 'AWE_version',
          LAST_START: '#laststart',
          UPDATE: '#update',
          BEGGING: '#begging',
        },
        PREFIX: {
          SCRIPT_UID: '@uid#',
          COND: '@re#',
          STORE: '@st#',
          SCRIPT: '@source#',
          EXTERNAL: '@ext#',
          META: '@meta#',
        },
      },
      RUNTIME: {
        BROWSER: g ? 'opera' : 'chrome',
        CHROME: !g,
        OPERA: g,
        BROWSER_VERSION: a,
        WEBKIT_VERSION: c,
        ALLOWS_FAST_DOCUMENT_START: !0,
        ALLOWS_FILE_SCHEME_ACCESS: null,
        MAX_SCRIPTS: 1E3,
        CAN_SAVEAS_ZIP: !0,
        CONTEXT_MENU: !0,
        INCOGNITO_MODE: !0,
      },
      ACTIONMENU: {
        COLUMNS: 3,
        CLOSE_ALLOWED: !0,
      },
      OPTIONPAGE: {
        CLOSE_ALLOWED: !1,
      },
      DB: {
        USE: null,
        DEFAULT: 'chromeStorage',
      },
      XMLHTTPREQUEST: {
        RETRIES: 0,
        PARTIAL_SIZE: 16777216,
      },
      DOWNLOAD: {
        SUPPORTED: a >= 31,
      },
      SCRIPT_DOWNLOAD: {
        TIMEOUT: 15,
      },
      PINGPONG: {
        RETRIES: 10,
      },
      MISC: {
        TIMEOUT: 1,
        IDLE_TIMEOUT: 30,
        DISTURBANCE_ALLOWED: 60,
      },
      WEBREQUEST: {
        use: !0,
        headers: !0,
        id: 0,
        prefix: 'TM_',
      },
      SYNC: {
        GOOGLE_DRIVE: {
          SUPPORTED: !1,
          HAS_SERVICE_STATUS: !1,
        },
      },
      HTML5: {
        LOCALSTORAGE: null,
      },
      LOCALE: {
        DEFAULT: null,
      },
      REQUESTS: {
        HAS_SENDER_ID: !0,
        INTERNAL_PAGE_PROTOCOL: 'chrome-extension:',
        GET_INTERNAL_PATH_REGEXP(a, b) {
          const c = /(\/|\.|\+|\?|\||\(|\)|\[|\]|\{|\}|\\)/g;
          return RegExp(`${(`${f.REQUESTS.INTERNAL_PAGE_PROTOCOL
          }//${rea.runtime.id}/`).replace(c, '\\$1')}([a-zA-Z${a ? '\\/' : ''}]*)${(b || '').replace(c, '\\$1')}`);
        },
        GET_INTERNAL_PAGE_REGEXP() {
          return f.REQUESTS.GET_INTERNAL_PATH_REGEXP(!1, '.html');
        },
      },
      OPTIONS: {
        HAS_CSP: !0,
        HAS_TESLA: !g,
        HAS_DOWNLOADS: !0,
        NATIVE_SCRIPT_IMPORT: !0,
        CAN_DOWNLOAD: !0,
      },
    };
    return {
      FEATURES: f,
    };
  }());
}(window));

(function (g) {
  const d = g.FEATURES;
  g.extend({
    extension: {
      onConnect: {
        addListener(a) {
          return chrome.runtime.onConnect.addListener(a);
        },
      },
      onConnectExternal: {
        addListener(a) {
          return chrome.runtime.onConnectExternal.addListener(a);
        },
      },
      manifest: chrome.runtime.getManifest(),
      inIncognitoContext: chrome.extension.inIncognitoContext,
      getViews(a) {
        return chrome.extension.getViews(a);
      },
      isAllowedFileSchemeAccess(a) {
        return chrome.extension.isAllowedFileSchemeAccess(a);
      },
      urls: {
        prepareForReport(a) {
          return a;
        },
      },
    },
    runtime: {
      onInstalled: {
        addListener(a) {
          chrome.runtime.onInstalled && chrome.runtime.onInstalled.addListener(a);
        },
      },
      onUpdateAvailable: {
        addListener(a) {
          chrome.runtime.onUpdateAvailable && chrome.runtime.onUpdateAvailable.addListener(a);
        },
      },
    },
    tabs: {
      onActivated: {
        addListener(a) {
          return chrome.tabs.onActivated.addListener(a);
        },
      },
      onUpdated: {
        addListener(a) {
          return chrome.tabs.onUpdated.addListener(a);
        },
      },
      onReplaced: {
        addListener(a) {
          if (chrome.tabs.onReplaced) return chrome.tabs.onReplaced.addListener(a);
        },
      },
      onRemoved: {
        addListener(a) {
          return chrome.tabs.onRemoved.addListener(a);
        },
      },
      create(a, b) {
        return chrome.tabs.create(a, b);
      },
      update(a, b, c) {
        return chrome.tabs.update(a, b, c);
      },
      remove(a, b) {
        return chrome.tabs.remove(a, b);
      },
      highlight(a, b) {
        if (a && a.tabs) {
          a.tabs instanceof Array || (a.tabs = [a.tabs]);
          var c = [],
            d,
            f = function () {
              if (a.tabs.length) {
                const e = a.tabs.pop();
                chrome.tabs.get(e, a => {
                  void 0 === d && (d = a.windowId);
                  a.windowId === d && c.push(a.index);
                  f();
                });
              } else {
                return chrome.tabs.highlight({
                  windowId: d,
                  tabs: c,
                }, b);
              }
            };
          f();
        } else b && b();
      },
      getSelected(a, b) {
        return chrome.tabs.getSelected(a, b);
      },
      query(a, b) {
        return chrome.tabs.query(a, b);
      },
      sendMessage(a, b, c) {
        return chrome.tabs.sendMessage(a, b, c);
      },
    },
    webRequest: {
      headerModificationSupported: !0,
      onBeforeRequest: {
        addListener(a, b, c) {
          return chrome.webRequest.onBeforeRequest.addListener(a, b, c);
        },
        removeListener(a) {
          return chrome.webRequest.onBeforeRequest.removeListener(a);
        },
      },
      onBeforeSendHeaders: {
        addListener(a, b, c) {
          return chrome.webRequest.onBeforeSendHeaders.addListener(
            a,
            b, c,
          );
        },
        removeListener(a) {
          return chrome.webRequest.onBeforeSendHeaders.removeListener(a);
        },
      },
      onHeadersReceived: {
        addListener(a, b, c) {
          return chrome.webRequest.onHeadersReceived.addListener(a, b, c);
        },
        removeListener(a) {
          return chrome.webRequest.onHeadersReceived.removeListener(a);
        },
      },
      onCompleted: {
        addListener(a, b, c) {
          return chrome.webRequest.onCompleted.addListener(a, b, c);
        },
        removeListener(a) {
          return chrome.webRequest.onCompleted.removeListener(a);
        },
      },
      handlerBehaviorChanged(a) {
        return chrome.webRequest.handlerBehaviorChanged(a);
      },
    },
    webNavigation: {
      supported: !!chrome.webNavigation,
      onCommitted: {
        addListener(a) {
          if (chrome.webNavigation.onCommitted) return chrome.webNavigation.onCommitted.addListener(a);
        },
      },
    },
    browserAction: {
      setIcon(a, b) {
        return chrome.browserAction.setIcon(a, b);
      },
      setTitle(a) {
        return chrome.browserAction.setTitle(a);
      },
      setBadgeText(a) {
        return chrome.browserAction.setBadgeText(a);
      },
      setBadgeBackgroundColor(a) {
        return chrome.browserAction.setBadgeBackgroundColor(a);
      },
      setPopup(a) {
        return chrome.browserAction.setPopup(a);
      },
    },
    storage: {
      onChanged: {
        addListener(a) {
          return chrome.storage.onChanged.addListener(a);
        },
      },
      local: {
        set(a, b) {
          return chrome.storage.local.set(a, b);
        },
        get(a, b) {
          return chrome.storage.local.get(a, b);
        },
        remove(a, b) {
          return chrome.storage.local.remove(a, b);
        },
        clear(a) {
          return chrome.storage.local.clear(a);
        },
      },
      sync: {
        set(a, b) {
          return chrome.storage.sync.set(a, b);
        },
        get(a, b) {
          return chrome.storage.sync.get(a, b);
        },
        remove(a, b) {
          return chrome.storage.sync.remove(
            a,
            b,
          );
        },
        clear(a) {
          return chrome.storage.sync.clear(a);
        },
      },
    },
    syncFileSystem: {
      onFileStatusChanged: {
        addListener(a) {
          return chrome.syncFileSystem.onFileStatusChanged.addListener(a);
        },
      },
      onServiceStatusChanged: {
        addListener(a) {
          return chrome.syncFileSystem.onServiceStatusChanged.addListener(a);
        },
      },
      supported: !!chrome.syncFileSystem,
    },
    contentSettings: {
      javascript: {
        set(a, b) {
          return chrome.contentSettings.javascript.set(a, b);
        },
        get(a, b) {
          return chrome.contentSettings.javascript.get(
            a,
            b,
          );
        },
        clear(a, b) {
          return chrome.contentSettings.javascript.clear(a, b);
        },
      },
    },
    downloads: {
      onChanged: {
        addListener(a) {
          return chrome.downloads.onChanged.addListener(a);
        },
      },
      download(a, b) {
        return chrome.downloads.download(a, b);
      },
    },
    commands: {
      supported: !(!chrome.commands || !chrome.commands.onCommand),
      onCommand: {
        addListener(a) {
          return chrome.commands.onCommand.addListener(a);
        },
      },
    },
    management: {
      getAll(a) {
        return chrome.management.getAll(a);
      },
      setEnabled(a, b, c) {
        return chrome.management.setEnabled(
          a,
          b, c,
        );
      },
      uninstall(a, b, c) {
        return chrome.management.uninstall(a, b, c);
      },
    },
    notifications: {
      onPermissionLevelChanged: {
        addListener(a) {
          return chrome.notifications.onPermissionLevelChanged.addListener(a);
        },
      },
      onClicked: {
        addListener(a) {
          return chrome.notifications.onClicked.addListener(a);
        },
      },
      onClosed: {
        addListener(a) {
          return chrome.notifications.onClosed.addListener(a);
        },
      },
      supported: !!(chrome.notifications && chrome.notifications.getPermissionLevel && chrome.notifications.onPermissionLevelChanged &&
                chrome.notifications.onClicked),
      getPermissionLevel(a) {
        return chrome.notifications.getPermissionLevel(a);
      },
      create(a, b, c) {
        return chrome.notifications.create(a, b, c);
      },
      clear(a, b) {
        return chrome.notifications.clear(a, b);
      },
    },
    contextMenus: (function () {
      const a = !!(d.RUNTIME.CONTEXT_MENU && chrome.contextMenus && chrome.contextMenus.create && chrome.contextMenus.update && chrome.contextMenus.remove);
      return a ? {
        supported: a,
        create(a, c) {
          return chrome.contextMenus.create(a, c);
        },
        update(
          a,
          c, d,
        ) {
          return chrome.contextMenus.update(a, c, d);
        },
        remove(a, c) {
          return chrome.contextMenus.remove(a, c);
        },
        removeAll(a) {
          return chrome.contextMenus.removeAll(a);
        },
        onClicked: {
          addListener(a) {
            return chrome.contextMenus.onClicked.addListener(a);
          },
        },
      } : {
        supported: !1,
      };
    }()),
    permissions: {
      supported: !0,
      getAll(a) {
        return chrome.permissions.getAll(a);
      },
      request(a, b) {
        return chrome.permissions.request(a, b);
      },
      remove(a, b) {
        return chrome.permissions.remove(a, b);
      },
    },
    i18n: {
      native_support: !0,
      getMessage() {
        return chrome.i18n.getMessage.apply(this, arguments);
      },
      getUILanguage() {
        return chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage() : null;
      },
      getAcceptLanguages(a) {
        return chrome.i18n.getAcceptLanguages ? chrome.i18n.getAcceptLanguages(a) : a([]);
      },
    },
    idle: {
      queryState(a, b) {
        return chrome.idle.queryState(a, b);
      },
    },
    other: (function () {
      const a = {
        openDatabase(a, c, d, f) {
          const e = window.openDatabase;
          if (e) return e(a, c, d, f);
        },
        requestFileSystem(a, c, d, f) {
          const e = window.requestFileSystem ||
                        window.webkitRequestFileSystem;
          if (e) return e(a, c, d, f);
          f('not supported');
        },
      };
      a.__defineGetter__('webkitNotifications', () => window.webkitNotifications);
      return a;
    }()),
  });
  (function () {
    try {
      d.HTML5.LOCALSTORAGE = window.localStorage;
    } catch (a) {
      console.warn('prep: window.localStorage will be unavailable');
    }
    d.DB.USE = d.DB.DEFAULT;
    try {
      d.HTML5.LOCALSTORAGE && (d.DB.NO_WARNING = d.HTML5.LOCALSTORAGE.getItem('#brokenprofile') === 'nowarning', d.DB.USE = d.HTML5.LOCALSTORAGE.getItem(d.CONSTANTS.STORAGE.TYPE) || d.DB.DEFAULT);
    } catch (b) {
      console.warn(
        'prep: error at storage type detection',
        b,
      );
    }
    g.extension.isAllowedFileSchemeAccess(a => {
      d.RUNTIME.ALLOWS_FILE_SCHEME_ACCESS = a;
      d.INITIALIZED = !0;
    });
  }());
}(window.rea));

// registry.js
(function (m) {
  const e = (function () {
    var k = [],
      e = function (a, c, b) {
        a = typeof a === 'string' ? [a] : a;
        var g = 1,
          d = function () {
            return a.every(a => !!h[a]);
          },
          e = function () {
            k.push(() => {
              d() ? b() : e();
            });
          },
          f = function (a) {
            --g == 0 && b && (c || d() ? b() : e());
          };
        a.forEach(a => {
          void 0 === h[a] && (h[a] = null, l.loadFile(rea.extension.getURL(`${a}.js`), () => {
            f(a);
          }), g++);
        });
        f();
      },
      h = {},
      d = {},
      f = {},
      l = {
        init() {},
        verify(a) {
          let c = [],
            b;
          for (b in d) {
            d.hasOwnProperty(b) && (d[b].length > 3 && d[b].substr(0, 3) === '###' ? console.debug(`self.verify: development version detected @ ${
              b}`) : d[b] !== a && (console.warn(`self.verify: expected version ${a} and detected ${d[b]} @ ${b}`), c.push({
              name: b,
              version: d[b],
              expected: a,
            })));
          }
          return c;
        },
        register(a, c, b, g) {
          if (!h[a] || g) { for (d[a] = c, h[a] = b, a = k, k = []; a.length;) a.pop()(); }
        },
        registerRaw(a, c, b, g) {
          if (!f[a] || g) d[a] = c, f[a] = b;
        },
        vendor(a, c) {
          return e(a, !0, c);
        },
        require(a, c) {
          return e(a, !1, c);
        },
        getRaw(a) {
          let c = null;
          if (void 0 !== f[a]) c = f[a];
          else {
            const b = rea.extension.getURL(a);
            try {
              const d = new XMLHttpRequest();
              d.open('GET', b, !1);
              d.send(null);
              (c = d.responseText) || console.log(`WARN: content of ${a} is null!`);
            } catch (e) {
              console.log(`getRawContent ${e}`);
            }
          }
          return c;
        },
        loadFile(a, c) {
          try {
            const b = document.createElement('script');
            b.setAttribute('src', a);
            b.onload = function () {
              c && c(a);
            };
            (document.head || document.body || document.documentElement || document).appendChild(b);
          } catch (d) {
            console.log(`Error: self.load ${a} failed! ${d.message}`);
          }
        },
        isDevVersion(a) {
          return d[a] && d[a].substr(0, 3) === '###';
        },
        get(a) {
          let c,
            b = h[a];
          typeof b ===
                        'function' ? (c = Array.prototype.slice.call(arguments, 1), c = b.apply(this, c)) : b && (c = b);
          return c;
        },
      };
    return l;
  }());
  window.setTimeout(e.init, 1);
  m.Registry = e;
}(typeof rea !== 'undefined' ? rea.globals : window));

// promise.js
(function (k) {
  var c = function (a) {
    let b = (function () {
        let b,
          a,
          d = [];
        d.notify = function (b) {
          d.forEach(a => {
            a(b);
          });
        };
        const e = [];
        e._push = e.push;
        e.push = function () {
          e._push(...arguments);
          e.check();
        };
        e.check = function () {
          if (void 0 !== b) {
            for (var f; e.length;) { if (f = e.shift(), void 0 === f.state || f.state === b) a = (typeof f.f === 'function' ? f.f.call(g, a) : f.f) || a; }
          }
        };
        var g = {
          promise() {
            return g;
          },
          done(b) {
            e.push({
              state: !0,
              f: b,
            });
            return g;
          },
          fail(b) {
            e.push({
              state: !1,
              f: b,
            });
            return g;
          },
          always(b) {
            e.push({
              f: b,
            });
            return g;
          },
          progress(b) {
            d.push(b);
            return g;
          },
          then(b, d, e) {
            return c(c => {
              [{
                fn: 'done',
                forward: 'resolve',
                f: b,
              }, {
                fn: 'fail',
                forward: 'reject',
                f: d,
              }, {
                fn: 'progress',
                forward: 'notify',
                f: e,
              }].forEach(b => {
                g[b.fn](function () {
                  let d = typeof b.f === 'function',
                    f = d ? b.f(a) : void 0;
                  f && typeof f.promise === 'function' ? f.promise().done(c.resolve).fail(c.reject).progress(c.notify) : c[b.forward](...d ? [f] : arguments);
                });
              });
            }).promise();
          },
          each(b) {
            return g.then(function (a) {
              a instanceof Array || (a =
                                arguments);
              return c.when(a.map(a => b(a)));
            });
          },
          iterate(b) {
            return g.then(function (a) {
              a instanceof Array || (a = arguments);
              var d = 0,
                e = c(),
                h = function () {
                  if (d < a.length) {
                    let c = a[d++];
                    (c = b(c)) && c.promise ? c.promise().done(h).fail(e.reject) : h();
                  } else e.resolve(a);
                };
              h();
              return e.promise();
            });
          },
        };
        return {
          get() {
            return g;
          },
          try_resolve(c) {
            void 0 === b && (b = !0, a = c);
            e.check();
          },
          try_reject(c) {
            void 0 === b && (b = !1, a = c);
            e.check();
          },
          do_notify(b) {
            d.notify(b);
          },
        };
      }()),
      d = {
        promise() {
          return b.get();
        },
        resolve() {
          return b.try_resolve.apply(this, arguments);
        },
        reject() {
          return b.try_reject.apply(this, arguments);
        },
        notify() {
          return b.do_notify.apply(this, arguments);
        },
      };
    a && a(d);
    return d;
  };
  c.Pledge = function (a) {
    const b = c();
    b.resolve(a);
    return b.promise();
  };
  c.Breach = function (a) {
    const b = c();
    b.reject(a);
    return b.promise();
  };
  c.onebyone = function (a) {
    let b = [];
    return a.reduce((a, c) => a.then(c).done(a => {
      b = b.concat(a instanceof Array ? a : [a]);
    }), c.Pledge()).then(() => b);
  };
  c.sidebyside = function (a) {
    a instanceof Array || (a = arguments);
    let b = c(),
      d = a.length;
    d ? a.forEach(a => {
      a && a.promise && a.promise().always(() => {
        --d === 0 && b.resolve();
      });
    }) : b.resolve();
    return b.promise();
  };
  c.when = function (a) {
    a instanceof Array || (a = arguments);
    let b = c(),
      d = a.length,
      h = [];
    d ? a.forEach(a => {
      a && a.promise && a.promise().fail(() => {
        b.reject(h);
        d = -1;
      }).done(a => {
        h.push(a);
        --d === 0 && b.resolve(h);
      });
    }) : b.resolve(h);
    return b.promise();
  };
  k.Registry ? k.Registry.register(
    'promise', '58',
    () => c,
  ) : typeof require !== 'undefined' ? module.exports.Deferred = c : k.Deferred = c;
}(typeof window !== 'undefined' ? window : GLOBAL));

// storage.js
(function () {
  Registry.require(['promise'], () => {
    var g = rea.FEATURES,
      e = Registry.get('promise'),
      t = !0,
      h = !1,
      w = [],
      m = !0,
      v = (function () {
        let a = [g.CONSTANTS.STORAGE.VERSION, g.CONSTANTS.STORAGE.TYPE],
          b = {};
        a.forEach(a => {
          b[a] = !0;
        });
        return {
          keys: a,
          has(a) {
            return !!b[a];
          },
        };
      }()),
      n = g.HTML5.LOCALSTORAGE,
      C = function () {
        return rea.other.openDatabase('tmStorage', '1.0', 'TM Storage', 31457280);
      },
      D = function (a) {
        return a;
      },
      x = function (a, b) {
        if (!a) return b;
        const c = a[0];
        a = a.substring(1);
        switch (c) {
        case 'b':
          return a == 'true';
        case 'n':
          return Number(a);
        case 'o':
          try {
            return JSON.parse(a);
          } catch (e) {
            console.error(`Storage: getValue ERROR: ${e.message}`);
          }
          return b;
        default:
          return a;
        }
      },
      y = function (a) {
        const b = (typeof a)[0];
        switch (b) {
        case 'o':
          try {
            a = b + JSON.stringify(a);
          } catch (c) {
            console.error(`Storage: setValue ERROR: ${c.message}`);
            return;
          }
          break;
        default:
          a = b + a;
        }
        return a;
      },
      r = function (a, b) {
        let c = e(),
          d = Array.prototype.slice.call(arguments, 2),
          f;
        typeof a === 'string' ? a == g.DB.USE && b == 'clean' ? console.warn("Storage: can't clean currently active storage") :
          f = l.implementations[a][b] : f = a[b];
        if (f) {
          if (d = f.apply(this, d), typeof d === 'object' && d.then) {
            d.then(function () {
              c.resolve.apply(this, arguments);
            }, a => {
              c.reject();
            });
          } else return d;
        } else c.resolve();
        return c.promise();
      },
      z = function (a, b) {
        let c = e(),
          d = [];
        Object.getOwnPropertyNames(b).forEach(c => {
          void 0 !== b[c] && d.push(r(a, 'setValue', c, b[c]));
        });
        e.when(d).done(() => {
          c.resolve();
        });
        return c.promise();
      },
      A = function (a, b) {
        const c = {};
        b.forEach(b => {
          c[b] = r(a, 'getValue', b);
        });
        return c;
      },
      l = {
        implementations: {
          localStorage: (function () {
            var a = {
              setValue(a, c) {
                const d = e();
                h && console.log(`localStorage: setValue -> ${a}`);
                const f = y(c);
                m && n.setItem(a, f);
                d.resolve();
                return d.promise();
              },
              getValue(a, c) {
                h && console.log(`Storage: getValue -> ${a}`);
                return x(n.getItem(a, c), c);
              },
              deleteAll() {
                const b = e();
                h && console.log('localStorage: deleteAll()');
                m && a.listValues().forEach(a => {
                  v.has(a) || n.removeItem(a);
                });
                b.resolve();
                return b.promise();
              },
              deleteValue(a) {
                const c = e();
                h && console.log(`localStorage: deleteValue -> ${a}`);
                m && n.removeItem(a);
                c.resolve();
                return c.promise();
              },
              listValues() {
                h && console.log('localStorage: listValues');
                for (var a = [], c = 0; c < n.length; c++) a.push(D(n.key(c)));
                return a;
              },
            };
            return {
              options: {},
              methods: a,
            };
          }()),
          sql: (function () {
            var a = null,
              b = null,
              c = function () {
                const a = e();
                b.db.transaction(c => {
                  c.executeSql('CREATE TABLE IF NOT EXISTS config(ID INTEGER PRIMARY KEY ASC, name TEXT, value TEXT)', [], a.resolve, b.onError);
                });
                return a.promise();
              },
              d = function () {
                const a = e();
                b = {
                  db: C(),
                  onSuccess(a, b) {
                    h && console.log('webSQL: localDB Success ');
                  },
                  onError(a, b) {
                    console.error('webSQL: localDB Error ', b);
                  },
                };
                b.db ? c().done(a.resolve) : (b = null, a.reject());
                return a.promise();
              },
              f = {
                setValue(c, p) {
                  const q = e();
                  h && console.log(`Storage: setValue -> ${c}`);
                  const d = y(p);
                  m && (a[c] ? b.db.transaction(a => {
                    a.executeSql('UPDATE config SET value=? WHERE name=?', [d, c], () => {
                      rea.runtime.lastError && console.warn(rea.runtime.lastError);
                      q.resolve();
                    }, b.onError);
                  }) : b.db.transaction(a => {
                    a.executeSql('INSERT INTO config(name, value) VALUES (?,?)', [c, d], () => {
                      rea.runtime.lastError && console.warn(rea.runtime.lastError);
                      q.resolve();
                    }, b.onError);
                  }));
                  a[c] = d;
                  m || q.resolve();
                  return q.promise();
                },
                getValue(b, c) {
                  h && console.log(`webSQL: getValue -> ${b}`);
                  return x(a[b], c);
                },
                deleteAll() {
                  const d = e();
                  h && console.log('webSQL: deleteAll()');
                  const p = A(f, v.keys);
                  a = p;
                  m ? b.db.transaction(a => {
                    a.executeSql('DROP TABLE config', [], () => {
                      c().done(() => {
                        z(f, p).done(d.resolve);
                      });
                    }, b.onError);
                  }) : d.resolve();
                  return d.promise();
                },
                deleteValue(c) {
                  const p =
                                        e();
                  h && console.log(`webSQL: deleteValue -> ${c}`);
                  delete a[c];
                  m ? b.db.transaction(a => {
                    a.executeSql('DELETE FROM config WHERE name=?', [c], p.resolve, b.onError);
                  }) : p.resolve();
                  return p.promise();
                },
                listValues() {
                  h && console.log('webSQL: listValues');
                  const b = [];
                  Object.getOwnPropertyNames(a).forEach(a => {
                    b.push(a);
                  });
                  return b;
                },
                isWorking() {
                  return e.Pledge();
                },
              };
            return {
              init() {
                let c = e(),
                  p = function (b, k) {
                    a = {};
                    if (k) { for (let s = 0; s < k.rows.length; s++) a[k.rows.item(s).name] = k.rows.item(s).value; }
                    c.resolve();
                  },
                  q = function () {
                    a ? c.resolve() : b.db.transaction(a => {
                      a.executeSql('SELECT * FROM config', [], p, b.onError);
                    });
                  };
                b ? q() : d().done(q).fail(c.reject);
                return c.promise();
              },
              clean() {
                a = null;
                return e.Pledge();
              },
              options: {},
              methods: f,
            };
          }()),
          chromeStorage: (function () {
            var a = null,
              b = !1,
              c = !1,
              d = rea.extension.inIncognitoContext ? 'incognito' : 'normal',
              f = function (b, e) {
                if (m && c && e == 'local') {
                  for (const f in b) {
                    const k = b[f];
                    h && console.log('si: local storage key', f, '@', e, 'changed:', k);
                    k.newValue ? k.newValue.origin !==
                                            d && (a[f] = k.newValue.value, l.notifyDifferentOriginChangeListeners(f, k.newValue)) : delete a[f];
                  }
                }
              },
              g = {
                setValue(b, c) {
                  const f = e();
                  h && console.log('chromeStorage: setValue -> ', b, c);
                  a[b] = c;
                  if (m) {
                    const k = {};
                    k[b] = {
                      origin: d,
                      value: c,
                    };
                    rea.storage.local.set(k, f.resolve);
                  } else f.resolve();
                  return f.promise();
                },
                getValue(b, c) {
                  const e = void 0 === a[b] ? c : a[b];
                  h && console.log('chromeStorage: getValue -> ', b, e);
                  return e;
                },
                deleteAll() {
                  const b = e();
                  h && console.log('chromeStorage: deleteAll()');
                  const c = A(g, v.keys);
                  a = c;
                  m ? rea.storage.local.clear(() => {
                    z(g, c).done(b.resolve);
                  }) : b.resolve();
                  return b.promise();
                },
                deleteValue(b) {
                  const c = e();
                  h && console.log(`chromeStorage: deleteValue -> ${b}`);
                  delete a[b];
                  m ? rea.storage.local.remove(b, c.resolve) : c.resolve();
                  return c.promise();
                },
                listValues() {
                  h && console.log('chromeStorage: listValues');
                  const b = [];
                  Object.getOwnPropertyNames(a).forEach(a => {
                    b.push(a);
                  });
                  return b;
                },
                setTemporary(a) {
                  m = !a;
                  c = !0;
                },
                isSupported() {
                  return e.Pledge();
                },
                isWorking() {
                  let a =
                                        e(),
                    b = 0,
                    c = (new Date()).getTime(),
                    k = {};
                  k.foo = c;
                  var s = function (c) {
                      ++b <= 5 ? (console.warn('storage:', c || 'storage set/get test failed!'), window.setTimeout(d, b * b * 100)) : (console.warn('storage: storage set/get test finally failed!'), u && (window.clearTimeout(u), u = null, a.reject()));
                    },
                    u = window.setTimeout(() => {
                      u = null;
                    }, 18E4),
                    d = function () {
                      t && console.log('Storage: test -> start');
                      const b = (new Date()).getTime();
                      rea.storage.local.set(k, () => {
                        t && console.log(`Storage: test -> set after ${(new Date()).getTime() - b
                        }ms`);
                        rea.storage.local.get('foo', k => {
                          t && console.log(`Storage: test -> get after ${(new Date()).getTime() - b}ms`);
                          if (k) {
                            if (k.foo !== c) return s(`read value is different ${JSON.stringify(k.foo)} != ${JSON.stringify(c)}`);
                            if (rea.runtime.lastError) return s(rea.runtime.lastError && rea.runtime.lastError.message || 'lastError is set');
                          } else return s(`read value is${k}`);
                          rea.storage.local.remove('foo', () => {
                            t && console.log(`Storage: test -> remove after ${(new Date()).getTime() - b}ms`);
                            u && (window.clearTimeout(u),
                              u = null, a.resolve());
                          });
                        });
                      });
                    };
                  d();
                  return a.promise();
                },
              };
            return {
              init() {
                const c = e();
                a ? c.resolve() : rea.storage.local.get(null, e => {
                  a = {};
                  for (const d in e) {
                    const k = e[d];
                    a[d] = k && k.hasOwnProperty('origin') && k.hasOwnProperty('value') ? k.value : k;
                  }
                  b || (rea.storage.onChanged.addListener(f), b = !0);
                  c.resolve();
                });
                return c.promise();
              },
              clean() {
                const b = e();
                a = null;
                b.resolve();
                return b.promise();
              },
              options: {},
              methods: g,
            };
          }()),
          file: (function () {
            var a = null,
              b = null,
              c = function () {
                let a = e(),
                  c = function (b) {
                    console.warn(
                      'fileStorage: listFiles() error:',
                      b,
                    );
                    a.reject();
                  };
                b.root.getDirectory('data', {
                  create: !0,
                }, b => {
                  var e = b.createReader(),
                    d = [],
                    f = function () {
                      e.readEntries(b => {
                        b.length ? (d = d.concat(b), f()) : a.resolve(d);
                      }, c);
                    };
                  f();
                }, c);
                return a.promise();
              },
              d = function (a, c) {
                let d = e(),
                  f = function (b) {
                    console.warn('fileStorage: writeFileData(', a, ') error:', b);
                    d.reject();
                  };
                b.root.getDirectory('data', {
                  create: !0,
                }, b => {
                  b.getFile(a, {
                    create: !0,
                  }, a => {
                    a.createWriter(a => {
                      a.onwriteend = function (b) {
                        a.onwriteend = function (a) {
                          d.resolve();
                        };
                        a.onerror =
                                                    f;
                        b = new Blob([c], {
                          type: 'text/plain',
                        });
                        a.write(b);
                      };
                      a.truncate(0);
                    }, f);
                  }, f);
                }, f);
                return d.promise();
              },
              f = function (a) {
                let c = e(),
                  d = function (b) {
                    console.warn('fileStorage: getFileData(', a, ') error:', b);
                    c.reject();
                  },
                  f = function (a) {
                    const b = new FileReader();
                    b.onloadend = function () {
                      c.resolve(this.result);
                    };
                    b.onerror = d;
                    b.onabort = d;
                    b.readAsText(a);
                  };
                b.root.getDirectory('data', {
                  create: !0,
                }, b => {
                  b.getFile(a, {}, a => {
                    a.file(a => {
                      f(a);
                    }, d);
                  }, d);
                }, d);
                return c.promise();
              },
              g = function (a) {
                let c = e(),
                  d = function (b) {
                    console.warn(
                      'fileStorage: deleteFile(',
                      a, ') error:', b,
                    );
                    c.reject();
                  };
                b.root.getDirectory('data', {
                  create: !0,
                }, b => {
                  b.getFile(a, {
                    create: !1,
                  }, a => {
                    a.remove(c.resolve, d);
                  }, d);
                }, d);
                return c.promise();
              },
              l = function () {
                let a = e(),
                  c = function (b) {
                    console.warn('fileStorage: removeDir() error:', b);
                    a.reject();
                  };
                b.root.getDirectory('data', {
                  create: !0,
                }, b => {
                  b.removeRecursively(a.resolve, c);
                }, c);
                return a.promise();
              },
              q = function () {
                const b = e();
                a = {};
                const d = [];
                c().done(c => {
                  c.forEach(b => {
                    typeof b !== 'string' && (b = b.name);
                    d.push(f(b).always(c => {
                      a[b] =
                                                c;
                    }));
                  });
                  e.when(d).always(() => {
                    b.resolve();
                  });
                }).fail(b.resolve);
                return b.promise();
              },
              B = {
                isSupported() {
                  const a = e();
                  window.File && window.FileReader && window.FileList && window.Blob ? a.resolve() : a.reject();
                  return a.promise();
                },
                isWorking() {
                  return e.Pledge();
                },
                setValue(b, c) {
                  const f = e();
                  h && console.log(`fileStorage: setValue -> ${b}`);
                  const g = y(c);
                  a[b] = g;
                  m ? d(b, g).always(f.resolve) : f.resolve();
                  return f.promise();
                },
                getValue(b, c) {
                  h && console.log(`fileStorage: getValue -> ${b}`);
                  return x(
                    a[b],
                    c,
                  );
                },
                deleteAll() {
                  const b = e();
                  h && console.log('fileStorage: deleteAll()');
                  const c = A(B, v.keys);
                  a = c;
                  m ? l().always(() => {
                    z(B, c).always(b.resolve);
                  }) : b.resolve();
                  return b.promise();
                },
                deleteValue(b) {
                  const c = e();
                  h && console.log(`fileStorage: deleteValue -> ${b}`);
                  delete a[b];
                  m ? g(b).always(c.resolve) : c.resolve();
                  return c.promise();
                },
                listValues() {
                  h && console.log('fileStorage: listValues');
                  const b = [];
                  Object.getOwnPropertyNames(a).forEach(a => {
                    b.push(a);
                  });
                  return b;
                },
              };
            return {
              init() {
                const c =
                                    e();
                a ? c.resolve() : rea.other.requestFileSystem(window.PERSISTENT, 31457280, a => {
                  b = a;
                  q().done(c.resolve);
                }, a => {
                  a && console.warn('fileStorage: ', a);
                  c.reject();
                });
                return c.promise();
              },
              clean() {
                a = null;
                return e.Pledge();
              },
              options: {},
              methods: B,
            };
          }()),
        },
        migrate(a, b, c) {
          let d = e(),
            f = l.implementations[a],
            g = l.implementations[b];
          c = c || {};
          f && g ? (h && console.log('Migration: from', a, 'to', b), r(a, 'init').then(() => r(b, 'init')).then(() => {
            let a = e(),
              b = [];
            f.methods.listValues().forEach(a => {
              const d =
                                f.methods.getValue(a);
              c.drop && b.push(f.methods.deleteValue(a));
              h && console.log(`Migration: copy value of ${a}`);
              b.push(g.methods.setValue(a, d));
            });
            e.when(b).done(() => {
              a.resolve();
            });
            return a.promise();
          }).then(() => r(b, 'clean'))
          .then(() => r(a, 'clean'))
          .done(() => {
            d.resolve();
          })
          .fail(() => {
            d.reject();
          })) : (console.error('Migration: unknown storage implementation(s) ', a, b), d.reject());
          return d.promise();
        },
        isSupported() {
          return e.Pledge();
        },
        isWorking() {
          return e.Pledge();
        },
        setTemporary(a) {
          m = !a;
        },
        init() {
          t && console.log(`Storage: use ${g.DB.USE}`);
          Object.getOwnPropertyNames(l.implementations[g.DB.USE].methods).forEach(a => {
            l.__defineGetter__(a, () => l.implementations[g.DB.USE].methods[a]);
          });
          return l.implementations[g.DB.USE].init ? l.implementations[g.DB.USE].init() : e.Pledge();
        },
        getValues(a, b) {
          const c = {};
          b || (b = {});
          Object.getOwnPropertyNames(a).forEach(a => {
            c[a] = l.implementations[g.DB.USE].getValue(a, b[a]);
          });
          return c;
        },
        factoryReset() {
          n.removeItem(g.CONSTANTS.STORAGE.LEGACY_VERSION);
          return l.deleteAll();
        },
        isWiped() {
          if (g.DB.USE === 'localStorage') return e.Pledge(!1);
          let a = e(),
            b = l.getValue(g.CONSTANTS.STORAGE.VERSION),
            c = !1;
          n.getItem(g.CONSTANTS.STORAGE.LEGACY_VERSION) && !b && (l.listValues().length ? console.warn('storage: unable to find version information') : c = !0);
          a.resolve(c);
          return a.promise();
        },
        setVersion(a, b) {
          const c = e();
          m ? (n.setItem(g.CONSTANTS.STORAGE.LEGACY_VERSION, a), l.setValue(g.CONSTANTS.STORAGE.VERSION, a).then(() => (b ? l.setValue(
            g.CONSTANTS.STORAGE.SCHEMA,
            b,
          ) : e.Pledge())).always(c.resolve)) : c.resolve();
          return c.promise();
        },
        getVersion(a) {
          let b = e(),
            c = l.getValue(g.CONSTANTS.STORAGE.VERSION) || l.getValue(g.CONSTANTS.STORAGE.LEGACY_VERSION) || n.getItem(g.CONSTANTS.STORAGE.LEGACY_VERSION);
          c ? b.resolve(c) : r('sql', 'init').then(b => {
            c = l.implementations.sql.methods.getValue(g.CONSTANTS.STORAGE.LEGACY_VERSION) || a;
            return r('sql', 'clean');
          }).always(() => {
            b.resolve(c || a);
          });
          return b.promise();
        },
        getSchemaVersion() {
          return l.getValue(
            g.CONSTANTS.STORAGE.SCHEMA,
            '3.5',
          );
        },
        debug(a, b) {
          h |= b;
          t |= a;
        },
        addDifferentOriginChangeListener(a, b) {
          w.push({
            search: a,
            cb: b,
          });
        },
        notifyDifferentOriginChangeListeners(a, b) {
          for (const c in w) {
            const d = w[c];
            a.search(d.search) == 0 && d.cb(a, b);
          }
        },
        recover(a, b) {
          typeof a === 'string' && (a = {
            method: a,
            storages: ['sql', 'chromeStorage'],
          });
          const c = {};
          a.storages.forEach(a => {
            c[a] = !0;
          });
          if (a.method == 'log') {
            var d = null,
              f,
              e,
              g = [{
                method: 'sql',
                fn(a) {
                  console.debug('check sql storage for data...');
                  try {
                    e = C();
                    if (rea.runtime.lastError ||
                                            !e) return d = rea.runtime.lastError, a();
                    e.transaction(b => {
                      b.executeSql('CREATE TABLE IF NOT EXISTS config(ID INTEGER PRIMARY KEY ASC, name TEXT, value TEXT)', [], () => {
                        console.debug('sql table found/created');
                        a();
                      }, (b, c) => {
                        d = c;
                        a();
                      });
                    });
                  } catch (b) {
                    d = b, window.setTimeout(a, 1);
                  }
                },
              }, {
                method: 'sql',
                fn(a) {
                  const b = {};
                  e.transaction(c => {
                    c.executeSql('SELECT * FROM config', [], (c, d) => {
                      if (d) { for (let e = 0; e < d.rows.length; e++) b[d.rows.item(e).name] = d.rows.item(e).value; }
                      f = b;
                      window.setTimeout(
                        a,
                        1,
                      );
                    }, (b, c) => {
                      d = c;
                      a();
                    });
                  });
                },
              }, {
                method: 'sql',
                fn(a) {
                  const b = f ? Object.getOwnPropertyNames(f) : [];
                  f && b.length ? (console.debug('found values:'), b.forEach(a => {
                    console.debug('    ', a, f[a] && f[a].length > 30 ? f[a].substr(0, 30) : f[a]);
                  })) : (console.warn('no data found'), c.sql = !1);
                  window.setTimeout(a, 1);
                },
              }, {
                method: 'chromeStorage',
                fn(a) {
                  console.debug('check chromeStorage for data...');
                  rea.storage.local.get(null, b => {
                    f = b;
                    a();
                  });
                },
              }, {
                method: 'chromeStorage',
                fn(a) {
                  const b = f ? Object.getOwnPropertyNames(f) :
                    [];
                  f && b.length ? (console.debug('found values:'), b.forEach(a => {
                    console.debug('    ', a, f[a] && f[a].length > 30 ? f[a].substr(0, 30) : f[a]);
                  })) : (console.warn('no data found'), c.chromeStorage = !1, window.setTimeout(a, 1));
                },
              }],
              h = 0,
              l = function () {
                if (d) console.warn('error:', d);
                else {
                  for (; g[h];) {
                    if (c[g[h].method]) {
                      g[h].fn(l);
                      h++;
                      return;
                    }
                    h++;
                  }
                }
                b && b();
              };
            l();
          }
        },
      };
    Registry.register('storage', '58', () => l);
  });
}());

export function getRea() {
  return window.rea;
}

export function getRegistry() {
  return window.Registry;
}
