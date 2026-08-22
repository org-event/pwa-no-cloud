type QrHit = { rawValue?: string };

type Detector = {
  detect(source: ImageBitmap): Promise<QrHit[]>;
};

const getDetector = (): Detector | null => {
  const Ctor = (
    globalThis as {
      BarcodeDetector?: new (options: { formats: string[] }) => Detector;
    }
  ).BarcodeDetector;
  if (!Ctor) return null;
  return new Ctor({ formats: ['qr_code'] });
};

export const decodeQrFromFile = async (file: File): Promise<string | null> => {
  const detector = getDetector();
  if (!detector) return null;
  const bitmap = await createImageBitmap(file);
  try {
    const codes = await detector.detect(bitmap);
    const first = codes[0];
    if (first && typeof first.rawValue === 'string') return first.rawValue;
    return null;
  } finally {
    bitmap.close();
  }
};

export const canScanQr = (): boolean => getDetector() !== null;
