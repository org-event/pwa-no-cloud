<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import type { ChatStoredMessage } from '@/domain/chat/index.ts';
import { contactDisplayName } from '@/domain/profile.ts';
import type { UnlockedIdentity } from '@/lib/identity-session.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { isSelfPeer } from '@/ui/shell-nav.ts';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';

const props = defineProps<{
  peerId: string;
  identity: UnlockedIdentity;
  showBack?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  openCalls: [];
  openBook: [];
  openTransfer: [];
}>();

const store = useNocloudStore();
const { contacts, peerRevision, state } = storeToRefs(store);

const messages = ref<ChatStoredMessage[]>([]);
const draft = ref('');
const scroller = ref<HTMLElement | null>(null);
const composer = ref<HTMLElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);
const composerPad = ref('4.5rem');

const COMPOSER_MAX_LINES = 6;

const syncComposerPad = () => {
  const el = composer.value;
  if (!el) return;
  composerPad.value = `${el.offsetHeight}px`;
};

const resizeInput = () => {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  const styles = getComputedStyle(el);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22;
  const padY =
    Number.parseFloat(styles.paddingTop) +
    Number.parseFloat(styles.paddingBottom);
  const maxH = lineHeight * COMPOSER_MAX_LINES + padY;
  const scrollH = el.scrollHeight;
  el.style.height = `${Math.min(scrollH, maxH)}px`;
  el.style.overflowY = scrollH > maxH + 1 ? 'auto' : 'hidden';
  syncComposerPad();
};

let composerRo: ResizeObserver | null = null;

onMounted(() => {
  resizeInput();
  if (typeof ResizeObserver === 'function' && composer.value) {
    composerRo = new ResizeObserver(() => syncComposerPad());
    composerRo.observe(composer.value);
  }
});

onUnmounted(() => {
  composerRo?.disconnect();
  composerRo = null;
});

const isSelf = computed(() => isSelfPeer(props.peerId));

const contact = computed(
  () =>
    contacts.value.book.contacts.find((item) => item.id === props.peerId) ??
    null,
);

const name = computed(() => {
  if (isSelf.value) return shellCopy.selfChatTitle;
  return contact.value
    ? contactDisplayName(contact.value)
    : props.peerId.slice(0, 12);
});

const online = computed(() =>
  isSelf.value ? true : store.isPresenceOnline(props.peerId),
);
const presenceCopy = componentsCopy.contacts;

const channelOpen = computed(
  () => isSelf.value || store.isChannelOpen(props.peerId),
);

const reload = () => {
  void peerRevision.value;
  void state.value.chat;
  messages.value = store.listChatMessages(props.peerId);
};

const scrollToEnd = async () => {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
};

watch(
  () => [props.peerId, peerRevision.value] as const,
  () => {
    reload();
    void scrollToEnd();
    void nextTick(resizeInput);
  },
  { immediate: true },
);

watch(
  () => props.peerId,
  () => {
    draft.value = '';
  },
);

watch(draft, () => {
  void nextTick(resizeInput);
});

const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

const onSend = () => {
  const text = draft.value.trim();
  if (!text) return;
  if (!isSelf.value) store.onSelectContact(props.peerId);
  void store.onSendChat(props.peerId, text).then((ok) => {
    if (!ok) return;
    draft.value = '';
    reload();
    void nextTick(() => {
      resizeInput();
      void scrollToEnd();
    });
  });
};
</script>

<template>
  <div class="chat-thread">
    <header class="shell-pane-head chat-thread-head">
      <button
        v-if="showBack"
        type="button"
        class="icon-button"
        :aria-label="shellCopy.backToList"
        @click="emit('back')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
          class="icon"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 6l-6 6 6 6"
          />
        </svg>
      </button>

      <AvatarImg :id="peerId" :avatar="contact?.avatar || ''" :size="40" />
      <div class="chat-thread-meta">
        <p class="chat-thread-name">{{ name }}</p>
        <p class="chat-thread-status">
          <template v-if="isSelf">{{ shellCopy.selfChatDetail }}</template>
          <template v-else>
            <span
              class="presence"
              :data-online="String(online)"
              :aria-label="online ? presenceCopy.online : presenceCopy.offline"
            />
            {{ online ? presenceCopy.online : presenceCopy.offline }}
          </template>
        </p>
      </div>
      <div v-if="!isSelf" class="chat-thread-actions">
        <button
          type="button"
          class="button button-secondary"
          @click="emit('openCalls')"
        >
          {{ shellCopy.openCalls }}
        </button>
        <button
          type="button"
          class="button button-secondary"
          @click="emit('openTransfer')"
        >
          {{ shellCopy.transferTitle }}
        </button>
        <button
          type="button"
          class="button button-secondary"
          @click="emit('openBook')"
        >
          {{ shellCopy.openContacts }}
        </button>
      </div>
    </header>

    <div
      ref="scroller"
      class="chat-thread-scroll"
      role="log"
      aria-live="polite"
      :style="{ paddingBottom: composerPad }"
    >
      <div v-if="messages.length === 0" class="chat-thread-empty">
        <p class="chat-thread-empty-title">{{ shellCopy.chatEmptyTitle }}</p>
        <p class="tagline">
          {{ isSelf ? shellCopy.selfChatHint : shellCopy.chatEmptyHint }}
        </p>
      </div>
      <ul v-else class="chat-thread-messages">
        <li
          v-for="msg in messages"
          :key="msg.id"
          class="chat-bubble"
          :data-direction="msg.direction"
        >
          <p class="chat-bubble-text">{{ msg.text }}</p>
          <time
            class="chat-bubble-time"
            :datetime="new Date(msg.ts).toISOString()"
          >
            {{ formatTime(msg.ts) }}
          </time>
        </li>
      </ul>
      <p v-if="!isSelf" class="chat-thread-note tagline">
        {{ channelOpen ? shellCopy.chatLocalOnly : shellCopy.chatQueuedLocal }}
      </p>
      <p v-else class="chat-thread-note tagline">
        {{ shellCopy.selfChatHint }}
      </p>
    </div>

    <form ref="composer" class="chat-composer" @submit.prevent="onSend">
      <label class="visually-hidden" for="chat-composer-input">
        {{ shellCopy.chatComposerLabel }}
      </label>
      <textarea
        id="chat-composer-input"
        ref="inputEl"
        v-model="draft"
        class="chat-composer-input"
        rows="1"
        :placeholder="shellCopy.chatComposerPlaceholder"
        maxlength="4000"
        @input="resizeInput"
        @keydown.enter.exact.prevent="onSend"
      />
      <button type="submit" class="button" :disabled="!draft.trim()">
        {{ shellCopy.chatSend }}
      </button>
    </form>
  </div>
</template>
