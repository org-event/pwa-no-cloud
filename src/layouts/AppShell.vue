<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import ShellTopbar from './ShellTopbar.vue';
import type { ThemeMode } from '@/lib/theme.ts';

export type ShellStatusView = {
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

defineProps<{
  versionTitle: string;
  updateTitle: string;
  status: ShellStatusView;
  themeMode: ThemeMode;
  themeLabel: string;
}>();

const emit = defineEmits<{
  toggleTheme: [];
  skipToContent: [event: Event];
}>();
</script>

<template>
  <div class="app-shell">
    <a class="skip-link" href="#content" @click="emit('skipToContent', $event)">
      {{ componentsCopy.app.skipToContent }}
    </a>

    <div class="app-frame">
      <ShellTopbar
        :status="status"
        :theme-mode="themeMode"
        :theme-label="themeLabel"
        :version-title="versionTitle"
        :update-title="updateTitle"
        @toggle-theme="emit('toggleTheme')"
      />
      <slot />
    </div>
  </div>
</template>
