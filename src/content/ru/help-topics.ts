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
        text: 'Установите на домашний экран. После нового релиза на iPhone нажмите круговую стрелку в шапке — «Проверить обновление». Если не подхватилось, подтвердите сброс кэша.',
      },
    ],
  },
];
