export async function isFirstRun() {
  const result = await browser.storage.local.get('firstRunAt');

  if(!result?.firstRunAt) {
    const news = await browser.storage.local.get('news');
    if (news && news.news) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

export async function setFirstRun() {
  await browser.storage.local.set({
    firstRunAt: Date.now(),
  });
}

export function openWelcomePage() {
  browser.tabs.create({ url: 'https://awe.acestream.me/welcome' });
}
