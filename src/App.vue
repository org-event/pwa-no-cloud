<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { APP_VERSION, browserStorage } from './config/index.ts';
import { componentsCopy, shellCopy } from '@/content/index.ts';
import ContactsSection from './components/ContactsSection.vue';
import HelpSection from './components/HelpSection.vue';
import HostPanel from './components/HostPanel.vue';
import IdentityOnboarding from './components/IdentityOnboarding.vue';
import InboxPanel from './components/InboxPanel.vue';
import LogsSection from './components/LogsSection.vue';
import CallsSection from './components/CallsSection.vue';
import PersonalSettings from './components/PersonalSettings.vue';
import ServersSection from './components/ServersSection.vue';
import ShellCallList from './components/ShellCallList.vue';
import ShellChatList from './components/ShellChatList.vue';
import ShellChatThread from './components/ShellChatThread.vue';
import ShellContactList from './components/ShellContactList.vue';
import ShellSettingsList from './components/ShellSettingsList.vue';
import TransferPanel from './components/TransferPanel.vue';
import AppShell from './layouts/AppShell.vue';
import ShellRail from './layouts/ShellRail.vue';
import { useNocloudStore } from './stores/nocloud.ts';
import type {
  IdentityUnlock,
  UnlockedIdentity,
} from '@/lib/identity-session.ts';
import { PENDING_FIRST_SCREEN_PASTE_KEY } from '@/lib/first-screen-paste.ts';
import {
  cycleTheme,
  initTheme,
  saveTheme,
  type ThemeMode,
} from './lib/theme.ts';
import { parseSectionHash, type AppSection } from './ui/sections.ts';
import {
  isSelfPeer,
  parseShellContactId,
  shellNavTitle,
  type ShellNavId,
} from './ui/shell-nav.ts';
import {
  DEFAULT_SHELL_TAB,
  SETTINGS_MENU,
  tabForSection,
  type ShellTabId,
} from './ui/shell-tabs.ts';

const store = useNocloudStore();
const { status, state, contacts } = storeToRefs(store);

const themeMode = ref<ThemeMode>(initTheme());
const themeLabel = computed(() => {
  if (themeMode.value === 'dark') return componentsCopy.app.themeDark;
  if (themeMode.value === 'system') return componentsCopy.app.themeSystem;
  return componentsCopy.app.themeLight;
});
const onToggleTheme = () => {
  themeMode.value = cycleTheme(themeMode.value);
  saveTheme(themeMode.value);
};

const identity = ref<UnlockedIdentity | null>(null);
const onIdentityUnlocked = (unlock: IdentityUnlock) => {
  identity.value = unlock.view;
  store.onBindIdentity(
    unlock.view.fingerprint,
    unlock.secret,
    unlock.publicKey,
  );
  const storage = browserStorage();
  const pending = storage.getItem(PENDING_FIRST_SCREEN_PASTE_KEY);
  if (pending) {
    storage.removeItem?.(PENDING_FIRST_SCREEN_PASTE_KEY);
    void store.onAddContact(pending);
  }
};

const onLockIdentity = () => {
  identity.value = null;
  store.onLockIdentity();
};

const onFirstScreenPack = (text: string) => {
  store.onApplySharePack(text);
};

const page = ref<HTMLElement | null>(null);

const SHELL_MQ = '(max-width: 900px)';
const shellStacked = ref(
  typeof globalThis.matchMedia === 'function' &&
    globalThis.matchMedia(SHELL_MQ).matches,
);
const listMode = ref(true);
let shellMq: MediaQueryList | null = null;

const syncShellStack = () => {
  shellStacked.value = Boolean(shellMq?.matches);
  if (!shellStacked.value) listMode.value = false;
};

const activeTab = ref<ShellTabId>(DEFAULT_SHELL_TAB);
const settingsSection = ref<AppSection | 'personal' | null>(null);
const activeContact = ref<ShellNavId | null>(null);
const activeCallPeer = ref<string | null>(null);
const activeProfileContact = ref<string | null>(null);

/** Pane head only for a concrete peer / settings page — not tab names. */
const paneTitle = computed(() => {
  if (activeTab.value === 'chats' && activeContact.value) {
    const peerId = parseShellContactId(activeContact.value);
    if (isSelfPeer(peerId)) return shellCopy.selfChatTitle;
    const contact = peerId
      ? contacts.value.book.contacts.find((item) => item.id === peerId)
      : null;
    return shellNavTitle(
      activeContact.value,
      contact ? contact.nick : undefined,
    );
  }
  if (activeTab.value === 'calls' && activeCallPeer.value) {
    const contact = contacts.value.book.contacts.find(
      (item) => item.id === activeCallPeer.value,
    );
    return contact?.nick || activeCallPeer.value.slice(0, 12);
  }
  if (activeTab.value === 'profile' && activeProfileContact.value) {
    const contact = contacts.value.book.contacts.find(
      (item) => item.id === activeProfileContact.value,
    );
    return contact?.nick || activeProfileContact.value.slice(0, 12);
  }
  if (activeTab.value === 'settings' && settingsSection.value) {
    return shellNavTitle(settingsSection.value);
  }
  return '';
});

const showPaneHead = computed(() => {
  if (activeTab.value === 'chats' && activeContact.value) return false;
  return Boolean(paneTitle.value);
});

const showRail = computed(() => Boolean(identity.value));

const railTabsOnly = computed(
  () =>
    shellStacked.value &&
    !listMode.value &&
    ((activeTab.value === 'chats' && Boolean(activeContact.value)) ||
      (activeTab.value === 'calls' && Boolean(activeCallPeer.value)) ||
      (activeTab.value === 'settings' && Boolean(settingsSection.value)) ||
      (activeTab.value === 'profile' && Boolean(activeProfileContact.value))),
);

const showPane = computed(() => {
  if (!identity.value) return false;
  if (activeTab.value === 'profile') return true;
  if (activeTab.value === 'settings') {
    return Boolean(settingsSection.value) || !shellStacked.value;
  }
  if (activeTab.value === 'calls') {
    return Boolean(activeCallPeer.value) || !shellStacked.value;
  }
  if (activeTab.value === 'chats') {
    if (activeContact.value) return !shellStacked.value || !listMode.value;
    return !shellStacked.value;
  }
  return false;
});

const statusView = computed(() => ({
  networkOnline: status.value.networkOnline,
  socketLive: status.value.socketLive,
  socketBusy: status.value.socketBusy,
  socketVisible: status.value.socketVisible,
  webrtcLive: status.value.webrtcLive,
  linkLabel: status.value.linkLabel,
  latencyLabel: status.value.latencyLabel,
  title: status.value.title,
  path: status.value.path,
}));

const updateTitle = computed(
  () => state.value.updateNotice || shellCopy.checkUpdate,
);
const versionTitle = computed(() =>
  state.value.updateNotice
    ? `${APP_VERSION} · ${state.value.updateNotice}`
    : APP_VERSION,
);

const setHash = (id: string) => {
  if (globalThis.location && globalThis.location.hash !== `#${id}`) {
    globalThis.location.hash = id;
  }
};

const openSettingsItem = (section: AppSection | 'personal') => {
  activeTab.value = 'settings';
  settingsSection.value = section;
  if (section !== 'personal') setHash(section);
  listMode.value = false;
};

const openTransfer = () => openSettingsItem('lan');

const openTab = (tab: ShellTabId) => {
  activeTab.value = tab;
  if (tab === 'chats') {
    settingsSection.value = null;
    activeCallPeer.value = null;
    activeProfileContact.value = null;
    if (shellStacked.value) listMode.value = true;
    setHash('chats');
    return;
  }
  activeContact.value = null;
  if (tab === 'calls') {
    settingsSection.value = null;
    activeProfileContact.value = null;
    listMode.value = shellStacked.value;
    setHash('calls');
    return;
  }
  if (tab === 'profile') {
    settingsSection.value = null;
    activeCallPeer.value = null;
    activeProfileContact.value = null;
    listMode.value = false;
    setHash('contacts');
    return;
  }
  // settings
  activeCallPeer.value = null;
  activeProfileContact.value = null;
  if (!settingsSection.value) {
    settingsSection.value = SETTINGS_MENU[0]?.section ?? 'personal';
  }
  listMode.value = shellStacked.value;
  setHash('settings');
};

const openContact = (id: ShellNavId) => {
  const peerId = parseShellContactId(id);
  if (!peerId) return;
  activeTab.value = 'chats';
  settingsSection.value = null;
  activeContact.value = id;
  if (!isSelfPeer(peerId)) store.onSelectContact(peerId);
  listMode.value = false;
};

const openCallPeer = (peerId: string) => {
  activeTab.value = 'calls';
  settingsSection.value = null;
  activeCallPeer.value = peerId;
  store.onSelectContact(peerId);
  listMode.value = false;
};

const openProfileContact = (peerId: string) => {
  activeTab.value = 'profile';
  settingsSection.value = null;
  activeProfileContact.value = peerId;
  store.onSelectContact(peerId);
  listMode.value = false;
};

const openContactCalls = () => {
  const contactId = activeContact.value;
  const peerId = contactId ? parseShellContactId(contactId) : null;
  openTab('calls');
  if (peerId && !isSelfPeer(peerId)) {
    activeCallPeer.value = peerId;
    store.onSelectContact(peerId);
  }
};

const openContactBook = () => openTab('profile');

const backToList = () => {
  listMode.value = true;
  if (activeTab.value === 'chats') activeContact.value = null;
  if (activeTab.value === 'calls') activeCallPeer.value = null;
  if (activeTab.value === 'settings') settingsSection.value = null;
  if (activeTab.value === 'profile') activeProfileContact.value = null;
};

const applyHash = () => {
  const hash = (globalThis.location?.hash ?? '')
    .replace(/^#/, '')
    .toLowerCase();
  if (!hash || hash === 'chats') {
    activeTab.value = 'chats';
    settingsSection.value = null;
    if (shellStacked.value) listMode.value = true;
    return;
  }
  if (hash === 'settings') {
    openTab('settings');
    return;
  }
  const section = parseSectionHash(
    globalThis.location?.hash ?? '',
    globalThis.location?.search ?? '',
  );
  const tab = tabForSection(section);
  if (tab === 'settings') {
    activeTab.value = 'settings';
    settingsSection.value = section === 'lan' ? 'lan' : section;
    listMode.value = false;
    return;
  }
  if (tab) {
    openTab(tab);
    return;
  }
  settingsSection.value = section;
  activeTab.value = 'settings';
  listMode.value = false;
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
  globalThis.addEventListener('hashchange', applyHash);
  shellMq = globalThis.matchMedia(SHELL_MQ);
  shellMq.addEventListener('change', syncShellStack);
  syncShellStack();
  applyHash();
});

onUnmounted(() => {
  globalThis.removeEventListener('hashchange', applyHash);
  shellMq?.removeEventListener('change', syncShellStack);
  shellMq = null;
});
</script>

<template>
  <AppShell
    :version-title="versionTitle"
    :update-title="updateTitle"
    :status="statusView"
    :theme-mode="themeMode"
    :theme-label="themeLabel"
    @toggle-theme="onToggleTheme"
    @skip-to-content="skipToContent"
  >
    <section v-if="!identity" class="page page-solo" data-section="identity">
      <IdentityOnboarding
        @unlocked="onIdentityUnlocked"
        @apply-pack="onFirstScreenPack"
      />
    </section>

    <div v-else class="shell-body">
      <ShellRail
        :show="showRail"
        :tabs-only="railTabsOnly"
        :active-tab="activeTab"
        @select="openTab"
      >
        <ShellChatList
          v-if="activeTab === 'chats'"
          :active-id="activeContact"
          @select="openContact"
        />
        <ShellCallList
          v-else-if="activeTab === 'calls'"
          :active-peer-id="activeCallPeer"
          @select="openCallPeer"
        />
        <ShellSettingsList
          v-else-if="activeTab === 'settings'"
          :active-section="settingsSection"
          @select="openSettingsItem"
        />
        <ShellContactList
          v-else-if="activeTab === 'profile'"
          :active-id="activeProfileContact"
          @select="openProfileContact"
        />
      </ShellRail>

      <div
        v-show="showPane"
        class="shell-pane"
        :class="{ 'is-chat': activeTab === 'chats' && activeContact }"
      >
        <header v-if="showPaneHead" class="shell-pane-head">
          <button
            v-if="
              shellStacked &&
              ((activeTab === 'calls' && activeCallPeer) ||
                (activeTab === 'settings' && settingsSection) ||
                (activeTab === 'profile' && activeProfileContact))
            "
            type="button"
            class="icon-button"
            :aria-label="
              activeTab === 'calls'
                ? shellCopy.backToCalls
                : activeTab === 'profile'
                  ? shellCopy.tabProfile
                  : shellCopy.tabSettings
            "
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
          <h1 class="page-title shell-pane-title">{{ paneTitle }}</h1>
        </header>

        <main
          id="content"
          ref="page"
          class="page shell-page"
          :class="{ 'is-chat': activeTab === 'chats' && activeContact }"
          tabindex="-1"
        >
          <section
            v-if="activeTab === 'chats' && activeContact && identity"
            class="page-section page-section-chat"
            data-section="chat"
          >
            <ShellChatThread
              :peer-id="parseShellContactId(activeContact) || ''"
              :identity="identity"
              :show-back="shellStacked"
              @back="backToList"
              @open-calls="openContactCalls"
              @open-book="openContactBook"
              @open-transfer="openTransfer"
            />
          </section>

          <section
            v-else-if="activeTab === 'chats'"
            class="page-section"
            data-section="chat-empty"
          >
            <p class="tagline">{{ shellCopy.chatEmptyHint }}</p>
          </section>

          <section
            v-else-if="activeTab === 'profile'"
            class="page-section"
            data-section="contacts"
          >
            <ContactsSection list-in-rail :focus-id="activeProfileContact" />
          </section>

          <section
            v-else-if="activeTab === 'calls'"
            class="page-section"
            data-section="calls"
          >
            <CallsSection :peer-id="activeCallPeer" />
          </section>

          <template v-else-if="activeTab === 'settings' && settingsSection">
            <section
              v-if="settingsSection === 'lan'"
              class="page-section"
              data-section="lan"
            >
              <div class="transfer"><TransferPanel /></div>
              <div class="inbox"><InboxPanel /></div>
            </section>
            <section
              v-else-if="settingsSection === 'servers'"
              class="page-section servers"
              data-section="servers"
            >
              <div id="my-server" class="servers"><HostPanel /></div>
              <div class="servers"><ServersSection /></div>
            </section>
            <section
              v-else-if="settingsSection === 'logs'"
              class="page-section"
              data-section="logs"
            >
              <LogsSection />
            </section>
            <section
              v-else-if="settingsSection === 'help'"
              class="page-section help"
              data-section="help"
            >
              <HelpSection />
            </section>
            <section
              v-else-if="settingsSection === 'personal' && identity"
              class="page-section"
              data-section="personal"
            >
              <PersonalSettings
                :identity="identity"
                @open-transfer="openTransfer"
                @lock="onLockIdentity"
              />
            </section>
          </template>

          <section
            v-else-if="activeTab === 'settings'"
            class="page-section"
            data-section="settings-empty"
          >
            <p class="tagline">{{ shellCopy.drawerPersonal }}</p>
          </section>
        </main>
      </div>
    </div>
  </AppShell>
</template>
