<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import { contactDisplayName } from '@/domain/profile.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import {
  SHELL_STUBS,
  shellContactId,
  shellSectionItems,
  type ShellNavId,
  type ShellNavItem,
} from '@/ui/shell-nav.ts';
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';

defineProps<{
  activeId: ShellNavId;
}>();

const emit = defineEmits<{
  select: [id: ShellNavId];
}>();

const store = useNocloudStore();
const { contacts } = storeToRefs(store);
const copy = componentsCopy.contacts;

const contactItems = computed((): ShellNavItem[] => {
  const list = [...contacts.value.book.contacts];
  list.sort((a, b) =>
    contactDisplayName(a).localeCompare(contactDisplayName(b), 'ru'),
  );
  return list.map((contact) => {
    const online = store.isPresenceOnline(contact.id);
    const inChannel = store.isChannelOpen(contact.id);
    return {
      id: shellContactId(contact.id),
      title: contactDisplayName(contact),
      detail: inChannel ? copy.inCall : online ? copy.online : copy.offline,
      kind: 'contact' as const,
      peerId: contact.id,
      online,
      avatar: contact.avatar,
    };
  });
});

const sectionItems = computed(() => shellSectionItems());

const onSelect = (id: ShellNavId) => {
  emit('select', id);
};
</script>

<template>
  <div class="shell-list" :aria-label="shellCopy.listAria">
    <p class="shell-list-title">{{ shellCopy.contactsTitle }}</p>
    <ul class="shell-list-rows">
      <li v-if="contactItems.length === 0" class="shell-list-empty">
        <p class="tagline">{{ shellCopy.contactsEmpty }}</p>
      </li>
      <li v-for="item in contactItems" :key="item.id">
        <button
          type="button"
          class="shell-row shell-row-contact"
          data-kind="contact"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="onSelect(item.id)"
        >
          <AvatarImg
            class="shell-row-avatar"
            :id="item.peerId || ''"
            :avatar="item.avatar || ''"
            :size="40"
          />
          <span class="shell-row-text">
            <span class="shell-row-title">
              <span
                class="presence"
                :data-online="String(Boolean(item.online))"
                :aria-label="item.online ? copy.online : copy.offline"
              />
              {{ item.title }}
            </span>
            <span class="shell-row-detail">{{ item.detail }}</span>
          </span>
        </button>
      </li>
    </ul>

    <p class="shell-list-title">{{ shellCopy.listTitle }}</p>
    <ul class="shell-list-rows">
      <li v-for="item in SHELL_STUBS" :key="item.id">
        <button
          type="button"
          class="shell-row"
          data-kind="stub"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="onSelect(item.id)"
        >
          <span class="shell-row-title">{{ item.title }}</span>
          <span class="shell-row-detail">{{ item.detail }}</span>
        </button>
      </li>
      <li v-for="item in sectionItems" :key="item.id">
        <button
          type="button"
          class="shell-row"
          data-kind="section"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="onSelect(item.id)"
        >
          <span class="shell-row-title">{{ item.title }}</span>
          <span class="shell-row-detail">{{ item.detail }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
