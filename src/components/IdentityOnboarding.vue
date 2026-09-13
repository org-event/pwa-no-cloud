<script setup lang="ts">
import { browserStorage } from '@/config/index.ts';
import { componentsCopy } from '@/content/index.ts';
import {
  canUsePlatformAuthenticator,
  hasBiometricUnlock,
  type VaultStorage,
} from '@/domain/identity/index.ts';
import {
  createIdentityWithMnemonic,
  enableBiometricUnlock,
  exportBackupText,
  hasSealedVault,
  restoreIdentityFromBackupText,
  restoreIdentityFromMnemonic,
  unlockIdentity,
  unlockIdentityWithBiometrics,
  type UnlockedIdentity,
} from '@/lib/identity-session.ts';
import { computed, onMounted, ref } from 'vue';
import Card from './Card.vue';

const emit = defineEmits<{
  unlocked: [identity: UnlockedIdentity];
}>();

type Mode = 'unlock' | 'create' | 'restore-mnemonic' | 'restore-backup';

const copy = componentsCopy.identity;
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
const notice = ref('');
const busy = ref(false);
const unlocked = ref<UnlockedIdentity | null>(null);
const bioAvailable = ref(false);
const bioEnrolled = ref(hasBiometricUnlock(storage));

const title = computed(() => {
  if (mode.value === 'unlock') return 'Разблокировать личность';
  if (mode.value === 'create') return 'Создать личность';
  if (mode.value === 'restore-mnemonic') return 'Восстановить из seed-фразы';
  return 'Восстановить из файла бэкапа';
});

const showBioUnlock = computed(
  () =>
    mode.value === 'unlock' &&
    bioAvailable.value &&
    bioEnrolled.value &&
    !unlocked.value,
);

const showBioEnroll = computed(
  () => Boolean(unlocked.value) && bioAvailable.value && !bioEnrolled.value,
);

onMounted(() => {
  void canUsePlatformAuthenticator().then((ok) => {
    bioAvailable.value = ok;
  });
});

const finishUnlocked = (value: UnlockedIdentity) => {
  unlocked.value = value;
  emit('unlocked', value);
};

const run = async () => {
  error.value = '';
  notice.value = '';
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
      finishUnlocked(result.value);
      return;
    }
    if (mode.value === 'unlock') {
      const result = await unlockIdentity(storage, passphrase.value);
      if (!result.ok) {
        error.value = result.message;
        return;
      }
      finishUnlocked(result.value);
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
      bioEnrolled.value = false;
      finishUnlocked(result.value);
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
    bioEnrolled.value = false;
    finishUnlocked(result.value);
  } finally {
    busy.value = false;
  }
};

const runBiometric = async () => {
  error.value = '';
  notice.value = '';
  busy.value = true;
  try {
    const result = await unlockIdentityWithBiometrics(storage);
    if (!result.ok) {
      error.value = copy.bioFallback;
      notice.value = result.message;
      return;
    }
    finishUnlocked(result.value);
  } finally {
    busy.value = false;
  }
};

const enrollBiometric = async () => {
  if (!unlocked.value) return;
  error.value = '';
  notice.value = '';
  busy.value = true;
  try {
    const result = await enableBiometricUnlock(storage, unlocked.value);
    if (!result.ok) {
      error.value = result.message;
      return;
    }
    bioEnrolled.value = true;
    notice.value = copy.bioEnabled;
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
  <Card :title="title" :hint="copy.hint">
    <div class="stack-form">
      <label class="field">
        <span>{{ copy.passphrase }}</span>
        <input
          v-model="passphrase"
          type="password"
          autocomplete="current-password"
          :disabled="busy"
        />
      </label>

      <label v-if="mode === 'restore-mnemonic'" class="field">
        <span>{{ copy.seedLabel }}</span>
        <textarea v-model="mnemonic" rows="3" :disabled="busy" />
      </label>

      <label v-if="mode === 'restore-backup'" class="field">
        <span>{{ copy.backupLabel }}</span>
        <textarea v-model="backupText" rows="4" :disabled="busy" />
      </label>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="notice" class="tagline">{{ notice }}</p>

      <p v-if="shownMnemonic" class="tagline">
        {{ copy.saveSeed }}
        <strong>{{ shownMnemonic }}</strong>
      </p>

      <p v-if="unlocked" class="tagline">
        {{ copy.fingerprint }}
        <code>{{ unlocked.displayFingerprint }}</code>
      </p>
    </div>

    <template #actions>
      <button
        v-if="showBioUnlock"
        type="button"
        class="primary"
        :disabled="busy"
        @click="runBiometric"
      >
        {{ copy.unlockBio }}
      </button>
      <button type="button" class="primary" :disabled="busy" @click="run">
        {{ mode === 'unlock' ? copy.enter : copy.continue }}
      </button>
      <button
        v-if="showBioEnroll"
        type="button"
        :disabled="busy"
        @click="enrollBiometric"
      >
        {{ copy.enableBio }}
      </button>
      <button
        v-if="unlocked"
        type="button"
        :disabled="busy || !passphrase"
        @click="copyBackup"
      >
        {{ copy.copyBackup }}
      </button>
      <button
        v-if="mode !== 'create'"
        type="button"
        :disabled="busy"
        @click="mode = 'create'"
      >
        {{ copy.createNew }}
      </button>
      <button
        v-if="mode !== 'unlock' && hasSealedVault(storage)"
        type="button"
        :disabled="busy"
        @click="mode = 'unlock'"
      >
        {{ copy.unlock }}
      </button>
      <button
        v-if="mode !== 'restore-mnemonic'"
        type="button"
        :disabled="busy"
        @click="mode = 'restore-mnemonic'"
      >
        {{ copy.fromSeed }}
      </button>
      <button
        v-if="mode !== 'restore-backup'"
        type="button"
        :disabled="busy"
        @click="mode = 'restore-backup'"
      >
        {{ copy.fromBackup }}
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
