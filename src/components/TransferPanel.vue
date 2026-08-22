<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  collectFromDirectory,
  collectFromFileList,
} from '../lib/folder-walk.ts';
import { useNocloudStore } from '../stores/nocloud.ts';
import {
  fileStatus,
  folderStatus,
  isOpenFolder,
} from '../ui/transfer-status.ts';

const store = useNocloudStore();
const { transfer } = storeToRefs(store);

const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);

const incomingFile = computed(() => {
  const incoming = transfer.value.incoming;
  return incoming && !incoming.folderId ? incoming : null;
});

const needAccept = computed(() =>
  Boolean(transfer.value.incomingFolder || incomingFile.value),
);

const openFolder = computed(
  () =>
    isOpenFolder(transfer.value.folder) ||
    Boolean(transfer.value.incomingFolder),
);

const blocked = computed(
  () =>
    Boolean(transfer.value.current) ||
    Boolean(transfer.value.incoming) ||
    openFolder.value,
);

const busy = computed(
  () =>
    transfer.value.current?.state === 'sending' ||
    transfer.value.current?.state === 'receiving' ||
    transfer.value.folder?.state === 'sending' ||
    transfer.value.folder?.state === 'receiving',
);

const paused = computed(() => transfer.value.current?.state === 'paused');

const statusText = computed(() => {
  const shownFolder = transfer.value.incomingFolder ?? transfer.value.folder;
  const shownFile = incomingFile.value ?? transfer.value.current;
  if (shownFolder) return folderStatus(shownFolder, shownFile);
  if (shownFile) return fileStatus(shownFile);
  if (transfer.value.queuedNames.length > 0) {
    return `в очереди: ${transfer.value.queuedNames.join(', ')} — уйдёт после соединения`;
  }
  if (!transfer.value.connected) {
    return 'файл можно выбрать сейчас — уйдёт после соединения';
  }
  return '';
});

const onPickFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) store.onPickFile(file);
};

const onPickFolderLegacy = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  input.value = '';
  if (!files || files.length === 0) return;
  const walked = collectFromFileList(files);
  if (!walked.ok) {
    store.onPickError(walked.message);
    return;
  }
  store.onPickFolder(walked.value);
};

const pickDirectory = async () => {
  const picker = Reflect.get(window, 'showDirectoryPicker');
  if (typeof picker === 'function') {
    try {
      const handle = (await picker.call(window)) as FileSystemDirectoryHandle;
      const walked = await collectFromDirectory(handle);
      if (!walked.ok) {
        store.onPickError(walked.message);
        return;
      }
      store.onPickFolder(walked.value);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  folderInput.value?.click();
};

const acceptIncoming = () => {
  if (transfer.value.incomingFolder) {
    store.onAcceptFile(transfer.value.incomingFolder.id);
    return;
  }
  if (incomingFile.value) store.onAcceptFile(incomingFile.value.id);
};

const rejectIncoming = () => {
  if (transfer.value.incomingFolder) {
    store.onRejectFile(transfer.value.incomingFolder.id);
    return;
  }
  if (incomingFile.value) store.onRejectFile(incomingFile.value.id);
};
</script>

<template>
  <fieldset class="panel">
    <legend>Файлы</legend>
    <input
      ref="fileInput"
      type="file"
      class="file-input"
      aria-label="Выбрать файл для отправки"
      @change="onPickFile"
    />
    <input
      ref="folderInput"
      type="file"
      class="file-input"
      multiple
      webkitdirectory
      directory
      aria-label="Выбрать папку для отправки"
      @change="onPickFolderLegacy"
    />
    <div class="home-actions">
      <button
        type="button"
        class="button button-accent"
        :disabled="blocked"
        @click="fileInput?.click()"
      >
        {{ transfer.connected ? 'Отправить файл' : 'Выбрать файл' }}
      </button>
      <button
        type="button"
        class="button"
        :disabled="blocked"
        @click="pickDirectory()"
      >
        {{ transfer.connected ? 'Отправить папку' : 'Выбрать папку' }}
      </button>
      <button
        v-show="needAccept"
        type="button"
        class="button"
        @click="acceptIncoming"
      >
        {{ transfer.incomingFolder ? 'Принять папку' : 'Принять файл' }}
      </button>
      <button
        v-show="needAccept"
        type="button"
        class="button button-secondary"
        @click="rejectIncoming"
      >
        Отклонить
      </button>
      <button
        v-show="busy"
        type="button"
        class="button button-secondary"
        @click="store.onPauseFile()"
      >
        Пауза
      </button>
      <button
        v-show="paused"
        type="button"
        class="button"
        @click="store.onResumeFile()"
      >
        Продолжить
      </button>
      <button
        v-show="busy || paused"
        type="button"
        class="button button-secondary"
        @click="store.onCancelFile()"
      >
        Отменить
      </button>
    </div>
    <p v-if="statusText" class="tagline" role="status" aria-live="polite">
      {{ statusText }}
    </p>
    <p v-if="transfer.error" class="error" role="alert">
      {{ transfer.error }}
    </p>
  </fieldset>
</template>
