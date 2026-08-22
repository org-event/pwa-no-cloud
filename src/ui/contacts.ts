import { avatarSrc } from '../lib/avatar.ts';
import type { AddressBook, ProfileCard } from '../domain/profile.ts';

export type ContactsState = {
  me: ProfileCard;
  book: AddressBook;
  pending: ProfileCard | null;
  notice: string;
};

export type ContactsHandlers = {
  onSaveProfile: (nick: string) => void;
  onPickAvatar: (file: File) => void;
  onClearAvatar: () => void;
  onCopyId: () => void;
  onAddContact: (id: string, nick: string) => void;
  onRemoveContact: (id: string) => void;
  onSaveGroup: (name: string, memberIds: string[]) => void;
  onRemoveGroup: (id: string) => void;
  onAcceptPending: () => void;
  onSkipPending: () => void;
};

const avatarImg = (id: string, avatar: string) => {
  const img = document.createElement('img');
  img.className = 'avatar';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.width = 40;
  img.height = 40;
  img.src = avatarSrc(id, avatar);
  return img;
};

export const mountPendingPeer = (
  root: HTMLElement,
  handlers: Pick<ContactsHandlers, 'onAcceptPending' | 'onSkipPending'>,
) => {
  const pending = document.createElement('fieldset');
  pending.className = 'panel';
  const pendingLegend = document.createElement('legend');
  pendingLegend.textContent = 'Новый человек';
  const pendingBody = document.createElement('div');
  pendingBody.className = 'contact-row';
  const pendingText = document.createElement('p');
  pendingText.className = 'tagline';
  const pendingActions = document.createElement('div');
  pendingActions.className = 'home-actions';
  const accept = document.createElement('button');
  accept.type = 'button';
  accept.className = 'button';
  accept.textContent = 'В адресную книгу';
  accept.addEventListener('click', () => handlers.onAcceptPending());
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.className = 'button button-secondary';
  skip.textContent = 'Не сейчас';
  skip.addEventListener('click', () => handlers.onSkipPending());
  pendingActions.append(accept, skip);
  pending.append(pendingLegend, pendingBody, pendingText, pendingActions);
  root.append(pending);

  return {
    sync(card: ProfileCard | null) {
      pending.hidden = !card;
      pendingBody.replaceChildren();
      if (card) {
        pendingBody.append(avatarImg(card.id, card.avatar));
        pendingText.textContent = `${card.nick} · ${card.id}`;
      } else {
        pendingText.textContent = '';
      }
    },
  };
};

export const mountContacts = (
  root: HTMLElement,
  handlers: ContactsHandlers,
) => {
  const pending = mountPendingPeer(root, handlers);

  const mePanel = document.createElement('fieldset');
  mePanel.className = 'panel';
  const meLegend = document.createElement('legend');
  meLegend.textContent = 'Я';
  const meRow = document.createElement('div');
  meRow.className = 'contact-row';
  const nick = document.createElement('input');
  nick.name = 'nick';
  nick.type = 'text';
  nick.maxLength = 32;
  nick.setAttribute('autocomplete', 'nickname');
  nick.setAttribute('aria-label', 'Ник');
  const nickField = document.createElement('label');
  nickField.className = 'field';
  const nickLabel = document.createElement('span');
  nickLabel.textContent = 'Ник';
  nickField.append(nickLabel, nick);
  const idLine = document.createElement('p');
  idLine.className = 'tagline';
  const meHint = document.createElement('p');
  meHint.className = 'tagline';
  meHint.textContent =
    'Id не меняется. Ник и фото можно сменить — карточка уйдёт по каналу, если связь уже есть.';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.className = 'file-input';
  file.setAttribute('aria-hidden', 'true');
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    file.value = '';
    if (picked) handlers.onPickAvatar(picked);
  });
  const meActions = document.createElement('div');
  meActions.className = 'home-actions';
  const saveMe = document.createElement('button');
  saveMe.type = 'button';
  saveMe.className = 'button';
  saveMe.textContent = 'Сохранить ник';
  saveMe.addEventListener('click', () => handlers.onSaveProfile(nick.value));
  const photo = document.createElement('button');
  photo.type = 'button';
  photo.className = 'button button-secondary';
  photo.textContent = 'Своё фото';
  photo.addEventListener('click', () => file.click());
  const clearPhoto = document.createElement('button');
  clearPhoto.type = 'button';
  clearPhoto.className = 'button button-secondary';
  clearPhoto.textContent = 'Сгенерировать лого';
  clearPhoto.addEventListener('click', () => handlers.onClearAvatar());
  const copyId = document.createElement('button');
  copyId.type = 'button';
  copyId.className = 'button button-secondary';
  copyId.textContent = 'Копировать id';
  copyId.addEventListener('click', () => handlers.onCopyId());
  meActions.append(saveMe, photo, clearPhoto, copyId);
  mePanel.append(meLegend, meRow, nickField, idLine, meHint, meActions, file);

  const addPanel = document.createElement('form');
  addPanel.className = 'panel';
  addPanel.innerHTML = `
    <fieldset>
      <legend>Добавить по id</legend>
      <label class="field"><span>Id</span><input name="id" autocomplete="off" /></label>
      <label class="field"><span>Ник</span><input name="addNick" autocomplete="off" /></label>
      <button class="button" type="submit">Добавить</button>
    </fieldset>
  `;
  addPanel.addEventListener('submit', (event) => {
    event.preventDefault();
    const id = addPanel.elements.namedItem('id') as HTMLInputElement;
    const addNick = addPanel.elements.namedItem('addNick') as HTMLInputElement;
    handlers.onAddContact(id.value, addNick.value);
    id.value = '';
    addNick.value = '';
  });

  const listPanel = document.createElement('fieldset');
  listPanel.className = 'panel';
  const listLegend = document.createElement('legend');
  listLegend.textContent = 'Адресная книга';
  const list = document.createElement('div');
  list.className = 'contact-list';
  listPanel.append(listLegend, list);

  const groupPanel = document.createElement('form');
  groupPanel.className = 'panel';
  groupPanel.innerHTML = `
    <fieldset>
      <legend>Группа</legend>
      <p class="tagline">Локальный ярлык. Канал всё равно 1:1 — ссылку откроет один человек за раз.</p>
      <label class="field"><span>Название</span><input name="groupName" autocomplete="off" /></label>
      <div data-role="group-members"></div>
      <button class="button" type="submit">Сохранить группу</button>
    </fieldset>
  `;
  const groupMembers = groupPanel.querySelector(
    '[data-role="group-members"]',
  ) as HTMLElement;
  const groupList = document.createElement('div');
  groupList.className = 'contact-list';
  groupPanel.append(groupList);
  groupPanel.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = groupPanel.elements.namedItem('groupName') as HTMLInputElement;
    const ids: string[] = [];
    const boxes = groupMembers.querySelectorAll<HTMLInputElement>(
      'input[type=checkbox]',
    );
    for (const box of boxes) {
      if (box.checked) ids.push(box.value);
    }
    handlers.onSaveGroup(name.value, ids);
    name.value = '';
  });

  const notice = document.createElement('p');
  notice.className = 'tagline';

  root.append(mePanel, addPanel, listPanel, groupPanel, notice);

  return {
    sync(state: ContactsState) {
      pending.sync(state.pending);
      meRow.replaceChildren(avatarImg(state.me.id, state.me.avatar));
      if (document.activeElement !== nick) nick.value = state.me.nick;
      idLine.textContent = `id ${state.me.id}`;
      list.replaceChildren();
      if (state.book.contacts.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'tagline';
        empty.textContent = 'Пока пусто. Карточка придёт при первой связи.';
        list.append(empty);
      }
      for (const contact of state.book.contacts) {
        const row = document.createElement('div');
        row.className = 'contact-row';
        const meta = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = contact.nick;
        const sub = document.createElement('p');
        sub.className = 'tagline';
        sub.textContent = contact.id;
        meta.append(title, sub);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-secondary';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', () => {
          handlers.onRemoveContact(contact.id);
        });
        row.append(avatarImg(contact.id, contact.avatar), meta, remove);
        list.append(row);
      }
      groupMembers.replaceChildren();
      for (const contact of state.book.contacts) {
        const row = document.createElement('label');
        row.className = 'choice';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = contact.id;
        const span = document.createElement('span');
        span.textContent = contact.nick;
        row.append(input, span);
        groupMembers.append(row);
      }
      groupList.replaceChildren();
      for (const group of state.book.groups) {
        const row = document.createElement('div');
        row.className = 'contact-row';
        const meta = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = group.name;
        const sub = document.createElement('p');
        sub.className = 'tagline';
        sub.textContent = `${group.memberIds.length} чел.`;
        meta.append(title, sub);
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'button button-secondary';
        remove.textContent = 'Удалить';
        remove.addEventListener('click', () => {
          handlers.onRemoveGroup(group.id);
        });
        row.append(meta, remove);
        groupList.append(row);
      }
      notice.textContent = state.notice;
    },
  };
};
