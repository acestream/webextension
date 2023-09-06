const isFirefox = /firefox\//i.test(navigator.userAgent);
const isChrome = /chrome\//i.test(navigator.userAgent);
// const isAndroid = /android /i.test(navigator.userAgent);

export function getVendor() {
  if (isFirefox) {
    return 'firefox';
  } else if (isChrome) {
    return 'chrome';
  } else {
    return 'unknown';
  }
}