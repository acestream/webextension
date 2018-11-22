const { userAgent } = navigator;

export const isFirefox = /firefox\//i.test(userAgent);
export const isChrome = /chrome\//i.test(userAgent);
export const isAndroid = /android /i.test(userAgent);

export function getVendor() {
  if (isFirefox) {
    return 'firefox';
  }
  if (isChrome) {
    return 'chrome';
  }
  return 'unknown';
}
