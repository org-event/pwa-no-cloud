import { APP_BASE, SERVICE_WORKER_PATH } from '@/workers/sw.ts';
import { APP_PROTOCOL, protocolHandlerUrl } from './app-link.ts';
import {
  decideUpdate,
  parseRemoteVersion,
  versionFileUrl,
  type UpdateDecision,
} from './app-update.ts';
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
  reloading = false;

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
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (this.reloading) return;
      this.reloading = true;
      globalThis.location.reload();
    });
    await navigator.serviceWorker.ready;
    this.worker = registration.active ?? navigator.serviceWorker.controller;
    this.post({ type: 'ping' });
    void registration.update();
  }

  watchUpdates(localVersion: string) {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void this.checkForUpdate(localVersion).then((decision) => {
        if (decision === 'reload') void this.refreshShell();
      });
    };
    document.addEventListener('visibilitychange', onVisible);
  }

  async checkForUpdate(localVersion: string): Promise<UpdateDecision> {
    if ('serviceWorker' in navigator) {
      const registration =
        await navigator.serviceWorker.getRegistration(APP_BASE);
      try {
        await registration?.update();
      } catch {
        /* iOS sometimes throws if SW is mid-update */
      }
    }
    try {
      const url = `${versionFileUrl(APP_BASE)}?t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return 'unavailable';
      const remote = parseRemoteVersion(await response.json());
      return decideUpdate(localVersion, remote);
    } catch {
      return 'unavailable';
    }
  }

  async refreshShell() {
    if (this.reloading) return;
    this.reloading = true;
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((item) => item.unregister()));
    }
    if ('caches' in globalThis) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    globalThis.location.reload();
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
