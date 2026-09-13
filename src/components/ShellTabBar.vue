<script setup lang="ts">
import { shellCopy } from '@/content/index.ts';
import { SHELL_TABS, type ShellTabId } from '@/ui/shell-tabs.ts';

defineProps<{
  activeTab: ShellTabId;
}>();

const emit = defineEmits<{
  select: [id: ShellTabId];
}>();
</script>

<template>
  <nav class="shell-tabs" :aria-label="shellCopy.tabsAria">
    <button
      v-for="tab in SHELL_TABS"
      :key="tab.id"
      type="button"
      class="shell-tab"
      :data-tab="tab.id"
      :aria-label="tab.title"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      @click="emit('select', tab.id)"
    >
      <svg
        v-if="tab.id === 'profile'"
        class="shell-tab-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 12a4.5 4.5 0 1 0-4.5-4.5A4.5 4.5 0 0 0 12 12Zm0 2.25c-3.6 0-7.5 1.8-7.5 4.5V21h15v-2.25c0-2.7-3.9-4.5-7.5-4.5Z"
        />
      </svg>
      <svg
        v-else-if="tab.id === 'calls'"
        class="shell-tab-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M7.2 3.6c.4-.4 1-.5 1.5-.3l2.2 1c.5.2.8.7.8 1.2v2.3c0 .4-.2.8-.5 1L9.5 10c1.2 2.3 3.1 4.2 5.4 5.4l1.2-1.7c.2-.3.6-.5 1-.5h2.3c.5 0 1 .3 1.2.8l1 2.2c.2.5.1 1.1-.3 1.5l-1.4 1.4c-.4.4-1 .6-1.6.5-3.7-.6-7.1-2.6-9.7-5.2S4.1 9.2 3.5 5.5c-.1-.6.1-1.2.5-1.6Z"
        />
      </svg>
      <svg
        v-else-if="tab.id === 'chats'"
        class="shell-tab-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M4.5 4.5h11A2.5 2.5 0 0 1 18 7v6.5a2.5 2.5 0 0 1-2.5 2.5H9l-3.8 2.7a.8.8 0 0 1-1.2-.7V7A2.5 2.5 0 0 1 4.5 4.5Zm13.2 3H19A2.5 2.5 0 0 1 21.5 10v8.5a.8.8 0 0 1-1.2.7L17 17h-4.2"
        />
      </svg>
      <svg
        v-else
        class="shell-tab-icon"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M19.1 12.6a7.4 7.4 0 0 0 .1-1.2 7.4 7.4 0 0 0-.1-1.2l2-1.6a.5.5 0 0 0 .1-.6l-1.9-3.3a.5.5 0 0 0-.6-.2l-2.4 1a7 7 0 0 0-2-1.2l-.4-2.5a.5.5 0 0 0-.5-.4h-3.8a.5.5 0 0 0-.5.4l-.4 2.5a7 7 0 0 0-2 1.2l-2.4-1a.5.5 0 0 0-.6.2L2.7 8a.5.5 0 0 0 .1.6l2 1.6a7.4 7.4 0 0 0-.1 1.2 7.4 7.4 0 0 0 .1 1.2l-2 1.6a.5.5 0 0 0-.1.6l1.9 3.3a.5.5 0 0 0 .6.2l2.4-1a7 7 0 0 0 2 1.2l.4 2.5a.5.5 0 0 0 .5.4h3.8a.5.5 0 0 0 .5-.4l.4-2.5a7 7 0 0 0 2-1.2l2.4 1a.5.5 0 0 0 .6-.2l1.9-3.3a.5.5 0 0 0-.1-.6ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
        />
      </svg>
    </button>
  </nav>
</template>
