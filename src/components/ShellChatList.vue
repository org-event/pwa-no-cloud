<script setup lang="ts">
import { shellCopy } from '@/content/index.ts';
import {
  allShellNavItems,
  type ShellNavId,
  type ShellNavItem,
} from '@/ui/shell-nav.ts';

defineProps<{
  activeId: ShellNavId;
}>();

const emit = defineEmits<{
  select: [id: ShellNavId];
}>();

const items: ShellNavItem[] = allShellNavItems();

const onSelect = (id: ShellNavId) => {
  emit('select', id);
};
</script>

<template>
  <div class="shell-list" :aria-label="shellCopy.listAria">
    <p class="shell-list-title">{{ shellCopy.listTitle }}</p>
    <ul class="shell-list-rows">
      <li v-for="item in items" :key="item.id">
        <button
          type="button"
          class="shell-row"
          :data-kind="item.kind"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="onSelect(item.id)"
        >
          <span class="shell-row-title">{{ item.title }}</span>
          <span class="shell-row-detail">{{ item.detail }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
