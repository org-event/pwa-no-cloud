export const appLinkCopy = {
  shareMessage: (httpsLink: string, protocolLink: string) =>
    `NoCloud — открой ссылку в браузере или в установленном приложении:\n` +
    `${httpsLink}\n\n` +
    `Если PWA уже стоит (Chrome/Android): ${protocolLink}`,
} as const;
