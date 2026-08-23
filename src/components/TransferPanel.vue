<script setup lang="ts">
import { componentsCopy, transferCopy } from '@/content/index.ts';
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  collectFromDirectory,
  collectFromDrop,
  collectFromFileList,
} from '@/lib/folder-walk.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import {
  fileStatus,
  folderPercent,
  folderStatus,
  formatSizeLabel,
  isOpenFolder,
  transferBytes,
  transferPercent,
} from '@/ui/transfer-status.ts';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import ContactRow from './ContactRow.vue';
import PendingPeer from './PendingPeer.vue';

const store = useNocloudStore();
const { contacts, transfer, state } = storeToRefs(store);

const fileInput = ref<HTMLInputElement | null>(null);
const folderInput = ref<HTMLInputElement | null>(null);
const dragging = ref(false);

const copy = componentsCopy.transfer;

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

const stagedFiles = computed(() => transfer.value.queuedItems);

const stagedFolder = computed(() => {
  if (!transfer.value.queuedFolderName) return null;
  return {
    name: transfer.value.queuedFolderName,
    count: transfer.value.queuedFolderCount,
    bytes: transfer.value.queuedFolderBytes,
  };
});

const hasStaged = computed(
  () => stagedFiles.value.length > 0 || Boolean(stagedFolder.value),
);

const canSend = computed(
  () =>
    hasStaged.value &&
    state.value.selectedContactIds.length > 0 &&
    !blocked.value,
);

const isOnline = (id: string) => store.isPresenceOnline(id);

const sortedContacts = computed(() => {
  const list = [...contacts.value.book.contacts];
  list.sort((a, b) => Number(isOnline(b.id)) - Number(isOnline(a.id)));
  return list;
});

const progress = computed(() => {
  const shownFolder = transfer.value.incomingFolder ?? transfer.value.folder;
  const shownFile = incomingFile.value ?? transfer.value.current;
  if (shownFolder && !shownFile) {
    const percent = folderPercent(shownFolder);
    return {
      percent,
      label: transferCopy.progressLabel(
        percent,
        formatSizeLabel(
          shownFolder.files
            .slice(0, shownFolder.index)
            .reduce((sum, file) => sum + file.size, 0),
        ),
        formatSizeLabel(shownFolder.totalSize),
      ),
      status: folderStatus(shownFolder, null),
    };
  }
  if (shownFile) {
    const bytes = transferBytes(shownFile);
    const percent = transferPercent(shownFile);
    const status = shownFolder
      ? folderStatus(shownFolder, shownFile)
      : fileStatus(shownFile);
    return {
      percent,
      label: transferCopy.progressLabel(
        percent,
        formatSizeLabel(bytes.done),
        formatSizeLabel(bytes.total),
      ),
      status,
    };
  }
  return null;
});

const stageFiles = (files: File[]) => {
  if (files.length === 0) return;
  store.onPickFiles(files);
};

const onPickFile = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (files.length === 0) return;
  stageFiles(files);
};

const onPickFolderLegacy = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (files.length === 0) return;
  const walked = collectFromFileList(files);
  if (!walked.ok) {
    store.onPickError(walked.message);
    return;
  }
  const label = walked.value[0]?.path.split('/')[0] || '';
  store.onPickFolder(walked.value, label);
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
      store.onPickFolder(walked.value, handle.name);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
    }
  }
  folderInput.value?.click();
};

const onDrop = async (event: DragEvent) => {
  dragging.value = false;
  event.preventDefault();
  if (blocked.value) return;
  const walked = await collectFromDrop(event.dataTransfer);
  if (!walked.ok) {
    store.onPickError(walked.message);
    return;
  }
  if (walked.folderName) {
    store.onPickFolder(walked.value, walked.folderName);
    return;
  }
  stageFiles(walked.value.map((item) => item.file));
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
  <div class="card-stack">
    <PendingPeer
      :card="contacts.pending"
      @accept="store.onAcceptPending()"
      @skip="store.onSkipPending()"
    />

    <input
      ref="fileInput"
      type="file"
      class="file-input"
      multiple
      :aria-label="copy.pickFileAria"
      @change="onPickFile"
    />
    <input
      ref="folderInput"
      type="file"
      class="file-input"
      multiple
      webkitdirectory
      directory
      :aria-label="copy.pickFolderAria"
      @change="onPickFolderLegacy"
    />

    <Card :title="copy.filesLegend">
      <div
        class="transfer-drop"
        :data-dragging="String(dragging)"
        :data-blocked="String(blocked)"
        @dragenter.prevent="dragging = true"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop="onDrop"
      >
        <div class="home-actions">
          <button
            type="button"
            class="button"
            :disabled="blocked"
            @click="fileInput?.click()"
          >
            {{ copy.pickFiles }}
          </button>
          <button
            type="button"
            class="button"
            :disabled="blocked"
            @click="pickDirectory()"
          >
            {{ copy.pickFolder }}
          </button>
        </div>
      </div>

      <p v-if="!hasStaged" class="tagline">{{ copy.filesEmpty }}</p>

      <ul v-else class="transfer-staged" aria-live="polite">
        <li
          v-if="stagedFolder"
          class="transfer-staged-item transfer-staged-folder"
        >
          <span class="transfer-staged-name">{{ stagedFolder.name }}</span>
          <span class="tagline">
            {{ copy.folderFiles(stagedFolder.count) }} ·
            {{ formatSizeLabel(stagedFolder.bytes) }}
          </span>
        </li>
        <template v-else>
          <li
            v-for="item in stagedFiles"
            :key="item.key"
            class="transfer-staged-item"
          >
            <span class="transfer-staged-name">{{ item.name }}</span>
            <span class="tagline">{{ formatSizeLabel(item.size) }}</span>
          </li>
        </template>
      </ul>

      <template #actions>
        <button
          v-if="hasStaged"
          type="button"
          class="button button-secondary"
          :disabled="blocked"
          @click="store.onClearStaged()"
        >
          {{ copy.clear }}
        </button>
      </template>
    </Card>

    <Card :title="copy.toLegend">
      <div class="contact-list">
        <p v-if="contacts.book.contacts.length === 0" class="tagline">
          {{ copy.bookEmpty }}
        </p>
        <label
          v-for="contact in sortedContacts"
          :key="contact.id"
          class="choice transfer-to"
        >
          <input
            type="radio"
            name="transfer-to"
            :checked="state.selectedContactIds[0] === contact.id"
            :disabled="blocked"
            @change="store.onSelectContact(contact.id)"
          />
          <ContactRow
            :name="contact.nick"
            :detail="isOnline(contact.id) ? copy.online : copy.offline"
            :online="isOnline(contact.id)"
            :online-label="copy.online"
            :offline-label="copy.offline"
          >
            <template #leading>
              <AvatarImg :id="contact.id" :avatar="contact.avatar" />
            </template>
          </ContactRow>
        </label>
      </div>

      <template #actions>
        <button
          type="button"
          class="button button-accent"
          :disabled="!canSend"
          @click="store.onSendTransfer()"
        >
          {{ copy.send }}
        </button>
        <button
          v-show="needAccept"
          type="button"
          class="button"
          @click="acceptIncoming"
        >
          {{ transfer.incomingFolder ? copy.acceptFolder : copy.acceptFile }}
        </button>
        <button
          v-show="needAccept"
          type="button"
          class="button button-secondary"
          @click="rejectIncoming"
        >
          {{ copy.reject }}
        </button>
        <button
          v-show="busy"
          type="button"
          class="button button-secondary"
          @click="store.onCancelFile()"
        >
          {{ copy.cancel }}
        </button>
      </template>
    </Card>

    <Card v-if="progress || transfer.error" :title="copy.progressLegend">
      <div
        v-if="progress"
        class="transfer-progress"
        role="status"
        aria-live="polite"
      >
        <p class="tagline">{{ progress.status }}</p>
        <div
          class="transfer-progress-track"
          role="progressbar"
          :aria-valuenow="progress.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="transfer-progress-fill"
            :style="{ width: `${progress.percent}%` }"
          />
        </div>
        <p class="tagline">{{ progress.label }}</p>
      </div>
      <p v-if="transfer.error" class="error" role="alert">
        {{ transfer.error }}
      </p>
    </Card>
  </div>
</template>
