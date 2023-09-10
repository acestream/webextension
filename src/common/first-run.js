export async function isFirstRun() {
  const result = await browser.storage.local.get('firstRunAt');
  return !result?.firstRunAt;
}

export async function setFirstRun() {
  await browser.storage.local.set({
    firstRunAt: Date.now(),
  });
}

export function openWelcomePage() {
  browser.tabs.create({ url: 'https://awe.acestream.me/welcome' });
}
