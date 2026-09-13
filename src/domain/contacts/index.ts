/**
 * Contacts domain — address book, local aliases, invite cards.
 * Profile card primitives still live in `../profile.ts` until S2.x migrates them.
 */

export type { AddressBook, Contact, ProfileCard } from '../profile.ts';
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
} from '../profile.ts';
export type { SignedProfile, SignedProfileDraft } from '../signed-profile.ts';
export {
  SIGNED_PROFILE_VERSION,
  canonicalSignedProfile,
  parseSignedProfile,
  signProfile,
  verifySignedProfile,
} from '../signed-profile.ts';
export type { IdentityInvite } from '../identity-invite.ts';
export {
  IDENTITY_INVITE_VERSION,
  createIdentityInvite,
  encodeIdentityInvite,
  parseIdentityInvite,
} from '../identity-invite.ts';
