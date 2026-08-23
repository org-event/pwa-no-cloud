<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { computed } from 'vue';
import type { ProfileCard } from '@/domain/profile.ts';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import ContactRow from './ContactRow.vue';

const props = defineProps<{
  card: ProfileCard | null;
}>();

const emit = defineEmits<{
  accept: [];
  skip: [];
}>();

const visible = computed(() => props.card !== null);
const copy = componentsCopy.pendingPeer;
</script>

<template>
  <Card v-if="visible" :title="copy.legend">
    <ContactRow v-if="card" :name="card.nick" :detail="card.id">
      <template #leading>
        <AvatarImg :id="card.id" :avatar="card.avatar" />
      </template>
    </ContactRow>
    <template #actions>
      <button type="button" class="button" @click="emit('accept')">
        {{ copy.accept }}
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="emit('skip')"
      >
        {{ copy.skip }}
      </button>
    </template>
  </Card>
</template>
