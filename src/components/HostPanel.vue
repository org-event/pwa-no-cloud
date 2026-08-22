<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import {
  EMPTY_TURN_HOST,
  generateHostCommands,
  validateTurnHost,
} from '../domain/turn-host.ts';
import { useNocloudStore } from '../stores/nocloud.ts';

const store = useNocloudStore();
const { state } = storeToRefs(store);

const form = reactive({
  host: state.value.hostDraft.host,
  sshUser: state.value.hostDraft.sshUser || EMPTY_TURN_HOST.sshUser,
  sharePack: '',
});
const formError = ref('');
const editing = ref(false);
const qrInput = ref<HTMLInputElement | null>(null);

watch(
  () => state.value.hostDraft,
  (draft) => {
    if (!editing.value) {
      form.host = draft.host;
      form.sshUser = draft.sshUser || EMPTY_TURN_HOST.sshUser;
    }
  },
  { deep: true },
);

const script = computed(() =>
  generateHostCommands({ host: form.host, sshUser: form.sshUser }),
);

const onSubmit = (event: Event) => {
  event.preventDefault();
  const checked = validateTurnHost({ host: form.host, sshUser: form.sshUser });
  if (!checked.ok) {
    formError.value = checked.message;
    return;
  }
  formError.value = '';
  store.onSaveHost(checked.value);
};

const onQrChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) store.onScanSharePack(file);
};
</script>

<template>
  <form
    class="panel custom"
    @submit="onSubmit"
    @focusin="editing = true"
    @focusout="editing = false"
  >
    <fieldset>
      <legend>Мой сервер</legend>
      <p class="tagline">
        1) ssh на VPS. 2) curl установщика. Скрипт спросит пароль, порты
        (80/443) и сокет с HTTPS. Имя sslip.io, Let’s Encrypt ~90 дней, email
        один раз — дальше cron. В конце — QR S1.
      </p>
      <label class="field">
        <span>SSH-логин</span>
        <input
          v-model="form.sshUser"
          name="sshUser"
          type="text"
          autocomplete="username"
          placeholder="root"
        />
      </label>
      <label class="field">
        <span>IP или DNS</span>
        <input
          v-model="form.host"
          name="host"
          type="text"
          autocomplete="off"
          inputmode="url"
          placeholder="203.0.113.10"
        />
      </label>
      <div class="home-actions">
        <button class="button" type="submit">Сохранить адрес</button>
        <button
          type="button"
          class="button button-secondary"
          @click="store.onCopyHostScript(script)"
        >
          Скопировать команды
        </button>
      </div>
      <label class="field">
        <span>Пакет S1. с консоли или QR</span>
        <textarea
          v-model="form.sharePack"
          name="sharePack"
          rows="4"
          autocomplete="off"
          placeholder="S1.{...}"
        />
      </label>
      <div class="home-actions">
        <button
          type="button"
          class="button"
          @click="store.onApplySharePack(form.sharePack)"
        >
          Сохранить пакет
        </button>
        <button
          type="button"
          class="button button-secondary"
          @click="qrInput?.click()"
        >
          Считать QR
        </button>
      </div>
    </fieldset>
  </form>

  <input
    ref="qrInput"
    type="file"
    accept="image/*"
    capture="environment"
    class="file-input"
    aria-hidden="true"
    tabindex="-1"
    @change="onQrChange"
  />

  <p class="tagline" aria-live="polite">{{ state.hostNotice }}</p>
  <p v-if="formError" class="error" role="alert">{{ formError }}</p>
  <pre class="resolved" aria-label="Команды для консоли">{{ script }}</pre>
</template>
