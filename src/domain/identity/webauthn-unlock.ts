/**
 * Optional WebAuthn platform unlock for identity (S1.7).
 * Master passphrase remains recovery; biometrics are convenience unlock.
 *
 * Modes:
 * - `prf`: wrap key from authenticator PRF (preferred when available)
 * - `local-wrap`: UV assertion gates a locally stored wrap key (weaker, XSS-visible)
 */

import type { CryptoResult, SecretKeyBytes } from './types.ts';
import type { VaultStorage } from './vault.ts';

export const WEBAUTHN_STORAGE_KEY = 'nocloud.identity.webauthn';
export const WEBAUTHN_RECORD_VERSION = 1 as const;

const SECRET_BYTES = 32;
const IV_BYTES = 12;
const WRAP_BYTES = 32;
const PRF_SALT = new TextEncoder().encode('nocloud.identity.webauthn.prf.v1');

export type BiometricUnlockMode = 'prf' | 'local-wrap';

export type BiometricUnlockRecord = {
  v: typeof WEBAUTHN_RECORD_VERSION;
  credentialId: string;
  iv: string;
  ciphertext: string;
  mode: BiometricUnlockMode;
  /** Present only for local-wrap (after successful UV). */
  wrapKey?: string;
};

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const fromBase64Url = (text: string): CryptoResult<Uint8Array> => {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  try {
    const binary = atob(padded + pad);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { ok: true, value: bytes };
  } catch {
    return { ok: false, code: 'bad-base64', message: 'invalid base64url' };
  }
};

const asBufferSource = (bytes: Uint8Array): BufferSource =>
  bytes as unknown as BufferSource;

const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
};

const importAesKey = async (raw: Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey('raw', asBufferSource(raw), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);

const sealWithWrapKey = async (
  secretKey: SecretKeyBytes,
  wrapKey: Uint8Array,
): Promise<CryptoResult<{ iv: string; ciphertext: string }>> => {
  if (secretKey.byteLength !== SECRET_BYTES) {
    return {
      ok: false,
      code: 'bad-secret',
      message: 'secret key must be 32 bytes',
    };
  }
  if (wrapKey.byteLength !== WRAP_BYTES) {
    return {
      ok: false,
      code: 'bad-wrap',
      message: 'wrap key must be 32 bytes',
    };
  }
  try {
    const iv = randomBytes(IV_BYTES);
    const key = await importAesKey(wrapKey);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      key,
      asBufferSource(secretKey),
    );
    return {
      ok: true,
      value: {
        iv: toBase64Url(iv),
        ciphertext: toBase64Url(new Uint8Array(encrypted)),
      },
    };
  } catch (error) {
    return {
      ok: false,
      code: 'seal-failed',
      message: error instanceof Error ? error.message : 'seal failed',
    };
  }
};

const openWithWrapKey = async (
  record: Pick<BiometricUnlockRecord, 'iv' | 'ciphertext'>,
  wrapKey: Uint8Array,
): Promise<CryptoResult<SecretKeyBytes>> => {
  const iv = fromBase64Url(record.iv);
  const ciphertext = fromBase64Url(record.ciphertext);
  if (!iv.ok) return iv;
  if (!ciphertext.ok) return ciphertext;
  try {
    const key = await importAesKey(wrapKey);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv.value) },
      key,
      asBufferSource(ciphertext.value),
    );
    const secretKey = new Uint8Array(plain);
    if (secretKey.byteLength !== SECRET_BYTES) {
      return {
        ok: false,
        code: 'bad-secret',
        message: 'decrypted key length invalid',
      };
    }
    return { ok: true, value: secretKey };
  } catch {
    return {
      ok: false,
      code: 'open-failed',
      message: 'biometric unwrap failed',
    };
  }
};

export const canUsePlatformAuthenticator = async (): Promise<boolean> => {
  if (typeof globalThis.PublicKeyCredential === 'undefined') return false;
  try {
    const available =
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return Boolean(available);
  } catch {
    return false;
  }
};

export const hasBiometricUnlock = (storage: VaultStorage): boolean => {
  return loadBiometricRecord(storage).ok;
};

export const clearBiometricUnlock = (storage: VaultStorage): void => {
  storage.removeItem(WEBAUTHN_STORAGE_KEY);
};

export const loadBiometricRecord = (
  storage: VaultStorage,
): CryptoResult<BiometricUnlockRecord> => {
  const raw = storage.getItem(WEBAUTHN_STORAGE_KEY);
  if (!raw) {
    return { ok: false, code: 'missing', message: 'no biometric unlock' };
  }
  try {
    const parsed = JSON.parse(raw) as BiometricUnlockRecord;
    if (
      parsed?.v !== WEBAUTHN_RECORD_VERSION ||
      typeof parsed.credentialId !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.ciphertext !== 'string' ||
      (parsed.mode !== 'prf' && parsed.mode !== 'local-wrap')
    ) {
      return {
        ok: false,
        code: 'bad-shape',
        message: 'invalid biometric record',
      };
    }
    return { ok: true, value: parsed };
  } catch {
    return { ok: false, code: 'bad-json', message: 'invalid biometric json' };
  }
};

const saveBiometricRecord = (
  storage: VaultStorage,
  record: BiometricUnlockRecord,
): void => {
  storage.setItem(WEBAUTHN_STORAGE_KEY, JSON.stringify(record));
};

const prfResultsFromExtension = (
  extensionResults: AuthenticationExtensionsClientOutputs | undefined,
): Uint8Array | null => {
  const prf = (
    extensionResults as
      | { prf?: { results?: { first?: ArrayBuffer } } }
      | undefined
  )?.prf?.results?.first;
  if (!prf) return null;
  const bytes = new Uint8Array(prf);
  if (bytes.byteLength < WRAP_BYTES) return null;
  return bytes.slice(0, WRAP_BYTES);
};

const supportsPrfExtension = async (): Promise<boolean> => {
  const probe = (
    PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    }
  ).getClientCapabilities;
  if (typeof probe !== 'function') return false;
  try {
    const caps = await probe.call(PublicKeyCredential);
    return Boolean(caps?.['extension:prf']);
  } catch {
    return false;
  }
};

/** Exported for unit tests of seal/open without WebAuthn. */
export const sealSecretForBiometricTest = sealWithWrapKey;
export const openSecretForBiometricTest = openWithWrapKey;

export const registerBiometricUnlock = async (
  storage: VaultStorage,
  secretKey: SecretKeyBytes,
  options: { userId: string; displayName: string },
): Promise<CryptoResult<{ mode: BiometricUnlockMode }>> => {
  if (!(await canUsePlatformAuthenticator())) {
    return {
      ok: false,
      code: 'unavailable',
      message: 'platform authenticator unavailable',
    };
  }
  const userIdBytes = new TextEncoder().encode(options.userId).slice(0, 64);
  const challenge = randomBytes(32);
  const wantPrf = await supportsPrfExtension();
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: asBufferSource(challenge),
        rp: {
          name: 'NoCloud',
          id: globalThis.location?.hostname || 'localhost',
        },
        user: {
          id: asBufferSource(userIdBytes),
          name: options.userId,
          displayName: options.displayName,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60_000,
        extensions: wantPrf
          ? { prf: { eval: { first: asBufferSource(PRF_SALT) } } }
          : undefined,
      },
    })) as PublicKeyCredential | null;
    if (!credential) {
      return {
        ok: false,
        code: 'cancelled',
        message: 'biometric registration cancelled',
      };
    }
    const credentialId = toBase64Url(new Uint8Array(credential.rawId));
    let wrapKey = prfResultsFromExtension(
      credential.getClientExtensionResults(),
    );
    let mode: BiometricUnlockMode = 'prf';
    if (!wrapKey) {
      wrapKey = randomBytes(WRAP_BYTES);
      mode = 'local-wrap';
    }
    const sealed = await sealWithWrapKey(secretKey, wrapKey);
    if (!sealed.ok) return sealed;
    const record: BiometricUnlockRecord = {
      v: WEBAUTHN_RECORD_VERSION,
      credentialId,
      iv: sealed.value.iv,
      ciphertext: sealed.value.ciphertext,
      mode,
      wrapKey: mode === 'local-wrap' ? toBase64Url(wrapKey) : undefined,
    };
    saveBiometricRecord(storage, record);
    return { ok: true, value: { mode } };
  } catch (error) {
    return {
      ok: false,
      code: 'register-failed',
      message: error instanceof Error ? error.message : 'register failed',
    };
  }
};

export const unlockSecretWithBiometrics = async (
  storage: VaultStorage,
): Promise<CryptoResult<SecretKeyBytes>> => {
  const loaded = loadBiometricRecord(storage);
  if (!loaded.ok) return loaded;
  const record = loaded.value;
  const credentialId = fromBase64Url(record.credentialId);
  if (!credentialId.ok) return credentialId;
  const challenge = randomBytes(32);
  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: asBufferSource(challenge),
        allowCredentials: [
          {
            type: 'public-key',
            id: asBufferSource(credentialId.value),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60_000,
        extensions:
          record.mode === 'prf'
            ? { prf: { eval: { first: asBufferSource(PRF_SALT) } } }
            : undefined,
      },
    })) as PublicKeyCredential | null;
    if (!assertion) {
      return {
        ok: false,
        code: 'cancelled',
        message: 'biometric unlock cancelled',
      };
    }
    let wrapKey: Uint8Array | null = null;
    if (record.mode === 'prf') {
      wrapKey = prfResultsFromExtension(assertion.getClientExtensionResults());
      if (!wrapKey) {
        return {
          ok: false,
          code: 'prf-missing',
          message: 'PRF output missing; use master passphrase',
        };
      }
    } else {
      if (!record.wrapKey) {
        return {
          ok: false,
          code: 'wrap-missing',
          message: 'local wrap key missing',
        };
      }
      const parsed = fromBase64Url(record.wrapKey);
      if (!parsed.ok) return parsed;
      wrapKey = parsed.value;
    }
    return openWithWrapKey(record, wrapKey);
  } catch (error) {
    return {
      ok: false,
      code: 'unlock-failed',
      message:
        error instanceof Error ? error.message : 'biometric unlock failed',
    };
  }
};
