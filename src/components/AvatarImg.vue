<script setup lang="ts">
import { computed } from 'vue';
import { avatarSrc } from '../lib/avatar.ts';

const props = defineProps<{
  id: string;
  avatar: string;
  size?: number;
}>();

const src = computed(() => avatarSrc(props.id, props.avatar));
const size = computed(() => props.size ?? 40);
</script>

<template>
  <img
    class="avatar"
    alt=""
    aria-hidden="true"
    :width="size"
    :height="size"
    :src="src"
  />
</template>
