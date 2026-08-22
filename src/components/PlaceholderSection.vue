<script setup lang="ts">
defineProps<{
  title: string;
  text: string;
}>();
</script>

<template>
  <fieldset class="panel">
    <legend>{{ title }}</legend>
    <p class="tagline">{{ text }}</p>
  </fieldset>
</template>
