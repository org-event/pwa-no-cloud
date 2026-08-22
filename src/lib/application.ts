import { APP_BASE, SERVICE_WORKER_PATH } from '../workers/sw.ts';
import { APP_PROTOCOL, protocolHandlerUrl } from './app-link.ts';
import { EventEmitter } from './events.ts';
import { getClientId, type IdStorage } from './id.ts';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type ApplicationConfig = {
  storage?: IdStorage;
  serviceWorker?: string;
  registerWorker?: boolean;
};

export class Application extends EventEmitter {
  online = false;
  canInstall = false;
  clientId = '';
  worker: ServiceWorker | null = null;
  prompt: InstallPrompt | null = null;
  serviceWorker = SERVICE_WORKER_PATH;
  storage: IdStorage;

  constructor(config: ApplicationConfig = {}) {
    super();
    this.storage = config.storage ?? localStorage;
    this.serviceWorker = config.serviceWorker ?? SERVICE_WORKER_PATH;
    this.clientId = getClientId(this.storage);
    this.online = navigator.onLine;
    const shouldRegister = config.registerWorker ?? import.meta.env.PROD;
    this.setupNetwork();
    this.setupInstall();
    this.setupProtocol();
    if (shouldRegister) void this.registerWorker();
  }

  setupNetwork() {
    window.addEventListener('online', () => {
      this.online = true;
      this.emit('network', { online: true });
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this.emit('network', { online: false });
    });
  }

  setupInstall() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
      this.canInstall = true;
      this.emit('install', { prompt: this.prompt });
    });
    window.addEventListener('appinstalled', () => {
      this.prompt = null;
      this.canInstall = false;
      this.emit('installed', { accepted: true });
    });
  }

  setupProtocol() {
    const nav = navigator as Navigator & {
      registerProtocolHandler?: (scheme: string, url: string) => void;
    };
    if (typeof nav.registerProtocolHandler !== 'function') return;
    try {
      nav.registerProtocolHandler(
        APP_PROTOCOL,
        protocolHandlerUrl(globalThis.location.origin, APP_BASE),
      );
    } catch {
      return;
    }
  }

  async registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.register(
      this.serviceWorker,
      { scope: APP_BASE },
    );
    this.worker = registration.active;
    navigator.serviceWorker.addEventListener('message', (event) => {
      const payload = event.data as { type?: string; data?: unknown };
      if (payload.type) this.emit(payload.type, payload.data);
    });
    await navigator.serviceWorker.ready;
    this.worker = registration.active ?? navigator.serviceWorker.controller;
    this.post({ type: 'ping' });
  }

  post(data: { type: string; data?: unknown }) {
    if (!this.worker) return;
    this.worker.postMessage(data);
  }

  async install() {
    if (!this.prompt) return { accepted: false };
    await this.prompt.prompt();
    const { outcome } = await this.prompt.userChoice;
    this.prompt = null;
    this.canInstall = false;
    const accepted = outcome === 'accepted';
    this.emit('installed', { accepted });
    return { accepted };
  }
}
