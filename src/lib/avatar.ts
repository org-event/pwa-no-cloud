const hashId = (id: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const identiconSvg = (id: string): string => {
  const hash = hashId(id || 'nocloud');
  const hue = hash % 360;
  const cells: string[] = [];
  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const bit = (hash >> (row * 3 + col)) & 1;
      if (!bit) continue;
      const x = col + 1;
      const mirror = 5 - col;
      cells.push(
        `<rect x="${x}" y="${row + 1}" width="1" height="1" rx="0.15"/>`,
      );
      if (mirror !== x) {
        cells.push(
          `<rect x="${mirror}" y="${row + 1}" width="1" height="1" rx="0.15"/>`,
        );
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7 7">` +
    `<rect width="7" height="7" rx="1.2" fill="hsl(${hue} 35% 22%)"/>` +
    `<g fill="hsl(${hue} 70% 72%)">${cells.join('')}</g></svg>`
  );
};

export const identiconDataUrl = (id: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(identiconSvg(id))}`;
};

export const avatarSrc = (id: string, avatar: string): string => {
  if (avatar.startsWith('data:image/')) return avatar;
  return identiconDataUrl(id);
};

export const fileToAvatarDataUrl = async (file: File): Promise<string> => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 96, 96);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.72);
};
