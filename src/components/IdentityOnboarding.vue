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
import FieldInput from './FieldInput.vue';

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
    <FieldInput
      v-model="passphrase"
      :label="copy.passphrase"
      type="password"
      autocomplete="current-password"
      :disabled="busy"
    />

    <FieldInput
      v-if="mode === 'restore-mnemonic'"
      v-model="mnemonic"
      :label="copy.seedLabel"
      :rows="3"
      :disabled="busy"
    />

    <FieldInput
      v-if="mode === 'restore-backup'"
      v-model="backupText"
      :label="copy.backupLabel"
      :rows="4"
      :disabled="busy"
    />

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

    <template #actions>
      <button
        v-if="showBioUnlock"
        type="button"
        class="button"
        :disabled="busy"
        @click="runBiometric"
      >
        {{ copy.unlockBio }}
      </button>
      <button type="button" class="button" :disabled="busy" @click="run">
        {{ mode === 'unlock' ? copy.enter : copy.continue }}
      </button>
      <button
        v-if="showBioEnroll"
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="enrollBiometric"
      >
        {{ copy.enableBio }}
      </button>
      <button
        v-if="unlocked"
        type="button"
        class="button button-secondary"
        :disabled="busy || !passphrase"
        @click="copyBackup"
      >
        {{ copy.copyBackup }}
      </button>
      <button
        v-if="mode !== 'create'"
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="mode = 'create'"
      >
        {{ copy.createNew }}
      </button>
      <button
        v-if="mode !== 'unlock' && hasSealedVault(storage)"
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="mode = 'unlock'"
      >
        {{ copy.unlock }}
      </button>
      <button
        v-if="mode !== 'restore-mnemonic'"
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="mode = 'restore-mnemonic'"
      >
        {{ copy.fromSeed }}
      </button>
      <button
        v-if="mode !== 'restore-backup'"
        type="button"
        class="button button-secondary"
        :disabled="busy"
        @click="mode = 'restore-backup'"
      >
        {{ copy.fromBackup }}
      </button>
    </template>
  </Card>
</template>

<style scoped>
.error {
  color: var(--color-destructive);
  margin: 0;
}
</style>
