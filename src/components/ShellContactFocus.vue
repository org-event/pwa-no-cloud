<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import { contactDisplayName } from '@/domain/profile.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';

const props = defineProps<{
  peerId: string;
}>();

const emit = defineEmits<{
  openCalls: [];
  openBook: [];
}>();

const store = useNocloudStore();
const { contacts } = storeToRefs(store);
const copy = componentsCopy.contacts;

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

const detail = computed(() => {
  if (inChannel.value) return copy.inCall;
  if (online.value) return copy.online;
  return copy.offline;
});

const onKnock = () => {
  void store.onKnockContact(props.peerId);
};
</script>

<template>
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
        <button type="button" class="button button-secondary" @click="onKnock">
          {{ shellCopy.knock }}
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
</template>
