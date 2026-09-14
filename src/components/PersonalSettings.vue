<script setup lang="ts">
import { shellCopy } from '@/content/index.ts';
import type { UnlockedIdentity } from '@/lib/identity-session.ts';
import Card from './Card.vue';

defineProps<{
  identity: UnlockedIdentity;
}>();

const emit = defineEmits<{
  openTransfer: [];
  lock: [];
}>();
</script>

<template>
  <Card :title="shellCopy.personalTitle" :hint="shellCopy.personalHint">
    <p class="tagline">{{ shellCopy.personalId }}</p>
    <p class="identity-chip">
      <code>{{ identity.displayFingerprint }}</code>
    </p>
    <p class="tagline">{{ shellCopy.personalLockHint }}</p>
    <template #actions>
      <button type="button" class="button" @click="emit('openTransfer')">
        {{ shellCopy.personalTransfer }}
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="emit('lock')"
      >
        {{ shellCopy.personalLock }}
      </button>
    </template>
  </Card>
</template>
