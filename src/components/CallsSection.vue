<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { primaryCallLeg } from '@/domain/call/index.ts';
import type { MediaCallKind } from '@/stores/nocloud/calls.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import ContactRow from './ContactRow.vue';

const store = useNocloudStore();
const {
  contacts,
  callKind,
  callPeerId,
  callError,
  callSession,
  localMedia,
  remoteMedia,
  micOn,
  camOn,
} = storeToRefs(store);

const copy = componentsCopy.calls;
const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

const leg = computed(() => primaryCallLeg(callSession.value));
const legState = computed(() => leg.value?.state ?? null);
const incomingRinging = computed(
  () => leg.value?.direction === 'in' && legState.value === 'ringing',
);
const inCallUi = computed(
  () =>
    Boolean(callError.value) ||
    Boolean(callKind.value) ||
    incomingRinging.value ||
    legState.value === 'outbound' ||
    (leg.value?.direction === 'out' && legState.value === 'ringing') ||
    legState.value === 'active' ||
    legState.value === 'failed',
);

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
  if (incomingRinging.value) return copy.ringing;
  if (legState.value === 'active' || remoteMedia.value) return copy.active;
  if (
    legState.value === 'outbound' ||
    (leg.value?.direction === 'out' && legState.value === 'ringing')
  ) {
    return copy.calling;
  }
  if (callKind.value) return copy.calling;
  return copy.hint;
});

const contactDetail = (id: string) => {
  if (callPeerId.value === id && inCallUi.value) return copy.inCall;
  if (store.isPresenceOnline(id)) return copy.online;
  return copy.offline;
};

const start = (id: string, kind: MediaCallKind) => {
  void store.onStartCall(id, kind);
};

const busy = computed(() => inCallUi.value);
const canToggleCamera = computed(
  () => callKind.value === 'video' || callKind.value === 'screen',
);

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
      <div v-if="inCallUi" class="call-stage">
        <div class="call-hero">
          <AvatarImg
            v-if="activeContact || callPeerId"
            class="call-hero-avatar"
            :id="activeContact?.id || callPeerId || ''"
            :avatar="activeContact?.avatar || ''"
            :size="72"
          />
          <p class="call-hero-name">
            {{ activeContact?.nick || copy.remoteLabel }}
          </p>
          <p class="call-hero-status">{{ statusText }}</p>
        </div>

        <div v-if="callKind" class="call-tiles">
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
        </div>

        <div class="call-actions">
          <template v-if="incomingRinging">
            <button
              type="button"
              class="button"
              @click="store.onAcceptCall('audio')"
            >
              {{ copy.acceptAudio }}
            </button>
            <button
              type="button"
              class="button"
              @click="store.onAcceptCall('video')"
            >
              {{ copy.acceptVideo }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              @click="store.onRejectCall()"
            >
              {{ copy.reject }}
            </button>
          </template>
          <button
            v-else
            type="button"
            class="button button-accent"
            @click="store.onHangUp()"
          >
            {{ callError ? copy.dismiss : copy.hangUp }}
          </button>
          <template v-if="callKind && !incomingRinging && !callError">
            <button
              type="button"
              class="button button-secondary"
              @click="store.onToggleMute()"
            >
              {{ micOn ? copy.mute : copy.unmute }}
            </button>
            <button
              v-if="canToggleCamera"
              type="button"
              class="button button-secondary"
              @click="store.onToggleCamera()"
            >
              {{ camOn ? copy.cameraOff : copy.cameraOn }}
            </button>
          </template>
        </div>
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
              :disabled="busy"
              @click="start(contact.id, 'audio')"
            >
              {{ copy.audio }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              :disabled="busy"
              @click="start(contact.id, 'video')"
            >
              {{ copy.video }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              :disabled="busy"
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
