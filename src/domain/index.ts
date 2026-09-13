export { explainIceFailure } from './ice-fail.ts';
export type { IceFailContext } from './ice-fail.ts';
export { applySessionEvent, createIdleSession } from './session.ts';
export type { Session, SessionEvent, SessionState } from './session.ts';
export {
  EMPTY_TURN_HOST,
  INSTALL_TURN_SCRIPT_URL,
  generateHostCommands,
  iceServersFromTurnHost,
  installCommand,
  sshCommand,
  validateTurnHost,
} from './turn-host.ts';
export type { TurnHostDraft } from './turn-host.ts';
export {
  applyFolderEvent,
  createReceiveFolder,
  createSendFolder,
  folderProgress,
} from './folder.ts';
export type {
  FolderEvent,
  FolderFileMeta,
  FolderState,
  FolderTransfer,
} from './folder.ts';
export {
  applyTransferEvent,
  createReceiveTransfer,
  createSendTransfer,
  transferProgress,
} from './transfer.ts';
export type { Transfer, TransferEvent, TransferState } from './transfer.ts';

export type {
  CryptoErr,
  CryptoOk,
  CryptoResult,
  IdentityId,
  KeyPair,
  PublicKeyBytes,
  SecretKeyBytes,
  SignatureBytes,
} from './identity/index.ts';
export {
  PUBLIC_KEY_PREFIX,
  VAULT_PREFIX,
  VAULT_STORAGE_KEY,
  bytesToHex,
  clearVaultStorage,
  createMnemonic,
  decodePublicKey,
  decodeVaultRecord,
  encodePublicKey,
  encodeVaultRecord,
  fingerprintOf,
  formatFingerprint,
  generateKeyPair,
  hexToBytes,
  isValidMnemonic,
  keyPairFromMnemonic,
  loadVaultFromStorage,
  meetRoomIdFromFingerprint,
  normalizeMnemonic,
  openSecretKey,
  parsePublicKey,
  publicKeyFromSecret,
  saveVaultToStorage,
  sealSecretKey,
  signBytes,
  signPayload,
  signText,
  verifyBytes,
  verifyText,
} from './identity/index.ts';
export type {
  MnemonicStrength,
  VaultRecord,
  VaultStorage,
} from './identity/index.ts';
export type { Call, CallLeg, CallLegId, CallState } from './call/index.ts';
export type { PresenceEntry, PresenceStatus } from './presence/index.ts';
export type { RelayBundle, RelayUrl } from './discovery/index.ts';
export { emptyRelayBundle } from './discovery/index.ts';
export type {
  RelayCapabilities,
  RelayChallenge,
  RelayChallengeResponse,
} from './relay/index.ts';
export type { AddressBook, Contact, ProfileCard } from './contacts/index.ts';
export {
  CONTACT_CARD_PREFIX,
  encodeContactCard,
  meetRoomId,
  parseContactCard,
  parseProfileCard,
  sanitizeNick,
  upsertContact,
} from './contacts/index.ts';
