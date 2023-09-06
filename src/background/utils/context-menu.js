import { verbose } from '@/common';
import { addPublicCommands } from './message';

const store = {
  contextMenuCreated: false,
};

addPublicCommands({
  RegisterContextMenuCommand() {
    return createGlobalContextMenu();
  },
});

function onGlobalContextMenuClick(info, tab) {
  browser.tabs.sendMessage(tab.id, {
    cmd: 'WatchOnlineMenuClicked',
    data: {
      url: info.linkUrl,
    },
  });
}

function createGlobalContextMenu() {
  if (store.contextMenuCreated) {
    return Promise.resolve();
  }

  store.contextMenuCreated = true;
  verbose('bg:create context menu');

  return browser.contextMenus.create({
    id: 'awe-watch-online',
    title: 'Watch online',
    contexts: ['link'],
    onclick: onGlobalContextMenuClick,
  });
}
