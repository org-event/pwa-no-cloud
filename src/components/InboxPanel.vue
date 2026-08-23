<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { FIXTURE_TRANSFER_ID, type InboxEntry } from '@/lib/opfs.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import Card from './Card.vue';

const store = useNocloudStore();
const { inbox } = storeToRefs(store);
const copy = componentsCopy.inbox;

const keyOf = (entry: InboxEntry): string =>
  `${entry.transferId}/${entry.name}`;

const items = computed(() =>
  inbox.value.items.filter((item) => item.transferId !== FIXTURE_TRANSFER_ID),
);

const selected = computed(() => {
  const picked = inbox.value.selected;
  if (!picked) return null;
  return items.value.some((item) => keyOf(item) === keyOf(picked))
    ? picked
    : null;
});

const hidden = computed(
  () =>
    inbox.value.ready &&
    items.value.length === 0 &&
    !inbox.value.error &&
    !inbox.value.preview,
);
</script>

<template>
  <Card v-show="!hidden" :title="copy.legend">
    <div class="home-actions">
      <button
        type="button"
        class="button button-secondary"
        :disabled="!inbox.ready || !selected"
        @click="selected && store.onRead(selected)"
      >
        {{ copy.read }}
      </button>
      <button
        type="button"
        class="button button-secondary"
        :disabled="!inbox.ready || !selected"
        @click="selected && store.onRemove(selected)"
      >
        {{ copy.remove }}
      </button>
    </div>
    <div class="inbox-list" role="radiogroup" :aria-label="copy.listAria">
      <p v-if="!inbox.ready" class="tagline">{{ copy.opfsUnavailable }}</p>
      <p v-else-if="items.length === 0" class="tagline">{{ copy.empty }}</p>
      <label v-for="item in items" :key="keyOf(item)" class="choice">
        <input
          type="radio"
          name="inbox"
          :value="keyOf(item)"
          :checked="Boolean(selected && keyOf(selected) === keyOf(item))"
          @change="store.onSelect(item)"
        />
        <span>{{ item.name }}</span>
      </label>
    </div>
    <p v-if="inbox.error" class="error" role="alert">{{ inbox.error }}</p>
    <pre class="resolved">{{ inbox.preview }}</pre>
  </Card>
</template>
