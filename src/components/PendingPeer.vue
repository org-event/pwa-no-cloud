<script setup lang="ts">
import { computed } from 'vue';
import type { ProfileCard } from '../domain/profile.ts';
import AvatarImg from './AvatarImg.vue';

const props = defineProps<{
  card: ProfileCard | null;
}>();

const emit = defineEmits<{
  accept: [];
  skip: [];
}>();

const visible = computed(() => props.card !== null);
</script>

<template>
  <fieldset v-if="visible" class="panel">
    <legend>Новый человек</legend>
    <div class="contact-row">
      <AvatarImg v-if="card" :id="card.id" :avatar="card.avatar" />
    </div>
    <p v-if="card" class="tagline">{{ card.nick }} · {{ card.id }}</p>
    <div class="home-actions">
      <button type="button" class="button" @click="emit('accept')">
        В адресную книгу
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="emit('skip')"
      >
        Не сейчас
      </button>
    </div>
  </fieldset>
</template>
