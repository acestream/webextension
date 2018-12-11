// test news backend

const test = require('tape');
const request = require('request');

function getApiUrl(vendor, locale, appVersion, engineVersion, devMode) {
  let url = `http://awe-api.acestream.me/news/get?vendor=${vendor}&force_locale=1&locale=${locale}&appVersion=${appVersion}&engineVersion=${engineVersion}&_=${Math.random()}`;
  if (devMode) {
    url += `&dev_mode=${devMode}`;
  }
  return url;
}

function getNews(vendor, locale, appVersion, engineVersion, devMode) {
  return new Promise((resolve, reject) => {
    const url = getApiUrl(vendor, locale, appVersion, engineVersion, devMode);
    request(url, { json: true }, (err, res, body) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(body);
    });
  });
}

function validateResponse({ response, expectedCount, expectedBtnTitle }) {
  if (typeof response !== 'object') {
    throw new Error('response is not an object');
  }

  const realCount = Object.keys(response).length;
  if (realCount !== expectedCount) {
    throw new Error(`bad count: expected=${expectedCount} real=${realCount}`);
  }

  Object.keys(response).forEach(id => {
    const item = response[id];
    if (item.excludeBasedOnOther !== true) {
      throw new Error(`missing excludeBasedOnOther: id=${id}`);
    }
    if (item.btnTitle !== expectedBtnTitle) {
      throw new Error(`bad btn title: id=${id} expected=${expectedBtnTitle} real=${item.btnTitle}`);
    }
  });
}

test('test en old', t => {
  getNews('firefox', 'en', '1.1.0', 0)
  .then(response => {
    try {
      validateResponse({
        response,
        expectedCount: 78,
        expectedBtnTitle: 'Install',
      });
      t.pass('response ok');
    } catch (e) {
      t.fail(e);
    }
  })
  .catch(err => {
    t.fail(err);
  });
  t.end();
});

test('test en new', t => {
  getNews('firefox', 'en', '1.1.0', 3011602)
  .then(response => {
    try {
      validateResponse({
        response,
        expectedCount: 83,
        expectedBtnTitle: 'Install',
      });
      t.pass('response ok');
    } catch (e) {
      t.fail(e);
    }
  })
  .catch(err => {
    t.fail(err);
  });
  t.end();
});

test('test ru old', t => {
  getNews('firefox', 'ru', '1.1.0', 0)
  .then(response => {
    try {
      validateResponse({
        response,
        expectedCount: 78,
        expectedBtnTitle: 'Установить',
      });
      t.pass('response ok');
    } catch (e) {
      t.fail(e);
    }
  })
  .catch(err => {
    t.fail(err);
  });
  t.end();
});

test('test ru new', t => {
  getNews('firefox', 'ru', '1.1.0', 3011602)
  .then(response => {
    try {
      validateResponse({
        response,
        expectedCount: 83,
        expectedBtnTitle: 'Установить',
      });
      t.pass('response ok');
    } catch (e) {
      t.fail(e);
    }
  })
  .catch(err => {
    t.fail(err);
  });
  t.end();
});

test('test malformed data', t => {
  getNews('firefox', 'en', '1.1.0', 0, 'malformed_data')
  .then(response => {
    t.ok(typeof response === 'string');
  })
  .catch(err => {
    t.fail(err);
  });
  t.end();
});
