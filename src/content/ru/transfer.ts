export const transferCopy = {
  folderAfterConnect:
    'Папку отправьте после соединения. Файл можно выбрать заранее.',
  needContact: 'Выберите контакт',
  needFiles: 'Выберите файлы или папку',
  sizeBytes: (size: number) => `${size} Б`,
  sizeKb: (size: number) => `${(size / 1024).toFixed(1)} КБ`,
  sizeMb: (size: number) => `${(size / (1024 * 1024)).toFixed(1)} МБ`,
  progressLabel: (percent: number, done: string, total: string) =>
    `${percent}% · ${done} / ${total}`,
  waitingConsent: (label: string) => `ждём согласие · ${label}`,
  acceptFile: (label: string, size: string) => `принять ${label} (${size})`,
  sending: (label: string, chunk: string) => `отправка ${label} ${chunk}`,
  receiving: (label: string, chunk: string) => `приём ${label} ${chunk}`,
  writing: (label: string) => `запись ${label}`,
  paused: (label: string, chunk: string) =>
    `пауза ${label} ${chunk} · можно докачать`,
  done: (label: string) => `готово: ${label}`,
  canceled: (label: string) => `отменено: ${label}`,
  failed: (label: string, error: string) => `ошибка ${label}: ${error}`,
  folderWaitingConsent: (name: string, total: number) =>
    `ждём согласие · папка ${name} (${total} файлов)`,
  acceptFolder: (name: string, total: number, size: string) =>
    `принять папку ${name} (${total} файлов, ${size})`,
  folderSending: (count: string, path: string) => `отправка ${count} · ${path}`,
  folderReceiving: (count: string, path: string) => `приём ${count} · ${path}`,
  folderDone: (name: string) => `готово: папка ${name}`,
  folderCanceled: (name: string) => `отменено: папка ${name}`,
  folderFailed: (name: string, error: string) =>
    `ошибка папки ${name}: ${error}`,
  folderLabel: (name: string) => `папка ${name}`,
  queuedList: (names: string) => `в очереди: ${names}`,
  queuedFolder: (name: string, count: number) =>
    `папка ${name} · ${count} файлов`,
  fileQueuedHint: 'файл можно выбрать сейчас — уйдёт после соединения',
} as const;
