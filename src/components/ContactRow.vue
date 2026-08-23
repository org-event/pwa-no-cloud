<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string;
    detail?: string;
    online?: boolean;
    onlineLabel?: string;
    offlineLabel?: string;
  }>(),
  {
    detail: undefined,
    online: undefined,
    onlineLabel: undefined,
    offlineLabel: undefined,
  },
);
</script>

<template>
  <div class="contact-row">
    <slot name="leading" />
    <div class="contact-row-main">
      <div class="contact-name">
        <span
          v-if="online !== undefined"
          class="presence"
          :data-online="String(online)"
          :aria-label="online ? onlineLabel : offlineLabel"
          :title="online ? onlineLabel : offlineLabel"
        />
        <strong>{{ name }}</strong>
      </div>
      <p v-if="detail" class="tagline">{{ detail }}</p>
      <slot name="detail" />
    </div>
    <div v-if="$slots.actions" class="contact-row-actions">
      <slot name="actions" />
    </div>
  </div>
</template>
