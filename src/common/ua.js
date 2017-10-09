const { userAgent } = navigator;

export const isFirefox = /firefox\//i.test(userAgent);
export const isChrome = /chrome\//i.test(userAgent);

export function getVendor() {
    if (isFirefox) {
        return 'firefox';
    } else if (isChrome) {
        return 'chrome';
    } else {
        return 'unknown';
    }
}
