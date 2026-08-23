<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { APP_VERSION } from '@/config/index.ts';
import { componentsCopy } from '@/content/index.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';

defineProps<{
  inDrawer?: boolean;
  versionTitle: string;
  updateTitle: string;
}>();

const store = useNocloudStore();
const { contacts, hasSignalingSocket, canInstall, state } = storeToRefs(store);
</script>

<template>
  <div class="session-tools" :class="{ 'is-in-drawer': inDrawer }">
    <button
      type="button"
      class="button topbar-presence"
      :class="contacts.presenceAvailable ? 'button-secondary' : 'button-accent'"
      :disabled="!hasSignalingSocket"
      :title="
        contacts.presenceAvailable
          ? componentsCopy.contacts.presenceOnLabel
          : componentsCopy.contacts.presenceOffLabel
      "
      :aria-pressed="contacts.presenceAvailable"
      @click="
        contacts.presenceAvailable
          ? store.onStopPresence()
          : store.onStartPresence()
      "
    >
      <span
        class="presence status-dot"
        :data-online="String(contacts.presenceAvailable)"
        aria-hidden="true"
      />
      {{
        contacts.presenceAvailable
          ? componentsCopy.contacts.goUnavailable
          : componentsCopy.contacts.goAvailable
      }}
    </button>
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
</template>
