# NoCloud

PWA for exchanging files (and voice/video/chat) between devices without a cloud. Control-plane relays never carry media/file bytes.

Longer Russian definitions: [docs/glossary.md](./docs/glossary.md).

## Language

### Client

**PWA**:
The installable browser client. Not the relay server.
_Avoid_: Node, server, cloud app

**Shell**:
Screen chrome (lists, call UI, settings). Contains no crypto and no SDP.
_Avoid_: UI that signs or builds offers

### Identity

**Identity**:
A user as an offline-created key pair.
_Avoid_: account, user profile (unless signed profile is meant)

**Pubkey**:
The public half used to recognise someone on the network.
_Avoid_: username, handle (unless UI nickname)

**Fingerprint**:
Short pubkey digest for human display.
_Avoid_: full pubkey in UI copy

**Seed phrase**:
BIP39 words that restore the Identity.
_Avoid_: password, PIN

**Master phrase**:
Phrase that encrypts the local key / backup; may equal the seed phrase.
_Avoid_: biometrics (unlock only)

**Unlock**:
Device biometrics for local access. Not a backup or recovery method.
_Avoid_: restore, backup

### Planes and networking

**Control plane**:
Signaling, presence, and leg routing through relays.
_Avoid_: file relay, media server (unless TURN/SFU is explicit)

**Media plane**:
Voice, video, and file bytes on P2P (or explicit TURN/SFU).
_Avoid_: sending files through the relay

**Relay**:
A thin acquaintance / presence node. Never stores transfer contents.
_Avoid_: cloud storage, file server

**Relay Bundle**:
Cached ordered list of signaling Relay URLs the client may use, with one active entry. Merged from share packs and live `/relays` hints.
_Avoid_: calling the share pack S1. a Relay Bundle (S1. is the share encoding; the Bundle is the runtime cache)

**Active Relay**:
The Relay URL currently used for Presence and room signaling. «Я в сети» means Presence on this Active Relay.
_Avoid_: a separate Presence Relay vs Call Relay in 1:1 MVP

**Node**:
The Node.js relay implementation in this repo. Not the PWA.
_Avoid_: calling the PWA “Node”

**Signaling**:
Exchange of SDP/ICE before P2P. Small control messages only.
_Avoid_: using signaling for file bytes

**STUN**:
Helps a peer learn its reflexive address. Does not carry media.
_Avoid_: TURN

**TURN**:
Relays media/bytes when direct P2P fails. Sees traffic → only self-hosted / user-chosen.
_Avoid_: STUN, default always-on cloud TURN

**P2P**:
Direct device-to-device channel after acquaintance.
_Avoid_: “through our cloud”

### Session and calls

**PeerConnection**:
One WebRTC session between two sides (data + media).
_Avoid_: one PC per feature

**Link**:
The deep module for one PeerConnection: signaling, ICE, control, and local media. File Transfer uses a separate TransferPort once channels are open.
_Avoid_: PeerSession (legacy name for the same implementation)

**Call**:
Logical session made of legs to participants.
_Avoid_: room (MVP rooms are signaling-only)

**CallController**:
Deep module for Call product behaviour: dial/accept/reject/hangup, media lifecycle, and attach to Link. The Pinia calls slice is a thin Vue adapter.
_Avoid_: putting call orchestration only in the store slice

**ChatController**:
Deep module for Chat product behaviour: signed send/receive, self notes, thread persist over Link `sendChatWire`. The Pinia chat slice is a thin Vue adapter. Domain chat (H1. wire) stays the crypto/thread seam.
_Avoid_: putting send/incoming orchestration only in the store slice

**InviteSession**:
Deep module for invite / deep-link product behaviour: create/join, apply share pack or invite text, room links, paste. The Pinia invite slice keeps browser glue (clipboard, `navigator.share`, location/history) and syncs role/error/room into reactive state.
_Avoid_: putting applyIncoming/applyDeepLink orchestration only in the store slice

**Leg**:
Link to one peer (one PeerConnection).
_Avoid_: call (when meaning a single peer link)

**Presence**:
Whether a contact appears reachable via the Active Relay (lobby / probe), not via a file server.
_Avoid_: online status from a file server; “online on a different Relay than Active”

**Online (contact)**:
UI reachability: Presence probe on the Active Relay **or** an open Link to that contact.
_Avoid_: treating Online as “in a Call only”; hiding Live Link as offline

**PresenceController**:
Deep module for Presence product behaviour: lobby hub lifecycle, wake lock, relay challenge/failover, knock, and visitor→incoming Call. The Pinia presence slice is a thin Vue adapter. PresenceHub remains the internal probe adapter.
_Avoid_: putting presence orchestration only in the store slice

**Knock**:
Request to open a session with an online contact.

**Lost each other**:
Both sides still have Identity, but Presence/knock no longer meets because they sit on different Active Relays after failover or move. Recovery is re-share (card / S1. / R1.), not automatic DHT search.
_Avoid_: “offline forever”, automatic global discovery

**Room**:
Internal signaling id. Users manage contacts, not rooms, in 1:1 MVP.
_Avoid_: chat group (later)

### Transfer

**Transfer**:
Sending a file or folder over a DataChannel.
_Avoid_: upload to relay

**TransferPort**:
Byte-plane seam once Link control+bytes channels are open: send/accept/pause file and folder Transfer. FilePipe is the implementation; Link exposes only this port (via `bindTransferPort`), not FilePipe methods.
_Avoid_: PeerSession sendFile/acceptFile pass-throughs; calling FilePipe from UI/store

**TransferSession**:
Deep module for Transfer product behaviour: stage queue, send over Link/`TransferPort`, accept/reject/cancel. The Pinia transfer slice keeps inbox (OPFS) UI and syncs staging into reactive state.
_Avoid_: putting send/queue orchestration only in the store slice

**OPFS**:
Origin-private browser filesystem used as inbox storage.
_Avoid_: server disk

### Code organisation

**OwnedSecret**:
Exclusive ownership of Ed25519 secretKey bytes (`use` / `borrow` / `move` / `dispose` with wipe). Signing goes through `withBorrowedKeyPair` / ContactsPort `withIdentityKeyPair` so borrowed copies are zeroed after the callback (ADR 0002).
_Avoid_: returning durable KeyPair from the store; holding secretKey in long-lived UI closures

**Domain module**:
A responsibility area (identity, call, relay, …) without dependency cycles.
_Avoid_: dumping crypto/SDP into the Shell

**Adapter**:
Transport wrapper (WebSocket, HTTP poll, manual QR) behind one SignalingPort contract.
_Avoid_: leaking transport details into domain facades

**NocloudPorts**:
Typed cross-slice facades on the Pinia context (`call`, `chat`, `session`, `transfer`, `contacts`, `presence`, `servers`), bound once at store composition.
_Avoid_: flat untyped `refs` callback bag
