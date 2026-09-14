<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import { contactDisplayName, contactTrustOf } from '@/domain/profile.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';

const props = defineProps<{
  peerId: string;
}>();

const emit = defineEmits<{
  openCalls: [];
  openBook: [];
  openTransfer: [];
}>();

const store = useNocloudStore();
const { contacts, transfer, state } = storeToRefs(store);
const copy = componentsCopy.contacts;
const transferUi = componentsCopy.transfer;
const fileInput = ref<HTMLInputElement | null>(null);

const contact = computed(
  () =>
    contacts.value.book.contacts.find((item) => item.id === props.peerId) ??
    null,
);

const name = computed(() =>
  contact.value ? contactDisplayName(contact.value) : props.peerId.slice(0, 12),
);

const online = computed(() => store.isPresenceOnline(props.peerId));
const inChannel = computed(() => store.isChannelOpen(props.peerId));
const trust = computed(() =>
  contact.value ? contactTrustOf(contact.value) : 'unverified',
);

const detail = computed(() => {
  const mark =
    trust.value === 'met'
      ? copy.trustMet
      : trust.value === 'introduced'
        ? copy.trustIntroduced
        : '';
  const presence = inChannel.value
    ? copy.inCall
    : online.value
      ? copy.online
      : copy.offline;
  return mark ? `${mark} · ${presence}` : presence;
});

const stagedCount = computed(
  () =>
    transfer.value.queuedItems.length +
    (transfer.value.queuedFolderName ? transfer.value.queuedFolderCount : 0),
);

const canSend = computed(
  () =>
    stagedCount.value > 0 &&
    state.value.selectedContactIds.includes(props.peerId),
);

const onKnock = () => {
  void store.onKnockContact(props.peerId);
};

const canIntroduce = computed(() => Boolean(contact.value?.publicKey));

const onIntroduce = () => {
  void store.onIntroduceContact(props.peerId);
};

const onToggleTrust = () => {
  store.onSetContactTrust(
    props.peerId,
    trust.value === 'met' ? 'unverified' : 'met',
  );
};

const ensureSelected = () => {
  store.onSelectContact(props.peerId);
};

const onPickClick = () => {
  ensureSelected();
  fileInput.value?.click();
};

const onFilesChosen = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files ? [...input.files] : [];
  input.value = '';
  if (files.length === 0) return;
  ensureSelected();
  store.onPickFiles(files);
};

const onSend = () => {
  ensureSelected();
  void store.onSendTransfer();
};
</script>

<template>
  <div class="card-stack">
    <Card :title="name" :hint="detail">
      <div class="shell-contact-focus">
        <AvatarImg :id="peerId" :avatar="contact?.avatar || ''" :size="72" />
        <p class="shell-contact-status">
          <span
            class="presence"
            :data-online="String(online)"
            :aria-label="detail"
          />
          {{ detail }}
        </p>
        <div class="shell-contact-actions">
          <button type="button" class="button" @click="emit('openCalls')">
            {{ shellCopy.openCalls }}
          </button>
          <button
            type="button"
            class="button button-secondary"
            @click="onKnock"
          >
            {{ shellCopy.knock }}
          </button>
          <button
            type="button"
            class="button button-secondary"
            :disabled="!canIntroduce"
            @click="onIntroduce"
          >
            {{ shellCopy.introduce }}
          </button>
          <button
            v-if="contact"
            type="button"
            class="button button-secondary"
            @click="onToggleTrust"
          >
            {{ trust === 'met' ? copy.trustClear : copy.trustMet }}
          </button>
          <button
            type="button"
            class="button button-secondary"
            @click="emit('openBook')"
          >
            {{ shellCopy.openContacts }}
          </button>
        </div>
      </div>
    </Card>

    <Card :title="shellCopy.transferTitle" :hint="shellCopy.transferHint">
      <input
        ref="fileInput"
        type="file"
        multiple
        class="shell-file-input"
        :aria-label="transferUi.pickFileAria"
        @change="onFilesChosen"
      />
      <p v-if="stagedCount > 0" class="tagline">
        {{ shellCopy.transferStaged(stagedCount) }}
      </p>
      <p v-else class="tagline">{{ shellCopy.transferIdle }}</p>
      <div class="shell-contact-actions">
        <button type="button" class="button" @click="onPickClick">
          {{ transferUi.pickFiles }}
        </button>
        <button
          type="button"
          class="button button-accent"
          :disabled="!canSend"
          @click="onSend"
        >
          {{ shellCopy.transferSend }}
        </button>
        <button
          type="button"
          class="button button-secondary"
          @click="emit('openTransfer')"
        >
          {{ shellCopy.transferMore }}
        </button>
      </div>
    </Card>
  </div>
</template>
