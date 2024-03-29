import { i18n, defaultImage, sendTabCmd, trueJoin } from '@/common';
import { addPublicCommands } from './message';

const openers = {};

addPublicCommands({
  /** @return {Promise<string>} */
  async Notification({ image, text, title }, src, bgCallback) {
    const notificationId = await browser.notifications.create({
      type: 'basic',
      title: [title, IS_FIREFOX && i18n('extName')]::trueJoin(' - '), // Chrome already shows the name
      message: text,
      iconUrl: image || defaultImage,
    });
    const op = bgCallback || src && [src.tab.id, src.frameId];
    if (op) openers[notificationId] = op;
    return notificationId;
  },
  RemoveNotification(notificationId) {
    return browser.notifications.clear(notificationId);
  },
});

browser.notifications.onClicked.addListener((id) => {
  notifyOpener(id, true);
});

browser.notifications.onClosed.addListener((id) => {
  notifyOpener(id, false);
  delete openers[id];
});

if(!IS_FIREFOX) {
  browser.notifications.onButtonClicked.addListener((id, buttonIndex) => {
    notifyOpener(id, true, buttonIndex);
  });
}

function notifyOpener(id, isClick, buttonIndex) {
  const op = openers[id];
  if (isFunction(op)) {
    op(isClick, buttonIndex);
  } else if (op) {
    sendTabCmd(op[0], isClick ? 'NotificationClick' : 'NotificationClose', id, {
      frameId: op[1],
    });
  }
}

export function addOpener(id, callback) {
  openers[id] = callback;
}
