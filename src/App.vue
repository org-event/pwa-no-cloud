<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from './config/index.ts';
import { componentsCopy, shellCopy, statusCopy } from '@/content/index.ts';
import ContactsSection from './components/ContactsSection.vue';
import HelpSection from './components/HelpSection.vue';
import HostPanel from './components/HostPanel.vue';
import InboxPanel from './components/InboxPanel.vue';
import LogsSection from './components/LogsSection.vue';
import PlaceholderSection from './components/PlaceholderSection.vue';
import ServersSection from './components/ServersSection.vue';
import TransferPanel from './components/TransferPanel.vue';
import { useNocloudStore } from './stores/nocloud.ts';
import {
  APP_SECTIONS,
  parseSectionHash,
  type AppSection,
} from './ui/sections.ts';

const store = useNocloudStore();
const { status, canInstall, state } = storeToRefs(store);

const menuOpen = ref(false);
const lastFocus = ref<HTMLElement | null>(null);
const menuButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const drawer = ref<HTMLElement | null>(null);
const page = ref<HTMLElement | null>(null);

const currentSection = ref<AppSection>(
  parseSectionHash(
    globalThis.location?.hash ?? '',
    globalThis.location?.search ?? '',
  ),
);

const pageTitle = computed(
  () =>
    APP_SECTIONS.find((item) => item.id === currentSection.value)?.title ?? '',
);

const statusPath = computed(() => status.value.path);

const updateTitle = computed(
  () => state.value.updateNotice || shellCopy.checkUpdate,
);

const versionTitle = computed(() =>
  state.value.updateNotice
    ? `${APP_VERSION} · ${state.value.updateNotice}`
    : APP_VERSION,
);

const focusOutsideDrawer = () => {
  const active = document.activeElement;
  const inside =
    active instanceof HTMLElement && Boolean(drawer.value?.contains(active));
  if (!inside) return;
  const back =
    lastFocus.value &&
    document.contains(lastFocus.value) &&
    !drawer.value?.contains(lastFocus.value)
      ? lastFocus.value
      : menuButton.value;
  back?.focus();
  if (document.activeElement === active && active instanceof HTMLElement) {
    active.blur();
  }
};

const setMenuOpen = (open: boolean) => {
  if (open) {
    lastFocus.value =
      document.activeElement instanceof HTMLElement &&
      !drawer.value?.contains(document.activeElement)
        ? document.activeElement
        : menuButton.value;
    menuOpen.value = true;
    void nextTick(() => closeButton.value?.focus());
    return;
  }
  if (!menuOpen.value) return;
  // Move focus out before inert hides the drawer from AT.
  focusOutsideDrawer();
  menuOpen.value = false;
  void nextTick(() => {
    const back =
      lastFocus.value &&
      document.contains(lastFocus.value) &&
      !drawer.value?.contains(lastFocus.value)
        ? lastFocus.value
        : menuButton.value;
    back?.focus();
  });
};

const onHash = () => {
  currentSection.value = parseSectionHash(
    globalThis.location?.hash ?? '',
    globalThis.location?.search ?? '',
  );
  if (menuOpen.value) setMenuOpen(false);
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && menuOpen.value) {
    event.preventDefault();
    setMenuOpen(false);
  }
};

const skipToContent = (event: Event) => {
  event.preventDefault();
  page.value?.focus();
};

onMounted(() => {
  globalThis.addEventListener('hashchange', onHash);
  document.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  globalThis.removeEventListener('hashchange', onHash);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div class="app-shell" :class="{ 'is-menu-open': menuOpen }">
    <a class="skip-link" href="#content" @click="skipToContent">
      {{ componentsCopy.app.skipToContent }}
    </a>

    <button
      type="button"
      class="drawer-scrim"
      :hidden="!menuOpen"
      tabindex="-1"
      :aria-label="componentsCopy.app.closeMenu"
      @click="setMenuOpen(false)"
    />

    <aside
      id="app-nav"
      ref="drawer"
      class="drawer"
      :aria-label="componentsCopy.app.sections"
      :inert="!menuOpen"
    >
      <div class="drawer-head">
        <div>
          <p class="drawer-title">{{ APP_NAME }}</p>
          <p class="tagline">{{ APP_TAGLINE }}</p>
        </div>
        <button
          ref="closeButton"
          type="button"
          class="icon-button"
          :aria-label="componentsCopy.app.closeMenu"
          @click="setMenuOpen(false)"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            class="icon"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
      </div>
      <nav class="drawer-nav" :aria-label="componentsCopy.app.appSections">
        <a
          v-for="section in APP_SECTIONS"
          :key="section.id"
          class="drawer-link"
          :href="`#${section.id}`"
          :aria-current="currentSection === section.id ? 'page' : undefined"
          @click="setMenuOpen(false)"
        >
          {{ section.title }}
        </a>
      </nav>
    </aside>

    <div class="app-frame" :inert="menuOpen">
      <header class="topbar">
        <button
          ref="menuButton"
          type="button"
          class="icon-button"
          :aria-label="componentsCopy.app.menu"
          aria-controls="app-nav"
          :aria-expanded="menuOpen"
          @click="setMenuOpen(!menuOpen)"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
            class="icon"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          </svg>
        </button>

        <p
          class="status-line"
          data-role="session"
          role="status"
          aria-live="polite"
          :data-online="String(status.networkOnline)"
          :data-socket="String(status.socketLive)"
          :data-webrtc="String(status.webrtcLive)"
          :data-path="statusPath"
          :title="status.title"
        >
          <span
            v-if="status.socketVisible"
            class="status-chip"
            :data-online="String(status.socketLive)"
            :data-busy="String(status.socketBusy)"
          >
            <span
              class="presence status-dot"
              :data-online="String(status.socketLive)"
              :data-busy="String(status.socketBusy)"
              :aria-label="
                status.socketBusy
                  ? statusCopy.socketBusyLabel
                  : status.socketLive
                    ? statusCopy.socketOnlineLabel
                    : statusCopy.socketOfflineLabel
              "
            />
            <span>{{ statusCopy.socketOn }}</span>
          </span>
          <span class="status-chip" :data-online="String(status.webrtcLive)">
            <span
              class="presence status-dot"
              :data-online="String(status.webrtcLive)"
              :aria-label="
                status.webrtcLive
                  ? statusCopy.webrtcOnlineLabel
                  : statusCopy.webrtcOfflineLabel
              "
            />
            <span>{{ statusCopy.webrtcOn }}</span>
          </span>
          <span v-if="status.linkLabel" class="status-line-text">{{
            status.linkLabel
          }}</span>
          <span v-if="status.latencyLabel" class="status-line-ms">{{
            status.latencyLabel
          }}</span>
        </p>

        <div class="topbar-end">
          <button
            v-show="canInstall"
            type="button"
            class="button button-accent topbar-install"
            @click="store.onInstall()"
          >
            {{ componentsCopy.app.install }}
          </button>
          <p
            class="topbar-version"
            :title="versionTitle"
            :aria-label="componentsCopy.app.buildLabel(APP_VERSION)"
          >
            {{ APP_VERSION }}
          </p>
          <button
            type="button"
            class="icon-button topbar-update"
            :disabled="state.updateChecking"
            :title="updateTitle"
            :aria-label="updateTitle"
            @click="store.onCheckUpdate()"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              class="icon"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M20 12a8 8 0 1 1-2.2-5.5M20 4v5h-5"
              />
            </svg>
          </button>
        </div>
      </header>

      <main id="content" ref="page" class="page" tabindex="-1">
        <h1 class="page-title">{{ pageTitle }}</h1>

        <section
          v-show="currentSection === 'lan'"
          class="page-section"
          data-section="lan"
        >
          <div class="transfer">
            <TransferPanel />
          </div>
          <div class="inbox">
            <InboxPanel />
          </div>
        </section>

        <section
          v-show="currentSection === 'servers'"
          class="page-section servers"
          data-section="servers"
        >
          <div id="my-server" class="servers">
            <HostPanel />
          </div>
          <div class="servers">
            <ServersSection />
          </div>
        </section>

        <section
          v-show="currentSection === 'contacts'"
          class="page-section"
          data-section="contacts"
        >
          <ContactsSection />
        </section>

        <section
          v-show="currentSection === 'video'"
          class="page-section"
          data-section="video"
        >
          <PlaceholderSection
            :title="componentsCopy.app.videoTitle"
            :text="componentsCopy.app.videoText"
          />
        </section>

        <section
          v-show="currentSection === 'logs'"
          class="page-section"
          data-section="logs"
        >
          <LogsSection />
        </section>

        <section
          v-show="currentSection === 'help'"
          class="page-section help"
          data-section="help"
        >
          <HelpSection />
        </section>
      </main>
    </div>
  </div>
</template>
