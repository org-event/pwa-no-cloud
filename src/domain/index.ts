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
  BACKUP_PREFIX,
  PUBLIC_KEY_PREFIX,
  VAULT_PREFIX,
  VAULT_STORAGE_KEY,
  backupFileName,
  bytesToHex,
  clearVaultStorage,
  createIdentityBackup,
  createMnemonic,
  decodeIdentityBackup,
  decodePublicKey,
  decodeVaultRecord,
  encodeIdentityBackup,
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
  restoreKeyPairFromBackup,
  saveVaultToStorage,
  sealSecretKey,
  signBytes,
  signPayload,
  signText,
  verifyBytes,
  verifyText,
} from './identity/index.ts';
export type {
  IdentityBackup,
  MnemonicStrength,
  VaultRecord,
  VaultStorage,
} from './identity/index.ts';
export type {
  Call,
  CallDirection,
  CallLeg,
  CallLegId,
  CallLegState,
  CallSession,
  CallSessionEvent,
  CallSessionState,
  CallState,
  CallTopology,
} from './call/index.ts';
export {
  M1_MAX_CALL_LEGS,
  applyCallSessionEvent,
  createIdleCallSession,
  isCallBusy,
  primaryCallLeg,
} from './call/index.ts';
export type { PresenceEntry, PresenceStatus } from './presence/index.ts';
export type { RelayBundle, RelayUrl } from './discovery/index.ts';
export {
  activeRelayOf,
  addRelayUrl,
  applyRelayFailover,
  emptyRelayBundle,
  mergeRemoteRelays,
  nextFailoverRelay,
  normalizeRelayUrl,
  removeRelayUrl,
  setActiveRelay,
} from './discovery/index.ts';
export type {
  RelayBundleMessage,
  RelayCapabilities,
  RelayChallenge,
  RelayChallengeAnswer,
  RelayChallengeOffer,
  RelayChallengeResponse,
  RelayHint,
  RelayHintCaps,
} from './relay/index.ts';
export {
  RELAY_BUNDLE_MAX,
  RELAY_BUNDLE_VERSION,
  RELAY_CHALLENGE_VERSION,
  canonicalRelayChallenge,
  createNoopAbuseGuard,
  createRateLimitGuard,
  isRelayChallenge,
  isRelayChallengeResponse,
  parseRelayBundleMessage,
  parseRelayChallengeAnswer,
  parseRelayChallengeOffer,
  parseRelayHint,
  relayUrlsOf,
} from './relay/index.ts';
export type {
  AbuseCheckInput,
  AbuseDecision,
  AbuseGuard,
  RateLimitOptions,
} from './relay/index.ts';
export type { AddressBook, Contact, ProfileCard } from './contacts/index.ts';
export {
  CONTACT_CARD_PREFIX,
  LEGACY_CONTACT_CARD_PREFIX,
  contactDisplayName,
  encodeContactCard,
  meetRoomId,
  parseContactCard,
  parseProfileCard,
  sanitizeNick,
  setContactAlias,
  toNetworkProfile,
  upsertContact,
} from './contacts/index.ts';
export type { SignedProfile, SignedProfileDraft } from './contacts/index.ts';
export {
  SIGNED_PROFILE_VERSION,
  canonicalSignedProfile,
  parseSignedProfile,
  signProfile,
  verifySignedProfile,
} from './contacts/index.ts';
export type { IdentityInvite } from './contacts/index.ts';
export {
  IDENTITY_INVITE_VERSION,
  createIdentityInvite,
  encodeIdentityInvite,
  parseIdentityInvite,
} from './contacts/index.ts';
export type {
  IntroduceCard,
  IntroduceCardDraft,
  IntroduceImport,
  IntroduceSubject,
} from './contacts/index.ts';
export {
  INTRODUCE_CARD_PREFIX,
  INTRODUCE_CARD_VERSION,
  canonicalIntroduceCard,
  createIntroduceCard,
  importIntroduceCard,
  parseAndVerifyIntroduceCard,
  parseIntroduceCard,
  verifyIntroduceCard,
} from './contacts/index.ts';
