<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '../stores/nocloud.ts';

const store = useNocloudStore();
const { invite } = storeToRefs(store);

const paste = ref('');

const manual = computed(() => invite.value.mode === 'manual');

const hint = computed(() => {
  if (!manual.value) {
    return invite.value.connected
      ? 'Канал открыт'
      : 'Оба в одной комнате — канал откроется сам';
  }
  if (invite.value.role === 'caller') {
    return 'Отправьте текст второму окну, затем вставьте его ответ';
  }
  if (invite.value.role === 'callee') {
    return 'Вставьте приглашение или пакет S1. с серверов, затем отдайте ответ';
  }
  return invite.value.connected ? 'Канал открыт' : '';
});
</script>

<template>
  <fieldset v-show="manual" class="panel">
    <legend>Приглашение</legend>
    <p class="tagline">{{ hint }}</p>

    <label v-show="manual" class="choice">
      <input
        type="checkbox"
        :checked="invite.shareWithPeer"
        :disabled="!invite.canShareServers"
        @change="
          store.onShareWithPeer(($event.target as HTMLInputElement).checked)
        "
      />
      <span
        >Вложить мои серверы: если у второго нет TURN/сокета — пусть возьмёт
        эти</span
      >
    </label>

    <img
      v-if="manual && invite.qrUrl"
      :src="invite.qrUrl"
      alt="QR приглашения"
      class="invite-qr"
    />

    <textarea
      v-show="manual"
      :value="invite.outgoing"
      readonly
      rows="6"
      class="invite-out"
      aria-label="Исходящее приглашение"
    />

    <div v-show="manual" class="home-actions">
      <button
        type="button"
        class="button button-secondary"
        :disabled="!invite.outgoing"
        @click="store.onCopy()"
      >
        Скопировать
      </button>
      <button
        type="button"
        class="button"
        :disabled="!invite.outgoing"
        @click="store.onShareLink()"
      >
        Поделиться ссылкой
      </button>
    </div>

    <textarea
      v-show="manual"
      v-model="paste"
      rows="6"
      placeholder="Вставьте приглашение или ответ"
      class="invite-in"
      aria-label="Входящее приглашение или ответ"
    />

    <div v-show="manual" class="home-actions">
      <button
        type="button"
        class="button"
        :disabled="invite.connected"
        @click="store.onApplyPaste(paste)"
      >
        Принять текст
      </button>
      <button
        type="button"
        class="button button-accent"
        :disabled="!invite.connected"
        @click="store.onPing()"
      >
        Ping
      </button>
    </div>

    <p v-if="invite.error" class="error" role="alert">{{ invite.error }}</p>
  </fieldset>
</template>
