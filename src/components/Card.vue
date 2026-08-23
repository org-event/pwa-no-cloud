<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    hint?: string;
  }>(),
  {
    hint: undefined,
  },
);

defineOptions({ inheritAttrs: false });
</script>

<template>
  <fieldset class="panel card" v-bind="$attrs">
    <legend>{{ title }}</legend>
    <p v-if="hint || $slots.hint" class="tagline card-hint">
      <slot name="hint">{{ hint }}</slot>
    </p>
    <div v-if="$slots.default" class="card-body">
      <slot />
    </div>
    <div v-if="$slots.actions" class="home-actions card-actions">
      <slot name="actions" />
    </div>
  </fieldset>
</template>
