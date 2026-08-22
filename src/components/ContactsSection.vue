<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useNocloudStore } from '../stores/nocloud.ts';
import AvatarImg from './AvatarImg.vue';
import PendingPeer from './PendingPeer.vue';

const store = useNocloudStore();
const { contacts } = storeToRefs(store);

const nick = ref(contacts.value.me.nick);
const addCard = ref('');
const groupName = ref('');
const groupMemberIds = ref<string[]>([]);
const avatarInput = ref<HTMLInputElement | null>(null);

const onNickFocus = () => {
  nick.value = contacts.value.me.nick;
};

const onSaveNick = () => {
  store.onSaveProfile(nick.value);
};

const onPickAvatar = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) store.onPickAvatar(file);
};

const onAddContact = (event: Event) => {
  event.preventDefault();
  if (store.onAddContact(addCard.value)) addCard.value = '';
};

const onSaveGroup = (event: Event) => {
  event.preventDefault();
  store.onSaveGroup(groupName.value, groupMemberIds.value);
  groupName.value = '';
  groupMemberIds.value = [];
};

const toggleGroupMember = (id: string, checked: boolean) => {
  groupMemberIds.value = checked
    ? [...groupMemberIds.value, id]
    : groupMemberIds.value.filter((item) => item !== id);
};
</script>

<template>
  <PendingPeer
    :card="contacts.pending"
    @accept="store.onAcceptPending()"
    @skip="store.onSkipPending()"
  />

  <fieldset class="panel">
    <legend>Я</legend>
    <div class="contact-row">
      <AvatarImg :id="contacts.me.id" :avatar="contacts.me.avatar" />
    </div>
    <label class="field">
      <span>Ник</span>
      <input
        v-model="nick"
        name="nick"
        type="text"
        maxlength="32"
        autocomplete="nickname"
        aria-label="Ник"
        @focus="onNickFocus"
      />
    </label>
    <p class="tagline">
      Сгенерируйте карточку и ждите. Второй только вставляет её у себя — сам
      «Сгенерировать» не жмёт, пока вы ждёте.
    </p>
    <label class="field">
      <span>{{
        contacts.cardText
          ? 'Эту карточку отправьте второму'
          : 'Карточка появится после «Сгенерировать»'
      }}</span>
      <input
        :value="contacts.cardText"
        type="text"
        readonly
        autocomplete="off"
        aria-label="Ваша карточка контакта"
      />
    </label>
    <div class="home-actions">
      <button type="button" class="button button-secondary" @click="onSaveNick">
        Сохранить ник
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="avatarInput?.click()"
      >
        Своё фото
      </button>
      <button
        type="button"
        class="button button-secondary"
        @click="store.onClearAvatar()"
      >
        Сгенерировать лого
      </button>
      <button
        type="button"
        :class="
          contacts.waiting ? 'button button-secondary' : 'button button-accent'
        "
        @click="store.onGenerateCard()"
      >
        {{ contacts.waiting ? 'Ждём второго' : 'Сгенерировать' }}
      </button>
      <button
        type="button"
        :class="
          contacts.cardText ? 'button button-accent' : 'button button-secondary'
        "
        :disabled="!contacts.cardText"
        @click="store.onCopyCard()"
      >
        Копировать
      </button>
    </div>
    <input
      ref="avatarInput"
      type="file"
      accept="image/*"
      class="file-input"
      aria-hidden="true"
      @change="onPickAvatar"
    />
  </fieldset>

  <form class="panel" @submit="onAddContact">
    <fieldset>
      <legend>Добавить контакт</legend>
      <p class="tagline">
        Вставьте карточку, которую прислали, и нажмите «Добавить» — человек
        сразу в списке.
      </p>
      <label class="field">
        <span>Карточка</span>
        <input
          v-model="addCard"
          name="card"
          autocomplete="off"
          placeholder="C1.{…}"
          aria-label="Карточка контакта"
        />
      </label>
      <button class="button" type="submit">Добавить</button>
    </fieldset>
  </form>

  <fieldset class="panel">
    <legend>Контакты</legend>
    <div class="contact-list">
      <p v-if="contacts.book.contacts.length === 0" class="tagline">
        Пока пусто. Вставьте чужую карточку выше — сразу появится здесь.
      </p>
      <div
        v-for="contact in contacts.book.contacts"
        :key="contact.id"
        class="contact-row"
      >
        <AvatarImg :id="contact.id" :avatar="contact.avatar" />
        <div>
          <div class="contact-name">
            <span
              class="presence"
              :data-online="
                String(contacts.connected && contacts.livePeerId === contact.id)
              "
              :aria-label="
                contacts.connected && contacts.livePeerId === contact.id
                  ? 'в сети'
                  : 'не в сети'
              "
              :title="
                contacts.connected && contacts.livePeerId === contact.id
                  ? 'в сети'
                  : 'не в сети'
              "
            />
            <strong>{{ contact.nick }}</strong>
          </div>
          <p class="tagline">
            {{
              contacts.connected && contacts.livePeerId === contact.id
                ? 'в сети'
                : 'не в сети'
            }}
          </p>
        </div>
        <button
          type="button"
          class="button button-secondary"
          @click="store.onRemoveContact(contact.id)"
        >
          Удалить
        </button>
      </div>
    </div>
  </fieldset>

  <form class="panel" @submit="onSaveGroup">
    <fieldset>
      <legend>Группа</legend>
      <p class="tagline">Локальный ярлык. Канал всё равно 1:1.</p>
      <label class="field">
        <span>Название</span>
        <input v-model="groupName" name="groupName" autocomplete="off" />
      </label>
      <div data-role="group-members">
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
      <button class="button" type="submit">Сохранить группу</button>
    </fieldset>
    <div class="contact-list">
      <div
        v-for="group in contacts.book.groups"
        :key="group.id"
        class="contact-row"
      >
        <div>
          <strong>{{ group.name }}</strong>
          <p class="tagline">{{ group.memberIds.length }} чел.</p>
        </div>
        <button
          type="button"
          class="button button-secondary"
          @click="store.onRemoveGroup(group.id)"
        >
          Удалить
        </button>
      </div>
    </div>
  </form>

  <p class="tagline" role="status">{{ contacts.notice }}</p>
</template>
