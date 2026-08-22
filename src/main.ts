import {
  browserStorage,
  loadUserSettings,
  resolveServers,
  saveUserSettings,
} from './config/index.ts';
import { createIdleSession } from './domain/index.ts';
import { Application } from './lib/application.ts';
import { mountApp } from './ui/app.ts';
import './style.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('#app is missing');
}

const storage = browserStorage();
const session = createIdleSession();
const app = new Application({ storage });
let settings = loadUserSettings(storage);
const origin = globalThis.location?.origin;

const currentState = () => ({
  session,
  settings,
  resolved: resolveServers(settings, origin),
  online: app.online,
  canInstall: app.canInstall,
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
  onInstall: () => {
    void app.install();
  },
});

const redraw = () => view.sync(currentState());
app.on('network', redraw);
app.on('install', redraw);
app.on('installed', redraw);
redraw();
