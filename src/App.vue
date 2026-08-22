<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { APP_NAME, APP_TAGLINE, APP_VERSION } from './config/index.ts';
import ContactsSection from './components/ContactsSection.vue';
import HelpSection from './components/HelpSection.vue';
import HomeSection from './components/HomeSection.vue';
import HostPanel from './components/HostPanel.vue';
import InboxPanel from './components/InboxPanel.vue';
import InvitePanel from './components/InvitePanel.vue';
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
const { statusLine, canInstall, state } = storeToRefs(store);

const menuOpen = ref(false);
const lastFocus = ref<HTMLElement | null>(null);
const menuButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);
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

const statusPath = computed(() =>
  store.invite.ice.includes('путь = relay') ? 'relay' : '',
);

const updateTitle = computed(
  () => state.value.updateNotice || 'Проверить обновление',
);

const versionTitle = computed(() =>
  state.value.updateNotice
    ? `${APP_VERSION} · ${state.value.updateNotice}`
    : APP_VERSION,
);

const setMenuOpen = (open: boolean) => {
  menuOpen.value = open;
  if (open) {
    lastFocus.value =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : menuButton.value;
    closeButton.value?.focus();
    return;
  }
  const back =
    lastFocus.value && document.contains(lastFocus.value)
      ? lastFocus.value
      : menuButton.value;
  back?.focus();
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
      К содержимому
    </a>

    <button
      type="button"
      class="drawer-scrim"
      :hidden="!menuOpen"
      tabindex="-1"
      aria-label="Закрыть меню"
      @click="setMenuOpen(false)"
    />

    <aside
      id="app-nav"
      class="drawer"
      aria-label="Разделы"
      :inert="!menuOpen"
      :aria-hidden="!menuOpen"
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
          aria-label="Закрыть меню"
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
      <nav
        class="drawer-nav"
        aria-label="Разделы приложения"
        @click="setMenuOpen(false)"
      >
        <a
          v-for="section in APP_SECTIONS"
          :key="section.id"
          class="drawer-link"
          :href="`#${section.id}`"
          :aria-current="currentSection === section.id ? 'page' : undefined"
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
          aria-label="Меню"
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
          :data-online="String(store.online)"
          :data-path="statusPath"
          :title="statusLine"
        >
          {{ statusLine }}
        </p>

        <div class="topbar-end">
          <button
            v-show="canInstall"
            type="button"
            class="button button-accent topbar-install"
            @click="store.onInstall()"
          >
            Установить
          </button>
          <p
            class="topbar-version"
            :title="versionTitle"
            :aria-label="`Сборка ${APP_VERSION}`"
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
          <div class="home">
            <HomeSection />
          </div>
          <div class="invite">
            <InvitePanel />
          </div>
          <div class="inbox">
            <InboxPanel />
          </div>
          <div class="invite" hidden>
            <TransferPanel />
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
            title="Видео конф"
            text="Видеозвонок ещё не собран. Сейчас приложение передаёт файлы напрямую, без облака."
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
