<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { mixedContentBlocksSignaling } from '@/lib/signaling/mixed-content.ts';
import { expandRecipients } from '@/domain/profile.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import {
  formatHomeLead,
  formatHomeWait,
  formatRecipientHint,
  formatShareButton,
} from '@/ui/home.ts';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import InputAction from './InputAction.vue';
import PendingPeer from './PendingPeer.vue';

const store = useNocloudStore();
const { contacts, invite, resolved, session, shareUrl, state } =
  storeToRefs(store);

const pasteLink = ref('');

const homeState = computed(() => {
  const servers = resolved.value;
  const manual = invite.value.mode === 'manual';
  const hasTurn = servers.ok && servers.value.hasTurn;
  const socketBlocked =
    servers.ok &&
    Boolean(servers.value.signaling.url) &&
    mixedContentBlocksSignaling(servers.value.signaling.url ?? '');
  const waiting =
    session.value.state === 'signaling' || session.value.state === 'connecting';
  const connected = session.value.state === 'connected';
  return {
    manual,
    hasTurn,
    socketBlocked,
    waiting,
    connected,
    fromLink: state.value.openedFromLink,
    role: invite.value.role,
    shareUrl: shareUrl.value,
    peerNick: state.value.peerNick,
    queuedCount: store.transfer.queuedNames.length,
    error: invite.value.error,
    me: contacts.value.me,
    book: contacts.value.book,
    pending: contacts.value.pending,
    selectedContactIds: state.value.selectedContactIds,
    selectedGroupIds: state.value.selectedGroupIds,
  };
});

const lead = computed(() => formatHomeLead(homeState.value));
const wait = computed(() => formatHomeWait(homeState.value));

const shareButtonLabel = computed(() =>
  formatShareButton({
    contacts: contacts.value.book.contacts.filter((item) =>
      state.value.selectedContactIds.includes(item.id),
    ),
    groups: contacts.value.book.groups.filter((item) =>
      state.value.selectedGroupIds.includes(item.id),
    ),
  }),
);

const recipientHint = computed(() =>
  formatRecipientHint(
    expandRecipients(
      contacts.value.book,
      state.value.selectedContactIds,
      state.value.selectedGroupIds,
    ).length,
  ),
);

const copy = componentsCopy.home;

const submitPaste = () => {
  store.onPasteLink(pasteLink.value);
};
</script>

<template>
  <PendingPeer
    :card="contacts.pending"
    @accept="store.onAcceptPending()"
    @skip="store.onSkipPending()"
  />

  <Card :title="copy.legend" :hint="lead">
    <div class="home-actions">
      <a href="#contacts" class="button button-accent">{{
        copy.openContacts
      }}</a>
    </div>

    <ol class="home-steps">
      <li>{{ copy.stepPickFile }}</li>
      <li>{{ copy.stepGetLink }}</li>
      <li>{{ copy.stepSendLink }}</li>
    </ol>

    <p
      class="status-line home-wait"
      role="status"
      :data-waiting="String(homeState.waiting)"
      :data-connected="String(homeState.connected)"
    >
      {{ wait }}
    </p>

    <InputAction
      :model-value="shareUrl"
      :label="shareUrl ? copy.shareUrlReady : copy.shareUrlPending"
      readonly
      :input-aria-label="copy.shareUrlAria"
      icon="copy"
      :tooltip="copy.copyLink"
      :disabled="!shareUrl"
      @action="store.onCopyShareUrl()"
    />

    <div class="home-actions">
      <button
        type="button"
        :class="shareUrl ? 'button button-secondary' : 'button button-accent'"
        :disabled="state.openedFromLink"
        @click="store.onShareRoom()"
      >
        {{ shareButtonLabel }}
      </button>
    </div>

    <InputAction
      v-model="pasteLink"
      :label="copy.pasteLabel"
      :placeholder="copy.pastePlaceholder"
      :input-aria-label="copy.pasteAria"
      :button-label="copy.acceptLink"
      :tooltip="copy.acceptLink"
      button-class="button"
      @action="submitPaste"
      @enter="submitPaste"
    />

    <div class="contact-row">
      <AvatarImg :id="contacts.me.id" :avatar="contacts.me.avatar" />
      <div>
        <strong>{{ contacts.me.nick }}</strong>
        <p class="tagline">id {{ contacts.me.id }}</p>
      </div>
    </div>
    <button
      type="button"
      class="button button-secondary"
      @click="store.onCopyId()"
    >
      {{ copy.copyId }}
    </button>

    <fieldset class="contact-pick">
      <legend>{{ copy.recipientLegend }}</legend>
      <p class="tagline">{{ recipientHint }}</p>
      <div class="contact-list">
        <p
          v-if="
            contacts.book.contacts.length === 0 &&
            contacts.book.groups.length === 0
          "
          class="tagline"
        >
          {{ copy.bookEmpty }}
        </p>
        <label
          v-for="contact in contacts.book.contacts"
          :key="contact.id"
          class="choice"
        >
          <input
            type="checkbox"
            :checked="state.selectedContactIds.includes(contact.id)"
            @change="store.onToggleContact(contact.id)"
          />
          <AvatarImg :id="contact.id" :avatar="contact.avatar" />
          {{ contact.nick }}
        </label>
        <label
          v-for="group in contacts.book.groups"
          :key="group.id"
          class="choice"
        >
          <input
            type="checkbox"
            :checked="state.selectedGroupIds.includes(group.id)"
            @change="store.onToggleGroup(group.id)"
          />
          <span>{{ copy.groupLabel(group.name, group.memberIds.length) }}</span>
        </label>
      </div>
    </fieldset>

    <p v-if="homeState.error" class="error" role="alert">
      {{ homeState.error }}
    </p>

    <template #actions>
      <button type="button" class="button" @click="store.onCreateInvite()">
        {{ copy.createInvite }}
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="store.onJoin()"
      >
        {{ copy.openedForeignInvite }}
      </button>
    </template>
  </Card>
</template>
