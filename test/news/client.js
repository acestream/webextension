import test from 'tape';
import request from 'request';
import * as news from '#/background/utils/news';
import { delay, setRequestHandler, enableVerbose } from '#/common';

const URL_ACE_CAST = 'http://awe.acestream.me/scripts/acestream/Ace_Cast?install=auto';
const URL_P2P_SEARCH = 'http://awe.acestream.me/scripts/acestream/P2P_Search?install=auto';
const URL_MAGIC_PLAYER = 'http://awe.acestream.me/scripts/acestream/Magic_Player?install=auto';

enableVerbose(false);
news.setConfig({
  checkInterval: 0,
  notificationBaseInterval: 2000,
  notificationIntervalAdjust: 0,
  notificationMaxImpressions: 2,
  notificationMaxSkip: 2,
  notificationBaseSkipInterval: 3000,
  notificationSkipIntervalAdjust: 0,
  forceLocale: true,
});

setRequestHandler((url, options) => {
  // convert options
  const opts = {};
  if (options.responseType === 'json') {
    opts.json = true;
  }

  return new Promise((resolve, reject) => {
    request(url, opts, (error, response, data) => {
      let status;

      if (error) {
        status = -1;
      } else {
        status = response.statusCode;
      }

      if (status > 0 && status <= 300) {
        resolve({ url, data, status });
      } else {
        reject({ url, data, status });
      }
    });
  });
});

function check(t, siteUrl, scriptUrl) {
  const item = assertGotNews(t, siteUrl);
  t.equal(item.btnTitle, 'Install');
  t.equal(item.btnUrl, scriptUrl);
}

function assertGotNews(t, siteUrl, msg) {
  const res = news.getNewsForUrl(siteUrl);
  t.equal(res.length, 1, msg);
  return res[0];
}

function assertNoNews(t, siteUrl, msg) {
  const res = news.getNewsForUrl(siteUrl);
  t.equal(res.length, 0, msg);
}

test('init news', t => {
  news.initialize().then(() => {
    t.pass('news init done');
    t.end();
  });
});

test('check news for google', t => {
  check(t, 'https://www.google.com', URL_P2P_SEARCH);
  t.end();
});

test('check news for youtube', t => {
  check(t, 'https://www.youtube.com', URL_ACE_CAST);
  t.end();
});

test('check news for rutracker', t => {
  check(t, 'http://rutracker.org', URL_MAGIC_PLAYER);
  t.end();
});

test('check install button', t => {
  const siteUrl = 'https://www.google.com';
  const item = assertGotNews(t, siteUrl, 'got news for google before install');

  news.onInstallButtonClicked(item.id);
  assertNoNews(t, siteUrl, 'no news for google after install clicked');

  delay(1000)
  .then(() => {
    assertNoNews(t, siteUrl, 'no news for google after 1 second');
    return delay(2000);
  })
  .then(() => {
    assertGotNews(t, siteUrl, 'got news for google after 3 seconds');
    t.end();
  });
});

test('check impression', t => {
  let item;
  const siteUrl = 'https://www.google.com';

  item = assertGotNews(t, siteUrl);

  // first impression
  news.registerImpression(item.id);
  assertNoNews(t, siteUrl);

  delay(1000)
  .then(() => {
    assertNoNews(t, siteUrl);
    return delay(2000);
  })
  .then(() => {
    item = assertGotNews(t, siteUrl);
    // second impression
    news.registerImpression(item.id);
    assertNoNews(t, siteUrl);
    return delay(5000);
  })
  .then(() => {
    // no news because of max imressions
    assertNoNews(t, siteUrl);
    t.end();
  });
});

test('check installed p2p search', t => {
  news.reset();
  news.setInstalledScripts(['acestream/P2P Search']);
  assertNoNews(t, 'https://www.google.com', 'no new for google');
  assertGotNews(t, 'https://www.youtube.com', 'got news for youtube');
  assertGotNews(t, 'http://rutracker.org', 'got news for rutracker');
  t.end();
});

test('check installed ace cast', t => {
  news.reset();
  news.setInstalledScripts(['acestream/Ace Cast']);
  assertNoNews(t, 'https://www.youtube.com', 'no news for youtube');
  assertGotNews(t, 'https://www.google.com', 'got new for google');
  assertGotNews(t, 'http://rutracker.org', 'got news for rutracker');
  t.end();
});

test('check installed magic player', t => {
  news.reset();
  news.setInstalledScripts(['acestream/Magic Player']);
  assertNoNews(t, 'http://rutracker.org', 'no news for rutracker');
  assertGotNews(t, 'https://www.google.com', 'got new for google');
  assertGotNews(t, 'https://www.youtube.com', 'got news for youtube');
  t.end();
});

test('check uninstall', t => {
  news.reset();
  news.setInstalledScripts(['acestream/P2P Search']);
  assertNoNews(t, 'https://www.google.com', 'no news for google after install');
  news.setInstalledScripts([]);
  assertGotNews(t, 'https://www.google.com', 'got news for google after uninstall');
  t.end();
});

test('check old read flag', t => {
  news.reset();
  const item = assertGotNews(t, 'https://www.google.com', 'got news for google without read flag');
  news.setReadFlag(item.id);
  assertGotNews(t, 'https://www.google.com', 'got news for google with read flag');

  t.end();
});
