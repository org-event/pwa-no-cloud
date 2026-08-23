export type SaveFileResult = 'shared' | 'picked' | 'downloaded' | 'aborted';

const baseName = (name: string): string => {
  const parts = name.split('/');
  return parts[parts.length - 1] || name;
};

/** Save a File to the device: Share sheet, save picker, or download. */
export const saveFileToDevice = async (file: File): Promise<SaveFileResult> => {
  const named =
    file.name && file.name !== baseName(file.name)
      ? file
      : new File([file], baseName(file.name || 'file'), {
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified,
        });

  const canShare =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [named] });
  if (canShare && typeof navigator.share === 'function') {
    try {
      await navigator.share({ files: [named], title: named.name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'aborted';
      }
    }
  }

  const picker = (
    globalThis as typeof globalThis & {
      showSaveFilePicker?: (options: {
        suggestedName?: string;
      }) => Promise<FileSystemFileHandle>;
    }
  ).showSaveFilePicker;
  if (typeof picker === 'function') {
    try {
      const handle = await picker({ suggestedName: named.name });
      const writable = await handle.createWritable();
      await writable.write(named);
      await writable.close();
      return 'picked';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'aborted';
      }
    }
  }

  const url = URL.createObjectURL(named);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = named.name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
};
