import bridge, { addBackgroundHandlers, addHandlers } from './bridge';
import { sendCmd } from './util';

const IS_TOP = window.top === window;

addHandlers({
  async GetEngineStatus() {
    return sendCmd('GetEngineStatus');
  },
  async GetAvailablePlayers(params) {
    return sendCmd('GetAvailablePlayers', params);
  },
  async OpenInPlayer(params, playerId) {
    return sendCmd('OpenInPlayer', params, playerId);
  },
  async GetDeviceId() {
    return sendCmd('GetDeviceId');
  },
  async GetLocale() {
    return sendCmd('GetLocale');
  },
  async GetConfig(name) {
    return sendCmd('GetConfig', name);
  },
  async RegisterContextMenuCommand() {
    return sendCmd('RegisterContextMenuCommand');
  },
});

if(IS_TOP) {
  addBackgroundHandlers({
    WatchOnlineMenuClicked(data) {
      bridge.post('WatchOnlineMenuClicked', data);
    },
  });
}
