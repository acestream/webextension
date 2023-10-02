import { getVendor } from '@/common/vendor'; // eslint-disable-line no-restricted-imports
import { getOption } from './options';

const EVENT_INSTALLED = 'app_installed';
const EVENT_ACTIVE = 'app_active';

const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID;
const GA_API_SECRET = process.env.GA_API_SECRET;

const SESSION_EXPIRATION_IN_MIN = 30;
const DEFAULT_ENGAGEMENT_TIME_IN_MSEC = 100;

async function getOrCreateClientId() {
  const result = await browser.storage.local.get('clientId');
  let clientId = result.clientId;
  if (!clientId) {
    // Generate a unique client ID, the actual value is not relevant
    clientId = self.crypto.randomUUID();
    await browser.storage.local.set({clientId});
  }
  return clientId;
}


async function getOrCreateSessionId() {
  // Store session in memory storage
  let {sessionData} = await browser.storage.local.get('sessionData');
  // Check if session exists and is still valid
  const currentTimeInMs = Date.now();
  if (sessionData && sessionData.timestamp) {
    // Calculate how long ago the session was last updated
    const durationInMin = (currentTimeInMs - sessionData.timestamp) / 60000;
    // Check if last update lays past the session expiration threshold
    if (durationInMin > SESSION_EXPIRATION_IN_MIN) {
      // Delete old session id to start a new session
      sessionData = null;
    } else {
      // Update timestamp to keep session alive
      sessionData.timestamp = currentTimeInMs;
      await browser.storage.local.set({sessionData});
    }
  }
  if (!sessionData) {
    // Create and store a new session
    sessionData = {
      session_id: currentTimeInMs.toString(),
      timestamp: currentTimeInMs.toString(),
    };
    await browser.storage.local.set({sessionData});
  }
  return sessionData.session_id;
}

async function sendEventExtension(eventName, params) {
  await sendEvent(GA_MEASUREMENT_ID, GA_API_SECRET, eventName, params);
}

async function sendEvent(measurementId, apiSecret, eventName, params) {
  params = {
    ...params,
    session_id: await getOrCreateSessionId(),
    engagement_time_msec: DEFAULT_ENGAGEMENT_TIME_IN_MSEC,
  };

  fetch(
    `${GA_ENDPOINT}?measurement_id=${measurementId}&api_secret=${apiSecret}`,
    {
      method: 'POST',
      body: JSON.stringify({
        client_id: await getOrCreateClientId(),
        events: [
          {
            name: eventName,
            params,
          },
        ],
      }),
    }
  );
}

export async function logInstall() {
  await sendEventExtension(EVENT_INSTALLED, {
    vendor: getVendor(),
    version: process.env.VM_VER
  });
}

export async function logActive() {
  const extensionEnabled = !!getOption('isApplied');

  await sendEventExtension(EVENT_ACTIVE, {
    vendor: getVendor(),
    version: process.env.VM_VER,
    what: 'extension',
    extensionEnabled,
  });
}
