<script setup lang="ts">
import { componentsCopy, shellCopy } from '@/content/index.ts';
import { contactDisplayName, contactTrustOf } from '@/domain/profile.ts';
import { useNocloudStore } from '@/stores/nocloud.ts';
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import AvatarImg from './AvatarImg.vue';
import InputAction from './InputAction.vue';

defineProps<{
  activeId: string | null;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const store = useNocloudStore();
const { contacts } = storeToRefs(store);
const copy = componentsCopy.contacts;
const addCard = ref('');

onMounted(() => {
  void store.seedDemoContacts();
});

const rows = computed(() => {
  const list = [...contacts.value.book.contacts];
  list.sort((a, b) =>
    contactDisplayName(a).localeCompare(contactDisplayName(b), 'ru'),
  );
  return list.map((contact) => {
    const online = store.isPresenceOnline(contact.id);
    const inChannel = store.isChannelOpen(contact.id);
    const trust = contactTrustOf(contact);
    const mark =
      trust === 'met'
        ? copy.trustMet
        : trust === 'introduced'
          ? copy.trustIntroduced
          : '';
    const presence = inChannel
      ? copy.inCall
      : online
        ? copy.online
        : copy.offline;
    return {
      id: contact.id,
      title: contactDisplayName(contact),
      detail: mark ? `${mark} · ${presence}` : presence,
      online,
      avatar: contact.avatar,
    };
  });
});

const onAdd = async () => {
  if (await store.onAddContact(addCard.value)) addCard.value = '';
};
</script>

<template>
  <div class="shell-list" :aria-label="copy.listLegend">
    <div class="shell-list-pinned">
      <p class="shell-list-title">{{ shellCopy.tabProfile }}</p>
      <InputAction
        v-model="addCard"
        class="shell-list-add"
        :label="copy.cardField"
        name="profile-card"
        placeholder="P1. / I1."
        :input-aria-label="copy.cardFieldAria"
        icon="plus"
        :tooltip="copy.add"
        @action="onAdd"
        @enter="onAdd"
      />
    </div>
    <ul class="shell-list-rows">
      <li v-if="rows.length === 0" class="shell-list-empty">
        <p class="tagline">{{ copy.listEmpty }}</p>
      </li>
      <li v-for="item in rows" :key="item.id">
        <button
          type="button"
          class="shell-row shell-row-contact"
          data-kind="contact"
          :aria-current="activeId === item.id ? 'page' : undefined"
          @click="emit('select', item.id)"
        >
          <AvatarImg
            class="shell-row-avatar"
            :id="item.id"
            :avatar="item.avatar || ''"
            :size="40"
          />
          <span class="shell-row-text">
            <span class="shell-row-title">
              <span
                class="presence"
                :data-online="String(item.online)"
                :aria-label="item.online ? copy.online : copy.offline"
              />
              {{ item.title }}
            </span>
            <span class="shell-row-detail">{{ item.detail }}</span>
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
