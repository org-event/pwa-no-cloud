<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '@/stores/nocloud.ts';
import Card from './Card.vue';

const store = useNocloudStore();
const { logs } = storeToRefs(store);
const copy = componentsCopy.logs;
</script>

<template>
  <Card :title="copy.legend" :hint="copy.hint">
    <div class="logs-toolbar">
      <button
        type="button"
        class="button button-secondary"
        :disabled="!logs.text"
        @click="store.onClearLogs()"
      >
        {{ copy.clear }}
      </button>
    </div>
    <pre class="resolved logs-body" :aria-label="copy.ariaLabel">{{
      logs.text || copy.empty
    }}</pre>
    <p v-if="logs.error" class="error" role="alert">{{ logs.error }}</p>
  </Card>
</template>
