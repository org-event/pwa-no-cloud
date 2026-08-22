export const QR_MAX_CHARS = 1200;

export const inviteToQr = async (text: string): Promise<string | null> => {
  if (!text || text.length > QR_MAX_CHARS) return null;
  try {
    const qrcode = await import('qrcode');
    return await qrcode.toDataURL(text, {
      errorCorrectionLevel: 'L',
      margin: 1,
      width: 192,
    });
  } catch {
    return null;
  }
};
