<script setup lang="ts">
import ShellTabBar from '@/components/ShellTabBar.vue';
import type { ShellTabId } from '@/ui/shell-tabs.ts';

defineProps<{
  activeTab: ShellTabId;
  show?: boolean;
  tabsOnly?: boolean;
}>();

const emit = defineEmits<{
  select: [id: ShellTabId];
}>();
</script>

<template>
  <aside
    v-show="show !== false"
    class="shell-rail"
    :class="{ 'is-tabs-only': tabsOnly }"
  >
    <div v-show="!tabsOnly" class="shell-rail-body">
      <slot />
    </div>
    <div class="shell-rail-tabs">
      <ShellTabBar :active-tab="activeTab" @select="emit('select', $event)" />
    </div>
  </aside>
</template>
