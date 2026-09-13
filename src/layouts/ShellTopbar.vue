<script setup lang="ts">
import SessionTools from '@/components/SessionTools.vue';
import { statusCopy } from '@/content/index.ts';
import type { ThemeMode } from '@/lib/theme.ts';

defineProps<{
  status: {
    networkOnline: boolean;
    socketLive: boolean;
    socketBusy: boolean;
    socketVisible: boolean;
    webrtcLive: boolean;
    linkLabel: string;
    latencyLabel: string;
    title: string;
    path: string;
  };
  themeMode: ThemeMode;
  themeLabel: string;
  versionTitle: string;
  updateTitle: string;
}>();

const emit = defineEmits<{
  toggleTheme: [];
}>();
</script>

<template>
  <header class="topbar">
    <p
      class="status-line"
      data-role="session"
      role="status"
      aria-live="polite"
      :data-online="String(status.networkOnline)"
      :data-socket="String(status.socketLive)"
      :data-webrtc="String(status.webrtcLive)"
      :data-path="status.path"
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
        type="button"
        class="icon-button"
        :title="themeLabel"
        :aria-label="themeLabel"
        @click="emit('toggleTheme')"
      >
        <svg
          v-if="themeMode === 'dark'"
          viewBox="0 0 24 24"
          class="icon"
          aria-hidden="true"
          focusable="false"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5Z"
          />
        </svg>
        <svg
          v-else-if="themeMode === 'system'"
          viewBox="0 0 24 24"
          class="icon"
          aria-hidden="true"
          focusable="false"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="14"
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            d="M8 20h8"
          />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          class="icon"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="12"
            cy="12"
            r="4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
          />
        </svg>
      </button>
      <SessionTools :version-title="versionTitle" :update-title="updateTitle" />
    </div>
  </header>
</template>
