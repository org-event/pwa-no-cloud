<script setup lang="ts">
import Card from './Card.vue';

defineProps<{
  title: string;
  text: string;
}>();
</script>

<template>
  <Card :title="title" :hint="text" />
</template>
