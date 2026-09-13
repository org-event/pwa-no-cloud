<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from './config/index.ts';
import { componentsCopy, shellCopy, statusCopy } from '@/content/index.ts';
import ContactsSection from './components/ContactsSection.vue';
import HelpSection from './components/HelpSection.vue';
import HostPanel from './components/HostPanel.vue';
import IdentityOnboarding from './components/IdentityOnboarding.vue';
import InboxPanel from './components/InboxPanel.vue';
import LogsSection from './components/LogsSection.vue';
import CallsSection from './components/CallsSection.vue';
import PlaceholderSection from './components/PlaceholderSection.vue';
import ServersSection from './components/ServersSection.vue';
import SessionTools from './components/SessionTools.vue';
import ShellChatList from './components/ShellChatList.vue';
import ShellContactFocus from './components/ShellContactFocus.vue';
import TransferPanel from './components/TransferPanel.vue';
import { useNocloudStore } from './stores/nocloud.ts';
import type { UnlockedIdentity } from '@/lib/identity-session.ts';
import {
  APP_SECTIONS,
  parseSectionHash,
  type AppSection,
} from './ui/sections.ts';
import {
  isShellContact,
  isShellStub,
  parseShellContactId,
  shellNavTitle,
  type ShellNavId,
} from './ui/shell-nav.ts';

const store = useNocloudStore();
const { status, state, contacts } = storeToRefs(store);

const identity = ref<UnlockedIdentity | null>(null);
const onIdentityUnlocked = (value: UnlockedIdentity) => {
  identity.value = value;
  store.onBindIdentity(value.fingerprint, value.keyPair);
};

const menuOpen = ref(false);
const lastFocus = ref<HTMLElement | null>(null);
const menuButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
const drawer = ref<HTMLElement | null>(null);
const page = ref<HTMLElement | null>(null);

const TOOLS_MQ = '(max-width: 920px)';
const SHELL_MQ = '(max-width: 900px)';
const toolsInDrawer = ref(
  typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(TOOLS_MQ).matches,
);
const shellStacked = ref(
  typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(SHELL_MQ).matches,
);
/** On stacked layout: list first; selecting a row opens the pane. */
const listMode = ref(true);
let toolsMq: MediaQueryList | null = null;
let shellMq: MediaQueryList | null = null;

const syncToolsPlacement = () => {
  toolsInDrawer.value = Boolean(toolsMq?.matches);
};

const syncShellStack = () => {
  shellStacked.value = Boolean(shellMq?.matches);
  if (!shellStacked.value) listMode.value = false;
};

const currentSection = ref<AppSection>(
  parseSectionHash(
    globalThis.location?.hash ?? '',
    globalThis.location?.search ?? '',
  ),
);

const activeNav = ref<ShellNavId>(currentSection.value);

const pageTitle = computed(() => {
  const peerId = parseShellContactId(activeNav.value);
  if (peerId) {
    const contact = contacts.value.book.contacts.find(
      (item) => item.id === peerId,
    );
    return shellNavTitle(activeNav.value, contact ? contact.nick : undefined);
  }
  return shellNavTitle(activeNav.value);
});

const showShellList = computed(
  () => Boolean(identity.value) && (!shellStacked.value || listMode.value),
);

const showShellPane = computed(
  () => Boolean(identity.value) && (!shellStacked.value || !listMode.value),
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

const openPane = (id: ShellNavId) => {
  activeNav.value = id;
  const peerId = parseShellContactId(id);
  if (peerId) {
    store.onSelectContact(peerId);
    listMode.value = false;
    setMenuOpen(false);
    return;
  }
  if (!isShellStub(id)) {
    currentSection.value = id;
    if (globalThis.location && globalThis.location.hash !== `#${id}`) {
      globalThis.location.hash = id;
    }
  }
  listMode.value = false;
  setMenuOpen(false);
};

const openContactCalls = () => {
  const peerId = parseShellContactId(activeNav.value);
  openPane('calls');
  if (peerId) store.onSelectContact(peerId);
};

const openContactBook = () => {
  openPane('contacts');
};

const backToList = () => {
  listMode.value = true;
};

const onHash = () => {
  currentSection.value = parseSectionHash(
    globalThis.location?.hash ?? '',
    globalThis.location?.search ?? '',
  );
  activeNav.value = currentSection.value;
  if (shellStacked.value) listMode.value = false;
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

watch(identity, (value) => {
  if (value && shellStacked.value) listMode.value = true;
  if (value) void store.seedDemoContacts();
});

onMounted(() => {
  globalThis.addEventListener('hashchange', onHash);
  document.addEventListener('keydown', onKeydown);
  toolsMq = globalThis.matchMedia(TOOLS_MQ);
  shellMq = globalThis.matchMedia(SHELL_MQ);
  toolsMq.addEventListener('change', syncToolsPlacement);
  shellMq.addEventListener('change', syncShellStack);
  syncToolsPlacement();
  syncShellStack();
  onHash();
  if (shellStacked.value) listMode.value = true;
});

onUnmounted(() => {
  globalThis.removeEventListener('hashchange', onHash);
  document.removeEventListener('keydown', onKeydown);
  toolsMq?.removeEventListener('change', syncToolsPlacement);
  shellMq?.removeEventListener('change', syncShellStack);
  toolsMq = null;
  shellMq = null;
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
          @click="openPane(section.id)"
        >
          {{ section.title }}
        </a>
      </nav>
      <div class="drawer-tools">
        <SessionTools
          v-if="toolsInDrawer"
          in-drawer
          :version-title="versionTitle"
          :update-title="updateTitle"
        />
      </div>
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
          <SessionTools
            v-if="!toolsInDrawer"
            :version-title="versionTitle"
            :update-title="updateTitle"
          />
        </div>
      </header>

      <section v-if="!identity" class="page page-solo" data-section="identity">
        <IdentityOnboarding @unlocked="onIdentityUnlocked" />
      </section>

      <div v-else class="shell-body">
        <aside v-show="showShellList" class="shell-rail">
          <p class="identity-chip shell-identity">
            ID
            <code>{{ identity.displayFingerprint }}</code>
          </p>
          <ShellChatList :active-id="activeNav" @select="openPane" />
        </aside>

        <div v-show="showShellPane" class="shell-pane">
          <header class="shell-pane-head">
            <button
              v-if="shellStacked"
              type="button"
              class="icon-button"
              :aria-label="shellCopy.backToList"
              @click="backToList"
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
                  d="M15 6l-6 6 6 6"
                />
              </svg>
            </button>
            <h1 class="page-title shell-pane-title">{{ pageTitle }}</h1>
          </header>

          <main id="content" ref="page" class="page shell-page" tabindex="-1">
            <section
              v-if="isShellStub(activeNav)"
              class="page-section"
              data-section="stub"
            >
              <PlaceholderSection
                v-if="activeNav === 'stub-chats'"
                :title="shellCopy.stubChatsTitle"
                :text="shellCopy.stubChatsHint"
              />
              <PlaceholderSection
                v-else
                :title="shellCopy.stubEmptyTitle"
                :text="shellCopy.stubEmptyText"
              />
            </section>

            <section
              v-else-if="isShellContact(activeNav)"
              class="page-section"
              data-section="contact"
            >
              <ShellContactFocus
                :peer-id="parseShellContactId(activeNav) || ''"
                @open-calls="openContactCalls"
                @open-book="openContactBook"
                @open-transfer="openPane('lan')"
              />
            </section>

            <template v-else>
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
                v-show="currentSection === 'calls'"
                class="page-section"
                data-section="calls"
              >
                <CallsSection />
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
            </template>
          </main>
        </div>
      </div>
    </div>
  </div>
</template>
