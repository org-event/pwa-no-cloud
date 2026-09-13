/**
 * Contacts domain — address book, local aliases, invite cards.
 * Profile card primitives still live in `../profile.ts` until S2.x migrates them.
 */

export type { AddressBook, Contact, ProfileCard } from '../profile.ts';
export {
  CONTACT_CARD_PREFIX,
  encodeContactCard,
  meetRoomId,
  parseContactCard,
  parseProfileCard,
  sanitizeNick,
  upsertContact,
} from '../profile.ts';
