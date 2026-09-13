<script setup lang="ts">
import { browserStorage } from '@/config/index.ts';
import type { VaultStorage } from '@/domain/identity/index.ts';
import {
  createIdentityWithMnemonic,
  exportBackupText,
  hasSealedVault,
  restoreIdentityFromBackupText,
  restoreIdentityFromMnemonic,
  unlockIdentity,
  type UnlockedIdentity,
} from '@/lib/identity-session.ts';
import { computed, ref } from 'vue';
import Card from './Card.vue';

const emit = defineEmits<{
  unlocked: [identity: UnlockedIdentity];
}>();

type Mode = 'unlock' | 'create' | 'restore-mnemonic' | 'restore-backup';

const base = browserStorage();
const storage: VaultStorage = {
  getItem: (key) => base.getItem(key),
  setItem: (key, value) => {
    base.setItem(key, value);
  },
  removeItem: (key) => {
    base.removeItem?.(key);
  },
};
const mode = ref<Mode>(hasSealedVault(storage) ? 'unlock' : 'create');
const passphrase = ref('');
const mnemonic = ref('');
const backupText = ref('');
const shownMnemonic = ref('');
const error = ref('');
const busy = ref(false);
const unlocked = ref<UnlockedIdentity | null>(null);

const title = computed(() => {
  if (mode.value === 'unlock') return 'Разблокировать личность';
  if (mode.value === 'create') return 'Создать личность';
  if (mode.value === 'restore-mnemonic') return 'Восстановить из seed-фразы';
  return 'Восстановить из файла бэкапа';
});

const run = async () => {
  error.value = '';
  busy.value = true;
  try {
    if (mode.value === 'create') {
      const result = await createIdentityWithMnemonic(
        storage,
        passphrase.value,
      );
      if (!result.ok) {
        error.value = result.message;
        return;
      }
      shownMnemonic.value = result.mnemonic ?? '';
      unlocked.value = result.value;
      emit('unlocked', result.value);
      return;
    }
    if (mode.value === 'unlock') {
      const result = await unlockIdentity(storage, passphrase.value);
      if (!result.ok) {
        error.value = result.message;
        return;
      }
      unlocked.value = result.value;
      emit('unlocked', result.value);
      return;
    }
    if (mode.value === 'restore-mnemonic') {
      const result = await restoreIdentityFromMnemonic(
        storage,
        mnemonic.value,
        passphrase.value,
      );
      if (!result.ok) {
        error.value = result.message;
        return;
      }
      unlocked.value = result.value;
      emit('unlocked', result.value);
      return;
    }
    const result = await restoreIdentityFromBackupText(
      storage,
      backupText.value,
      passphrase.value,
    );
    if (!result.ok) {
      error.value = result.message;
      return;
    }
    unlocked.value = result.value;
    emit('unlocked', result.value);
  } finally {
    busy.value = false;
  }
};

const copyBackup = async () => {
  if (!unlocked.value) return;
  const backup = await exportBackupText(unlocked.value, passphrase.value);
  if (!backup.ok) {
    error.value = backup.message;
    return;
  }
  await navigator.clipboard?.writeText(backup.text);
};
</script>

<template>
  <Card :title="title" hint="Грубый онбординг M1: ключ локально, без облака.">
    <div class="stack-form">
      <label class="field">
        <span>Мастер-фраза</span>
        <input
          v-model="passphrase"
          type="password"
          autocomplete="current-password"
          :disabled="busy"
        />
      </label>

      <label v-if="mode === 'restore-mnemonic'" class="field">
        <span>Seed BIP39 (12 слов)</span>
        <textarea v-model="mnemonic" rows="3" :disabled="busy" />
      </label>

      <label v-if="mode === 'restore-backup'" class="field">
        <span>Содержимое nb1. бэкапа</span>
        <textarea v-model="backupText" rows="4" :disabled="busy" />
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <p v-if="shownMnemonic" class="tagline">
        Сохраните seed-фразу (один раз):
        <strong>{{ shownMnemonic }}</strong>
      </p>

      <p v-if="unlocked" class="tagline">
        Fingerprint:
        <code>{{ unlocked.displayFingerprint }}</code>
      </p>
    </div>

    <template #actions>
      <button type="button" class="primary" :disabled="busy" @click="run">
        {{ mode === 'unlock' ? 'Войти' : 'Продолжить' }}
      </button>
      <button
        v-if="unlocked"
        type="button"
        :disabled="busy || !passphrase"
        @click="copyBackup"
      >
        Копировать бэкап
      </button>
      <button
        v-if="mode !== 'create'"
        type="button"
        :disabled="busy"
        @click="mode = 'create'"
      >
        Создать новую
      </button>
      <button
        v-if="mode !== 'unlock' && hasSealedVault(storage)"
        type="button"
        :disabled="busy"
        @click="mode = 'unlock'"
      >
        Разблокировать
      </button>
      <button
        v-if="mode !== 'restore-mnemonic'"
        type="button"
        :disabled="busy"
        @click="mode = 'restore-mnemonic'"
      >
        Из seed
      </button>
      <button
        v-if="mode !== 'restore-backup'"
        type="button"
        :disabled="busy"
        @click="mode = 'restore-backup'"
      >
        Из бэкапа
      </button>
    </template>
  </Card>
</template>

<style scoped>
.stack-form {
  display: grid;
  gap: 0.75rem;
}
.field {
  display: grid;
  gap: 0.35rem;
}
.field input,
.field textarea {
  width: 100%;
}
.error {
  color: var(--danger, #c44);
  margin: 0;
}
</style>
