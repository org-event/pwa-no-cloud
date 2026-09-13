<script setup lang="ts">
import { shellCopy } from '@/content/index.ts';
import type { UnlockedIdentity } from '@/lib/identity-session.ts';
import Card from './Card.vue';

defineProps<{
  identity: UnlockedIdentity;
}>();

const emit = defineEmits<{
  openTransfer: [];
}>();
</script>

<template>
  <Card :title="shellCopy.personalTitle" :hint="shellCopy.personalHint">
    <p class="tagline">{{ shellCopy.personalId }}</p>
    <p class="identity-chip">
      <code>{{ identity.displayFingerprint }}</code>
    </p>
    <template #actions>
      <button type="button" class="button" @click="emit('openTransfer')">
        {{ shellCopy.personalTransfer }}
      </button>
    </template>
  </Card>
</template>
