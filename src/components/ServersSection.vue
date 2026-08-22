<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { SERVER_PRESETS } from '../config/index.ts';
import { useNocloudStore } from '../stores/nocloud.ts';
import {
  customDraftToForm,
  readCustomDraft,
  SIGNALING_KIND_OPTIONS,
} from '../ui/servers-form.ts';

const store = useNocloudStore();
const { state, resolved } = storeToRefs(store);

const formError = ref('');
const customForm = reactive(customDraftToForm(state.value.settings.custom));
const editing = ref(false);

watch(
  () => state.value.settings,
  (settings) => {
    if (settings.presetId === 'custom' && !editing.value) {
      Object.assign(customForm, customDraftToForm(settings.custom));
    }
  },
  { deep: true },
);

const previewText = computed(() => {
  if (!resolved.value.ok) return resolved.value.message;
  return JSON.stringify(resolved.value.value, null, 2);
});

const turnHint = computed(() => {
  if (resolved.value.ok && resolved.value.value.hasTurn) {
    return 'TURN задан. Если увидите «сейчас путь = relay» — трафик идёт через ваш релей.';
  }
  if (resolved.value.ok) {
    return 'TURN не задан. В одной Wi‑Fi часто хватает host/STUN; через интернет при жёстком NAT нужен свой TURN.';
  }
  return '';
});

const onSubmit = (event: Event) => {
  event.preventDefault();
  const draft = readCustomDraft(customForm);
  if ('error' in draft) {
    formError.value = draft.error;
    return;
  }
  formError.value = '';
  store.onSaveCustom(draft);
};
</script>

<template>
  <fieldset class="panel">
    <legend>Пресет</legend>
    <label v-for="preset in SERVER_PRESETS" :key="preset.id" class="choice">
      <input
        type="radio"
        name="preset"
        :value="preset.id"
        :checked="state.settings.presetId === preset.id"
        @change="store.onPreset(preset.id)"
      />
      <span>{{ preset.title }}</span>
    </label>
  </fieldset>

  <p v-if="turnHint" class="tagline">{{ turnHint }}</p>

  <form
    v-show="state.settings.presetId === 'custom'"
    class="panel custom"
    @submit="onSubmit"
    @focusin="editing = true"
    @focusout="editing = false"
  >
    <fieldset>
      <legend>Свой сервер</legend>
      <label class="field">
        <span>Signaling</span>
        <select v-model="customForm.kind" name="kind">
          <option
            v-for="option in SIGNALING_KIND_OPTIONS"
            :key="option.id"
            :value="option.id"
          >
            {{ option.title }}
          </option>
        </select>
      </label>
      <label class="field">
        <span>Адрес сокета</span>
        <input
          v-model="customForm.signalingUrl"
          name="signalingUrl"
          type="url"
          autocomplete="off"
          placeholder="https://203.0.113.10:8443"
        />
      </label>
      <p class="tagline">
        Сокет — не файлы, а «комната»: два телефона стучатся сюда и находят друг
        друга. Берётся из пакета S1. после curl на VPS. Без адреса ссылка
        «открой и получи» не сойдётся.
      </p>
      <label class="field">
        <span>STUN, по одному URL в строке</span>
        <textarea v-model="customForm.stun" name="stun" rows="3" />
      </label>
      <p class="tagline">
        Чужой открытый TURN в пресеты не кладём. Для теста через интернет можно
        вписать бесплатный Open Relay: см. docs/turn.md. На сотовой сети нужны
        несколько URL (UDP, TCP и turns на 443).
      </p>
      <label class="field">
        <span>TURN, по одному URL в строке</span>
        <textarea
          v-model="customForm.turnUrl"
          name="turnUrl"
          rows="4"
          autocomplete="off"
          placeholder="turn:example.com:3478"
        />
      </label>
      <label class="field">
        <span>TURN логин</span>
        <input
          v-model="customForm.turnUser"
          name="turnUser"
          type="text"
          autocomplete="off"
        />
      </label>
      <label class="field">
        <span>TURN пароль</span>
        <input
          v-model="customForm.turnPass"
          name="turnPass"
          type="password"
          autocomplete="off"
        />
      </label>
      <label class="field">
        <span>или iceServers JSON</span>
        <textarea
          v-model="customForm.iceJson"
          name="iceJson"
          rows="5"
          autocomplete="off"
          placeholder='[{"urls":"turn:...","username":"...","credential":"..."}]'
        />
      </label>
      <button class="button" type="submit">Сохранить свой сервер</button>
    </fieldset>
  </form>

  <p v-if="formError || !resolved.ok" class="error" role="alert">
    {{ formError || (!resolved.ok ? resolved.message : '') }}
  </p>

  <pre class="resolved">{{ previewText }}</pre>
</template>
