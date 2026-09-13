<script setup lang="ts">
import { shellCopy } from '@/content/index.ts';
import { SETTINGS_MENU, type SettingsMenuItem } from '@/ui/shell-tabs.ts';

defineProps<{
  activeSection: SettingsMenuItem['section'] | null;
}>();

const emit = defineEmits<{
  select: [section: SettingsMenuItem['section']];
}>();
</script>

<template>
  <div class="shell-list" :aria-label="shellCopy.tabSettings">
    <p class="shell-list-title">{{ shellCopy.tabSettings }}</p>
    <ul class="shell-list-rows">
      <li v-for="item in SETTINGS_MENU" :key="item.id">
        <button
          type="button"
          class="shell-row"
          data-kind="settings"
          :aria-current="activeSection === item.section ? 'page' : undefined"
          @click="emit('select', item.section)"
        >
          <span class="shell-row-title">{{ item.title }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
