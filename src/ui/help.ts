export type HelpItem = {
  name: string;
  text: string;
};

export type HelpTopic = {
  id: string;
  title: string;
  href?: string;
  lead: string;
  items: HelpItem[];
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'what',
    title: 'Что это',
    lead: 'NoCloud — обмен файлами напрямую между устройствами. Байты идут по WebRTC, не через наш облачный диск. Сервер нужен только чтобы познакомить клиентов и, если сеть режет прямой путь, как ваш TURN.',
    items: [
      {
        name: 'Без аккаунта',
        text: 'Нет регистрации. Канал живёт, пока открыты оба окна.',
      },
      {
        name: 'PWA',
        text: 'Установите на домашний экран. После нового релиза на iPhone нажмите круговую стрелку в шапке — «Проверить обновление». Если не подхватилось, подтвердите сброс кэша. Удалять иконку не нужно.',
      },
    ],
  },
  {
    id: 'links',
    title: 'Ссылки, как у Telegram',
    lead: 'Настоящий tg:// может только нативное приложение. У PWA так: HTTPS-ссылка работает везде (WhatsApp, Telegram, почта). После установки в Chrome/Android ещё и схема web+nocloud://. iOS почти всегда откроет Safari; оттуда можно «На экран Домой».',
    items: [
      {
        name: 'HTTPS',
        text: 'https://…/pwa-no-cloud/#j/… — приглашение, #a/… — ответ, #r/комната — войти в одну комнату, #s/S1.… — пакет серверов, #help — эта справка.',
      },
      {
        name: 'web+nocloud://',
        text: 'Как tg://, но только если PWA установлено в Chromium. Пример: web+nocloud://j/N1.… Браузер спросит разрешение на протокол при установке.',
      },
      {
        name: 'Файл в ссылке',
        text: 'Файл по ссылке не уезжает — иначе это снова облако мессенджера. Ссылка открывает NoCloud и соединение. Файл отправляете уже внутри канала. Можно выбрать файл заранее: он встанет в очередь и уйдёт, когда канал откроется.',
      },
      {
        name: 'Поделиться',
        text: '«Получить ссылку» — отдать свою. Если клик по чужой не открыл PWA — вставьте её в поле «Пришло от другого» и «Принять ссылку». Ответ обратно слать не нужно.',
      },
    ],
  },
  {
    id: 'servers',
    title: 'Настройки сервера',
    href: '#servers',
    lead: 'Свои STUN, TURN и сокет. Google не обязателен. Чужой открытый TURN в пресеты не кладём.',
    items: [
      {
        name: 'Мой сервер',
        text: 'SSH и curl установщика на VPS. В конце консоль печатает QR пакета S1. Считайте его или вставьте текст.',
      },
      {
        name: 'Пресет',
        text: 'Вручную — QR/текст. Локальная сеть — комната без копирования. Свой сервер — ваши URL.',
      },
      {
        name: 'HTTPS и сокет',
        text: 'Pages — HTTPS, сокет должен быть https://wss-….sslip.io:8443 (wss). Установщик ставит Let’s Encrypt ~90 дней и cron. Старый S1 с http:// браузер режет: новый пакет. Пока сокета нет, «Получить ссылку» делает приглашение.',
      },
      {
        name: 'Свой TURN',
        text: 'TURN нужен на сотовой и за жёстким NAT. Порты 80 и 443 по TCP обычно не режут.',
      },
    ],
  },
  {
    id: 'lan',
    title: 'Передача',
    href: '#lan',
    lead: 'Один экран и для Wi‑Fi, и для интернета. С вашим TURN файлы идут на второй телефон; локально или через релей — в статусе «локально» / «интернет».',
    items: [
      {
        name: 'Код этого телефона',
        text: 'Это ваш постоянный id. Ник и лого меняются в «Контакты».',
      },
      {
        name: 'Файлы → получить ссылку',
        text: 'Выберите файл, нажмите «Получить ссылку», киньте её в Telegram или WhatsApp. Второй открывает и жмёт «Принять». Пока нет соединения, файл стоит в очереди — сам не уходит.',
      },
      {
        name: 'ICE / TURN',
        text: 'Если «relay не появился»: оба телефона должны иметь один S1. Браузер сначала пробует TURN по TCP 443/80 — UDP на сотовой часто мёртв. Кандидаты досылаются по сокету, не только в одном SDP.',
      },
    ],
  },
  {
    id: 'contacts',
    title: 'Контакты',
    href: '#contacts',
    lead: 'Сначала люди, потом файлы. Карточка — короткая строка C1. Её копируете и шлёте. Облачного аккаунта нет.',
    items: [
      {
        name: 'Сгенерировать',
        text: 'В «Я» нажмите «Сгенерировать» — вы ждёте в своей комнате. «Копировать» кладёт карточку в буфер. Ник можно сменить до генерации.',
      },
      {
        name: 'Добавить контакт',
        text: 'Вставьте чужую C1. и «Добавить». Как канал откроется, оба сразу в списках. Зелёная точка — сейчас в сети, красная — нет.',
      },
      {
        name: 'Файлы',
        text: 'Пока на паузе. Следующий шаг — слать из выбранного контакта, без отдельной ссылки на каждый файл.',
      },
    ],
  },
  {
    id: 'video',
    title: 'Видео конф',
    href: '#video',
    lead: 'Видеозвонка нет. Сейчас только файлы по DataChannel.',
    items: [
      {
        name: 'Пока',
        text: 'Голос и картинка — отдельный шаг, не через облачный SFU.',
      },
    ],
  },
  {
    id: 'logs',
    title: 'Логи',
    href: '#logs',
    lead: 'Сессия, ICE и ошибки на этом устройстве, файл app.log в OPFS.',
    items: [
      {
        name: 'Зачем',
        text: 'Если «прямой путь закрыт NAT» — смотрите relay и TURN в настройках сервера.',
      },
    ],
  },
];

export const mountHelp = (root: HTMLElement) => {
  const intro = document.createElement('fieldset');
  intro.className = 'panel';
  const legend = document.createElement('legend');
  legend.textContent = 'Справка';
  const tag = document.createElement('p');
  tag.className = 'tagline';
  tag.textContent =
    'Коротко по разделам меню и кнопкам. Ссылки внутри открывают нужный экран.';
  intro.append(legend, tag);
  root.append(intro);

  for (const topic of HELP_TOPICS) {
    const panel = document.createElement('fieldset');
    panel.className = 'panel';
    panel.id = `help-${topic.id}`;
    const head = document.createElement('legend');
    if (topic.href) {
      const link = document.createElement('a');
      link.href = topic.href;
      link.textContent = topic.title;
      head.append(link);
    } else {
      head.textContent = topic.title;
    }
    const lead = document.createElement('p');
    lead.className = 'tagline';
    lead.textContent = topic.lead;
    const list = document.createElement('dl');
    list.className = 'help-list';
    for (const item of topic.items) {
      const dt = document.createElement('dt');
      dt.textContent = item.name;
      const dd = document.createElement('dd');
      dd.textContent = item.text;
      list.append(dt, dd);
    }
    panel.append(head, lead, list);
    root.append(panel);
  }
};
