import { addHandlers } from './bridge';

const contextMenuHandlers = [];

addHandlers({
  WatchOnlineMenuClicked(data) {
    notifyMenuClicked(data.url);
  },
});

function notifyMenuClicked(url) {
  contextMenuHandlers.forEach(handler => {
    if (typeof handler === 'function') {
      handler(url);
    }
  });
}

export function addContextMenuHandler(func) {
  contextMenuHandlers.push(func);
}
