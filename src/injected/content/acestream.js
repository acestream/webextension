import bridge, { addBackgroundHandlers, addHandlers } from './bridge';
import { sendCmd } from './util';

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
});
