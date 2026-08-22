import {
  browserStorage,
  loadUserSettings,
  resolveServers,
  saveUserSettings,
} from './config/index.ts';
import { createIdleSession } from './domain/index.ts';
import { mountApp } from './ui/app.ts';
import { SERVICE_WORKER_PATH } from './workers/sw.ts';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('#app is missing');
}

const storage = browserStorage();
const session = createIdleSession();
let settings = loadUserSettings(storage);
const origin = globalThis.location?.origin;

const currentState = () => ({
  session,
  settings,
  resolved: resolveServers(settings, origin),
});

const view = mountApp(root, {
  onPreset: (presetId) => {
    settings = { ...settings, presetId };
    saveUserSettings(settings, storage);
    view.sync(currentState());
  },
  onSaveCustom: (custom) => {
    settings = { presetId: 'custom', custom };
    saveUserSettings(settings, storage);
    view.sync(currentState());
  },
});

root.dataset.sw = SERVICE_WORKER_PATH;
view.sync(currentState());
