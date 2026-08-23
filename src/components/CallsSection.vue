<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import type { MediaCallKind } from '@/stores/nocloud/calls.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import ContactRow from './ContactRow.vue';

const store = useNocloudStore();
const { contacts, callKind, callPeerId, callError, localMedia, remoteMedia } =
  storeToRefs(store);

const copy = componentsCopy.calls;
const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

const sortedContacts = computed(() => {
  const list = [...contacts.value.book.contacts];
  list.sort((a, b) => a.nick.localeCompare(b.nick, 'ru'));
  return list;
});

const activeContact = computed(() => {
  const id = callPeerId.value;
  if (!id) return null;
  return contacts.value.book.contacts.find((item) => item.id === id) ?? null;
});

const statusText = computed(() => {
  if (callError.value) return callError.value;
  if (!callKind.value) return copy.hint;
  if (remoteMedia.value) return copy.active;
  return copy.calling;
});

const contactDetail = (id: string) => {
  if (callPeerId.value === id && callKind.value) return copy.inCall;
  if (store.isPresenceOnline(id)) return copy.online;
  return copy.offline;
};

const start = (id: string, kind: MediaCallKind) => {
  void store.onStartCall(id, kind);
};

watch(
  localMedia,
  (stream) => {
    const el = localVideo.value;
    if (el) el.srcObject = stream;
  },
  { flush: 'post' },
);

watch(
  remoteMedia,
  (stream) => {
    const el = remoteVideo.value;
    if (el) el.srcObject = stream;
  },
  { flush: 'post' },
);

onBeforeUnmount(() => {
  if (localVideo.value) localVideo.value.srcObject = null;
  if (remoteVideo.value) remoteVideo.value.srcObject = null;
});
</script>

<template>
  <div class="card-stack">
    <Card title="Звонок" :hint="statusText">
      <div v-if="callKind" class="call-stage">
        <div class="call-tile call-tile-remote">
          <video
            ref="remoteVideo"
            class="call-video"
            autoplay
            playsinline
            :aria-label="copy.remoteLabel"
          />
          <p class="call-tile-label">
            {{ activeContact?.nick || copy.remoteLabel }}
          </p>
        </div>
        <div class="call-tile call-tile-local">
          <video
            ref="localVideo"
            class="call-video"
            autoplay
            muted
            playsinline
            :aria-label="copy.localLabel"
          />
          <p class="call-tile-label">{{ copy.localLabel }}</p>
        </div>
        <button
          type="button"
          class="button button-accent"
          @click="store.onHangUp()"
        >
          {{ copy.hangUp }}
        </button>
      </div>
      <p v-else class="tagline">{{ copy.hint }}</p>
    </Card>

    <Card title="Кому">
      <p v-if="sortedContacts.length === 0" class="tagline">
        {{ copy.bookEmpty }}
      </p>
      <div v-else class="call-book">
        <ContactRow
          v-for="contact in sortedContacts"
          :key="contact.id"
          :name="contact.nick"
          :detail="contactDetail(contact.id)"
          :online="store.isPresenceOnline(contact.id)"
          :online-label="copy.online"
          :offline-label="copy.offline"
        >
          <template #leading>
            <AvatarImg :id="contact.id" :avatar="contact.avatar" />
          </template>
          <template #actions>
            <button
              type="button"
              class="button button-secondary"
              :disabled="Boolean(callKind)"
              @click="start(contact.id, 'audio')"
            >
              {{ copy.audio }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              :disabled="Boolean(callKind)"
              @click="start(contact.id, 'video')"
            >
              {{ copy.video }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              :disabled="Boolean(callKind)"
              @click="start(contact.id, 'screen')"
            >
              {{ copy.screen }}
            </button>
          </template>
        </ContactRow>
      </div>
    </Card>
  </div>
</template>
