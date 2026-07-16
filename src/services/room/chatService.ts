import type { Identity, Message } from "../../types/domain";
import type {
  ChatMessageMessage,
  ChatMessageWire,
  RoomSyncRequestMessage,
  RoomSyncResponseMessage,
} from "../../types/wire";
import * as identityService from "../identity/identity";
import * as messageRepo from "../db/messageRepo";
import * as roomRepo from "../db/roomRepo";
import * as rosterRepo from "../db/rosterRepo";
import { getPeerRegistry } from "../peer/registry";
import { derivePeerId } from "../peer/derivePeerId";
import { utf8ToBase64 } from "../../lib/base64";
import { formatHlc, tickLocal, tickReceive, type Hlc } from "../../lib/hlc";

// In-memory HLC, seeded from the DB on init. Only this module mutates it.
let clock: Hlc | null = null;
let clockReady: Promise<void> | null = null;

async function ensureClock(): Promise<void> {
  if (!clockReady) clockReady = messageRepo.latestHlc().then((h) => void (clock = h));
  return clockReady;
}

function nodeShort(identityId: string): string {
  return identityId.slice(0, 8);
}

/** Deterministic DM room id from the two member identityIds — both peers
 * compute the same id independently, so neither needs to send room metadata. */
export async function dmRoomId(a: string, b: string): Promise<string> {
  const [lo, hi] = [a, b].sort();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${lo}|${hi}`),
  );
  const hex = [...new Uint8Array(digest)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
  return `dm_${hex.slice(0, 32)}`;
}

function canonicalMessage(m: Omit<ChatMessageWire, "sig">): string {
  return JSON.stringify([
    m.id,
    m.roomId,
    m.authorId,
    m.authorSeq,
    m.hlc,
    m.contentType,
    m.body,
    m.replyToId,
    m.sentAt,
    m.editedAt,
    m.deletedAt,
  ]);
}

function wireToMessage(w: ChatMessageWire, deliveryStatus: Message["deliveryStatus"]): Message {
  return { ...w, attachmentPath: null, deliveryStatus };
}

function messageToWire(m: Message): ChatMessageWire {
  return {
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    authorSeq: m.authorSeq,
    hlc: m.hlc,
    contentType: m.contentType,
    body: m.body,
    replyToId: m.replyToId,
    sentAt: m.sentAt,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    sig: m.sig,
  };
}

/** Broadcasts to the room's currently-connected members. For a DM that's the
 * single peer; broadcast keeps this correct once group rooms arrive. */
function broadcastToRoomMembers(roomMemberIds: string[], data: unknown) {
  const registry = getPeerRegistry();
  for (const memberId of roomMemberIds) {
    registry.send(derivePeerId(memberId), data);
  }
}

export async function sendMessage(
  self: Identity,
  roomId: string,
  memberIds: string[],
  body: string,
  physicalNow: number,
): Promise<Message> {
  await ensureClock();
  clock = tickLocal(clock, physicalNow, nodeShort(self.identityId));

  const authorSeq = await messageRepo.nextAuthorSeq(roomId, self.identityId);
  const wireBase: Omit<ChatMessageWire, "sig"> = {
    id: crypto.randomUUID(),
    roomId,
    authorId: self.identityId,
    authorSeq,
    hlc: clock,
    contentType: "text",
    body,
    replyToId: null,
    sentAt: physicalNow,
    editedAt: null,
    deletedAt: null,
  };
  const sig = await identityService.sign(utf8ToBase64(canonicalMessage(wireBase)));
  const wire: ChatMessageWire = { ...wireBase, sig };

  const message = wireToMessage(wire, "sent");
  await messageRepo.insertIfAbsent(message);
  await roomRepo.touchLastMessage(roomId, message.sentAt);

  const payload: ChatMessageMessage = { type: "chat_message", message: wire };
  broadcastToRoomMembers(memberIds, payload);
  return message;
}

async function verifyAndStore(wire: ChatMessageWire, physicalNow: number, selfId: string): Promise<Message | null> {
  const contact = await rosterRepo.getContact(wire.authorId);
  if (!contact) return null; // never store messages from untrusted identities

  const valid = await identityService.verify(
    contact.publicKey,
    utf8ToBase64(canonicalMessage(wire)),
    wire.sig,
  );
  if (!valid) return null;

  await ensureClock();
  clock = tickReceive(clock, wire.hlc, physicalNow, nodeShort(selfId));

  const message = wireToMessage(wire, "delivered");
  const inserted = await messageRepo.insertIfAbsent(message);
  if (inserted) await roomRepo.touchLastMessage(message.roomId, message.sentAt);
  return inserted ? message : null;
}

export async function handleChatMessage(
  self: Identity,
  msg: ChatMessageMessage,
  physicalNow: number,
): Promise<Message | null> {
  return verifyAndStore(msg.message, physicalNow, self.identityId);
}

export async function handleRoomSyncRequest(
  fromPeerId: string,
  msg: RoomSyncRequestMessage,
): Promise<void> {
  const missing = await messageRepo.messagesSince(msg.roomId, msg.have);
  if (missing.length === 0) return;
  const response: RoomSyncResponseMessage = {
    type: "room_sync_response",
    roomId: msg.roomId,
    messages: missing.map(messageToWire),
  };
  getPeerRegistry().send(fromPeerId, response);
}

export async function handleRoomSyncResponse(
  self: Identity,
  msg: RoomSyncResponseMessage,
  physicalNow: number,
): Promise<Message[]> {
  const stored: Message[] = [];
  for (const wire of msg.messages) {
    const m = await verifyAndStore(wire, physicalNow, self.identityId);
    if (m) stored.push(m);
  }
  return stored;
}

/** Sends our `have` vector for a room so the peer backfills anything we're
 * missing. Called when a room's peer (re)connects. */
export async function requestRoomSync(roomId: string, toPeerId: string): Promise<void> {
  const have = await messageRepo.highestSeqPerAuthor(roomId);
  const request: RoomSyncRequestMessage = { type: "room_sync_request", roomId, have };
  getPeerRegistry().send(toPeerId, request);
}

// Exposed for tests / diagnostics.
export function _resetClockForTest(seed: Hlc | null = null) {
  clock = seed;
  clockReady = Promise.resolve();
}

export { formatHlc };
