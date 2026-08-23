<script setup lang="ts">
import { componentsCopy } from '@/content/index.ts';
import { onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '@/stores/nocloud.ts';
import AvatarImg from './AvatarImg.vue';
import Card from './Card.vue';
import ContactRow from './ContactRow.vue';
import InputAction from './InputAction.vue';
import PendingPeer from './PendingPeer.vue';

const store = useNocloudStore();
const { contacts, hasSignalingSocket } = storeToRefs(store);

const nick = ref(contacts.value.me.nick);
const addCard = ref('');
const groupName = ref('');
const groupMemberIds = ref<string[]>([]);
const avatarInput = ref<HTMLInputElement | null>(null);
const editing = ref(false);

const copy = componentsCopy.contacts;

onMounted(() => {
  void store.seedDemoContacts();
});

const onSaveNick = () => {
  store.onSaveProfile(nick.value);
};

const toggleEdit = () => {
  if (!editing.value) nick.value = contacts.value.me.nick;
  editing.value = !editing.value;
};

const onPickAvatar = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) store.onPickAvatar(file);
};

const onAddContact = () => {
  if (store.onAddContact(addCard.value)) addCard.value = '';
};

const onSaveGroup = () => {
  store.onSaveGroup(groupName.value, groupMemberIds.value);
  groupName.value = '';
  groupMemberIds.value = [];
};

const toggleGroupMember = (id: string, checked: boolean) => {
  groupMemberIds.value = checked
    ? [...groupMemberIds.value, id]
    : groupMemberIds.value.filter((item) => item !== id);
};

const isOnline = (id: string) => store.isPresenceOnline(id);

const contactDetail = (id: string) => {
  if (store.isChannelOpen(id)) return copy.inCall;
  if (store.isPresenceOnline(id)) return copy.online;
  return copy.offline;
};
</script>

<template>
  <div class="card-stack">
    <PendingPeer
      :card="contacts.pending"
      @accept="store.onAcceptPending()"
      @skip="store.onSkipPending()"
    />

    <p v-if="!hasSignalingSocket" class="error panel-banner" role="alert">
      {{ copy.needS1Before }}
      <a href="#servers">{{ copy.needS1Link }}</a>
      {{ copy.needS1After }}
    </p>

    <Card :title="copy.meLegend" :hint="copy.availableHint">
      <ContactRow
        :name="contacts.me.nick || copy.nick"
        :detail="contacts.presenceAvailable ? copy.online : copy.offline"
        :online="contacts.presenceAvailable"
        :online-label="copy.online"
        :offline-label="copy.offline"
      >
        <template #leading>
          <AvatarImg :id="contacts.me.id" :avatar="contacts.me.avatar" />
        </template>
        <template #actions>
          <button
            type="button"
            class="icon-button"
            :title="copy.edit"
            :aria-label="copy.edit"
            :aria-expanded="editing"
            @click="toggleEdit"
          >
            <svg
              class="icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"
              />
            </svg>
          </button>
        </template>
      </ContactRow>
      <div v-show="editing" class="profile-edit">
        <InputAction
          v-model="nick"
          :label="copy.nick"
          name="nick"
          type="text"
          :maxlength="32"
          autocomplete="nickname"
          :input-aria-label="copy.nickAria"
          icon="check"
          :tooltip="copy.saveNick"
          @action="onSaveNick"
          @enter="onSaveNick"
        />
        <button
          type="button"
          class="button button-secondary"
          @click="avatarInput?.click()"
        >
          {{ copy.pickPhoto }}
        </button>
      </div>
      <div class="home-actions">
        <button
          v-if="!contacts.presenceAvailable"
          type="button"
          class="button button-accent"
          :disabled="!hasSignalingSocket"
          @click="store.onStartPresence()"
        >
          {{ copy.goAvailable }}
        </button>
        <button
          v-else
          type="button"
          class="button button-secondary"
          @click="store.onStopPresence()"
        >
          {{ copy.goUnavailable }}
        </button>
      </div>
      <InputAction
        :model-value="contacts.cardText"
        :label="copy.cardReady"
        readonly
        :input-aria-label="copy.cardAria"
        icon="copy"
        :tooltip="copy.copy"
        :disabled="!contacts.cardText"
        @action="store.onCopyCard()"
      />
      <input
        ref="avatarInput"
        type="file"
        accept="image/*"
        class="file-input"
        aria-hidden="true"
        @change="onPickAvatar"
      />
    </Card>

    <Card :title="copy.addLegend" :hint="copy.addHint">
      <InputAction
        v-model="addCard"
        :label="copy.cardField"
        name="card"
        placeholder="C1.{…}"
        :input-aria-label="copy.cardFieldAria"
        icon="plus"
        :tooltip="copy.add"
        @action="onAddContact"
        @enter="onAddContact"
      />
    </Card>

    <Card :title="copy.listLegend">
      <div class="contact-list">
        <p v-if="contacts.book.contacts.length === 0" class="tagline">
          {{ copy.listEmpty }}
        </p>
        <ContactRow
          v-for="contact in contacts.book.contacts"
          :key="contact.id"
          :name="contact.nick"
          :detail="contactDetail(contact.id)"
          :online="isOnline(contact.id)"
          :online-label="copy.online"
          :offline-label="copy.offline"
        >
          <template #leading>
            <AvatarImg :id="contact.id" :avatar="contact.avatar" />
          </template>
          <template #actions>
            <button
              type="button"
              class="button button-accent"
              :disabled="!hasSignalingSocket"
              @click="store.onKnockContact(contact.id)"
            >
              {{ copy.knock }}
            </button>
            <button
              type="button"
              class="button button-secondary"
              @click="store.onRemoveContact(contact.id)"
            >
              {{ copy.remove }}
            </button>
          </template>
        </ContactRow>
      </div>
    </Card>

    <Card :title="copy.groupLegend" :hint="copy.groupHint">
      <InputAction
        v-model="groupName"
        :label="copy.groupName"
        name="groupName"
        icon="plus"
        :tooltip="copy.saveGroup"
        @action="onSaveGroup"
        @enter="onSaveGroup"
      />
      <div class="contact-pick" data-role="group-members">
        <label
          v-for="contact in contacts.book.contacts"
          :key="contact.id"
          class="choice"
        >
          <input
            type="checkbox"
            :value="contact.id"
            :checked="groupMemberIds.includes(contact.id)"
            @change="
              toggleGroupMember(
                contact.id,
                ($event.target as HTMLInputElement).checked,
              )
            "
          />
          <span>{{ contact.nick }}</span>
        </label>
      </div>
      <div class="contact-list">
        <ContactRow
          v-for="group in contacts.book.groups"
          :key="group.id"
          :name="group.name"
          :detail="copy.groupMembers(group.memberIds.length)"
        >
          <template #actions>
            <button
              type="button"
              class="button button-secondary"
              @click="store.onRemoveGroup(group.id)"
            >
              {{ copy.remove }}
            </button>
          </template>
        </ContactRow>
      </div>
    </Card>

    <p
      class="tagline"
      :class="{ error: contacts.notice.includes('S1') }"
      role="status"
    >
      {{ contacts.notice }}
    </p>
  </div>
</template>
