export function getPrivacyOptions() {
  return new Promise(resolve => {
    browser.storage.local
    .get(['privacyOptInConfirmed', 'privacyOptInAccepted'])
    .then(response => {
      resolve({
        confirmed: response.privacyOptInConfirmed,
        accepted: response.privacyOptInAccepted,
      });
    });
  });
}

export function setPrivacyOptions(accepted) {
  browser.storage.local.set({
    privacyOptInConfirmed: true,
    privacyOptInAccepted: accepted,
  });
}
