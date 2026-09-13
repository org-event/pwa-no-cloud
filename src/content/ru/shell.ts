export const shellCopy = {
  checking: 'Проверяем…',
  reloading: 'Есть новая сборка, перезагрузка…',
  confirmCurrent:
    'Сборка уже эта. Сбросить кэш PWA и перезагрузить? На iPhone так подхватывается релиз без удаления.',
  confirmFailed: 'Не удалось проверить версию. Сбросить кэш и перезагрузить?',
  wipingCache: 'Сбрасываем кэш…',
  upToDate: 'Сборка актуальная',
  checkFailed: 'Проверка не удалась',
  checkUpdate: 'Проверить обновление',
  listTitle: 'Разделы',
  listAria: 'Список контактов и разделов',
  contactsTitle: 'Контакты',
  contactsEmpty: 'Пока пусто — добавьте карточку в разделе «Контакты».',
  backToList: 'К списку',
  stubChatsTitle: 'Чаты',
  stubChatsHint: 'Здесь будут диалоги. Пока открывайте контакты выше.',
  stubEmptyTitle: 'Пустой чат',
  stubEmptyText:
    'Заглушка M1: полноценный чат появится позже. Сейчас — контакты, звонки и файлы.',
  sectionHint: 'Раздел',
  openCalls: 'Звонок',
  openContacts: 'Карточка',
  knock: 'Постучаться',
  introduce: 'Представить',
  transferTitle: 'Файлы',
  transferHint:
    'Тот же transfer, что в «Передача» — прямо из сессии с контактом.',
  transferIdle: 'Выберите файлы и отправьте этому контакту.',
  transferStaged: (count: number) =>
    count === 1 ? 'В очереди 1 файл' : `В очереди ${count} файлов`,
  transferSend: 'Отправить',
  transferMore: 'Полная передача',
} as const;
