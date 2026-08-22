export const listIceUrls = (urls: string | string[]): string[] => {
  if (Array.isArray(urls)) return urls;
  return [urls];
};
