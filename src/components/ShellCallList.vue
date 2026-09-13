<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import { contactDisplayName } from '@/domain/profile.ts';
import type { CallLogEntry, CallLogOutcome } from '@/lib/call-log.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';

defineProps<{
  activePeerId: string | null;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const store = useNocloudStore();
const { contacts, callLog } = storeToRefs(store);

const outcomeLabel = (outcome: CallLogOutcome) => {
  if (outcome === 'missed') return shellCopy.callMissed;
  if (outcome === 'failed') return shellCopy.callFailed;
  if (outcome === 'rejected') return shellCopy.callRejected;
  if (outcome === 'ended' || outcome === 'answered') return shellCopy.callEnded;
  return '';
};

const rows = computed(() => {
  const book = contacts.value.book.contacts;
  return callLog.value.map((entry: CallLogEntry) => {
    const contact = book.find((item) => item.id === entry.peerId);
    const name = contact
      ? contactDisplayName(contact)
      : entry.peerId.slice(0, 12);
    const dir =
      entry.direction === 'in'
        ? shellCopy.callIncoming
        : shellCopy.callOutgoing;
    const outcome = outcomeLabel(entry.outcome);
    return {
      ...entry,
      name,
      avatar: contact?.avatar || '',
      detail: [dir, outcome].filter(Boolean).join(' · '),
      online: store.isPresenceOnline(entry.peerId),
    };
  });
});
</script>

<template>
  <div class="shell-list" :aria-label="shellCopy.callsTitle">
    <p class="shell-list-title">{{ shellCopy.callsTitle }}</p>
    <ul class="shell-list-rows">
      <li v-if="rows.length === 0" class="shell-list-empty">
        <p class="tagline">{{ shellCopy.callsEmpty }}</p>
      </li>
      <li v-for="item in rows" :key="item.id">
        <button
          type="button"
          class="shell-row shell-row-contact"
          data-kind="call"
          :aria-current="activePeerId === item.peerId ? 'page' : undefined"
          @click="emit('select', item.peerId)"
        >
          <AvatarImg
            class="shell-row-avatar"
            :id="item.peerId"
            :avatar="item.avatar"
            :size="40"
          />
          <span class="shell-row-text">
            <span class="shell-row-title">
              <span
                class="presence"
                :data-online="String(item.online)"
                :aria-label="
                  item.online
                    ? componentsCopy.contacts.online
                    : componentsCopy.contacts.offline
                "
              />
              {{ item.name }}
            </span>
            <span class="shell-row-detail">{{ item.detail }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
