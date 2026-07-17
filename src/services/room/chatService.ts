import type { Identity, Message } from "../../types/domain";
import type {
  ChatMessageMessage,
  ChatMessageWire,
  RoomSyncRequestMessage,
  RoomSyncResponseMessage,
  FileChunkMessage,
} from "../../types/wire";
import * as identityService from "../identity/identity";
import * as messageRepo from "../db/messageRepo";
import * as roomRepo from "../db/roomRepo";
import * as rosterRepo from "../db/rosterRepo";
import { getPeerRegistry } from "../peer/registry";
import { derivePeerId } from "../peer/derivePeerId";
import { bytesToBase64, base64ToBytes, utf8ToBase64 } from "../../lib/base64";
import * as fileRepo from "../db/fileRepo";
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
    m.attachmentId ?? null,
    m.attachmentName ?? null,
    m.attachmentSize ?? null,
    m.attachmentType ?? null,
    m.replyToId,
    m.sentAt,
    m.editedAt,
    m.deletedAt,
  ]);
}

function wireToMessage(w: ChatMessageWire, deliveryStatus: Message["deliveryStatus"]): Message {
  return { ...w, deliveryStatus };
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
    attachmentId: m.attachmentId,
    attachmentName: m.attachmentName,
    attachmentSize: m.attachmentSize,
    attachmentType: m.attachmentType,
    replyToId: m.replyToId,
    sentAt: m.sentAt,
    editedAt: m.editedAt,
    deletedAt: m.deletedAt,
    sig: m.sig,
  };
}

/** Broadcasts to the room's currently-connected members and returns how many
 * actually received the send (offline members converge later via room sync). */
function broadcastToRoomMembers(roomMemberIds: string[], data: unknown): number {
  const registry = getPeerRegistry();
  let delivered = 0;
  for (const memberId of roomMemberIds) {
    if (registry.send(derivePeerId(memberId), data)) delivered++;
  }
  return delivered;
}

export async function sendMessage(
  self: Identity,
  roomId: string,
  memberIds: string[],
  body: string,
  physicalNow: number,
  attachment?: { id: string; name: string; size: number; type: string },
  fileBuffer?: Uint8Array,
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
    contentType: attachment ? (attachment.type.startsWith("image/") ? "image" : "file") : "text",
    body,
    attachmentId: attachment?.id ?? undefined,
    attachmentName: attachment?.name ?? undefined,
    attachmentSize: attachment?.size ?? undefined,
    attachmentType: attachment?.type ?? undefined,
    replyToId: null,
    sentAt: physicalNow,
    editedAt: null,
    deletedAt: null,
  };
  const sig = await identityService.sign(utf8ToBase64(canonicalMessage(wireBase)));
  const wire: ChatMessageWire = { ...wireBase, sig };

  const message = wireToMessage(wire, "pending");
  await messageRepo.insertIfAbsent(message);
  await roomRepo.touchLastMessage(roomId, message.sentAt);

  const payload: ChatMessageMessage = { type: "chat_message", message: wire };
  const recipients = memberIds.filter((id) => id !== self.identityId);

  // If there's a file, chunk and send it BEFORE the message so it's ready when the message arrives
  if (attachment && fileBuffer) {
    const CHUNK_SIZE = 16 * 1024;
    const base64Data = bytesToBase64(fileBuffer);
    const totalChunks = Math.ceil(base64Data.length / CHUNK_SIZE);
    
    for (let i = 0; i < totalChunks; i++) {
      const chunkData = base64Data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkMsg: FileChunkMessage = {
        type: "file_chunk",
        fileId: attachment.id,
        fileName: attachment.name,
        mimeType: attachment.type,
        chunkIndex: i,
        totalChunks,
        data: chunkData
      };
      broadcastToRoomMembers(recipients, chunkMsg);
      
      // Yield to the event loop every 10 chunks to allow WebRTC buffers to drain
      // and prevent the UI thread from freezing.
      if (i % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
  }

  const delivered = broadcastToRoomMembers(recipients, payload);
  if (delivered > 0) {
    message.deliveryStatus = "sent";
    await messageRepo.setDeliveryStatus(message.id, "sent");
  }
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

// In-memory store for incoming file chunks
const incomingFiles = new Map<string, {
  chunks: string[];
  receivedCount: number;
  expected: number;
  fileName: string;
  mimeType: string;
}>();

export async function handleFileChunk(msg: FileChunkMessage): Promise<void> {
  let state = incomingFiles.get(msg.fileId);
  if (!state) {
    state = { chunks: [], receivedCount: 0, expected: msg.totalChunks, fileName: msg.fileName, mimeType: msg.mimeType };
    incomingFiles.set(msg.fileId, state);
  }
  if (!state.chunks[msg.chunkIndex]) {
    state.chunks[msg.chunkIndex] = msg.data;
    state.receivedCount++;
    
    if (state.receivedCount === state.expected) {
      incomingFiles.delete(msg.fileId);
      const fullBase64 = state.chunks.join("");
      const bytes = base64ToBytes(fullBase64);
      
      await fileRepo.insertFile({
        id: msg.fileId,
        name: state.fileName,
        size: bytes.length,
        mimeType: state.mimeType,
        data: bytes,
      });
      
      // Dispatch an event so MessageList/MessageAttachment can re-render to load the file
      window.dispatchEvent(new CustomEvent("haven_file_downloaded", { detail: msg.fileId }));
    }
  }
}

/** Responds with the messages the requester is missing. Also treats their
 * have-vector as an implicit receipt for our own messages — anything of ours
 * at or below their seq is on their device, so pending/sent flips to
 * delivered. Returns true if any of our statuses changed. */
export async function handleRoomSyncRequest(
  selfId: string,
  fromPeerId: string,
  msg: RoomSyncRequestMessage,
): Promise<boolean> {
  const flipped = await messageRepo.markDeliveredUpTo(
    msg.roomId,
    selfId,
    msg.have[selfId] ?? 0,
  );

  const missing = await messageRepo.messagesSince(msg.roomId, msg.have);
  if (missing.length > 0) {
    const response: RoomSyncResponseMessage = {
      type: "room_sync_response",
      roomId: msg.roomId,
      messages: missing.map(messageToWire),
    };
    getPeerRegistry().send(fromPeerId, response);
  }
  return flipped > 0;
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
