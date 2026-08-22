<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { FIXTURE_TRANSFER_ID, type InboxEntry } from '../lib/opfs.ts';
import { useNocloudStore } from '../stores/nocloud.ts';

const store = useNocloudStore();
const { inbox } = storeToRefs(store);

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
  <fieldset v-show="!hidden" class="panel">
    <legend>Получено на этом телефоне</legend>
    <div class="home-actions">
      <button
        type="button"
        class="button button-secondary"
        :disabled="!inbox.ready || !selected"
        @click="selected && store.onRead(selected)"
      >
        Прочитать
      </button>
      <button
        type="button"
        class="button button-secondary"
        :disabled="!inbox.ready || !selected"
        @click="selected && store.onRemove(selected)"
      >
        Удалить
      </button>
    </div>
    <div class="inbox-list" role="radiogroup" aria-label="Полученные файлы">
      <p v-if="!inbox.ready" class="tagline">OPFS недоступен в этом браузере</p>
      <p v-else-if="items.length === 0" class="tagline">Пока пусто</p>
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
  </fieldset>
</template>
