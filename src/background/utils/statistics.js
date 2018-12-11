import { request, noop } from '#/common';

export function asImpression(counterId) {
  const url = `https://mstat.acestream.net/imp?a=${counterId}&b=${Math.random()}`;
  request(url).catch(noop);
}

function yandexMetrikaImpression(counterId) {
  const referer = encodeURIComponent(window.location.href);
  const url = `https://mc.yandex.ru/watch/${counterId}?page-url=${referer}`;
  request(url).catch(noop);
}

function gaEvent(category, value) {
  const GA_TRACKING_ID = 'UA-130709907-2';
  const GA_CLIENT_ID = 'UA-130709907';
  const xhr = new XMLHttpRequest();
  const message = `v=1&tid=${GA_TRACKING_ID}&cid= ${GA_CLIENT_ID}&aip=1`
    + `&ds=add-on&t=event&ec=${category}&ea=${value}`;

  xhr.open('POST', 'https://www.google-analytics.com/collect', true);
  xhr.send(message);
}

function updateStats() {
  gaEvent('app', 'alive');
  yandexMetrikaImpression(51515630);
  asImpression('ace-script');
}

export function init() {
  // Update stats now and then every 24 hours
  updateStats();
  setInterval(updateStats, 86400000);
}
