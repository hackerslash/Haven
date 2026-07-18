import { create } from "zustand";
import type { DeliveryStatus, Message } from "../types/domain";
import * as messageRepo from "../services/db/messageRepo";
import * as fileRepo from "../services/db/fileRepo";
import * as chatService from "../services/room/chatService";
import { useIdentityStore } from "./useIdentityStore";
import { useRoomStore } from "./useRoomStore";

type ChatState = {
  messagesByRoom: Record<string, Message[]>;
  draftByRoom: Record<string, string>;

  loadMessages: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, memberIds: string[], body: string, file?: File) => Promise<void>;
  setDraft: (roomId: string, draft: string) => void;
  /** Bridge-called: a message arrived/backfilled from the network and was
   * already persisted; reflect it in the in-memory list if the room is loaded. */
  ingestMessage: (message: Message) => void;
  /** Bridge-called: like `ingestMessage` but for a batch (sync backfill) — one
   * merge + sort per room and a single room-list refresh. */
  ingestMessages: (messages: Message[]) => void;
  /** Bridge-called: a delivery receipt arrived; the repo row is already updated. */
  updateMessageStatus: (roomId: string, messageId: string, status: DeliveryStatus) => void;
  /** Reloads a room's messages from the DB, but only if it's already loaded. */
  refreshRoom: (roomId: string) => Promise<void>;
};

const byHlc = (a: Message, b: Message) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0);

function insertOrdered(list: Message[], message: Message): Message[] {
  if (list.some((m) => m.id === message.id)) return list;
  return [...list, message].sort(byHlc);
}

/** Merges two id-keyed message lists (deduped, hlc-ordered); `fresh` wins on
 * id conflicts. Used so a slow reload can't clobber messages appended while its
 * query was in flight. */
function mergeById(existing: Message[], fresh: Message[]): Message[] {
  const byId = new Map<string, Message>();
  for (const m of existing) byId.set(m.id, m);
  for (const m of fresh) byId.set(m.id, m);
  return [...byId.values()].sort(byHlc);
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByRoom: {},
  draftByRoom: {},

  loadMessages: async (roomId) => {
    const messages = await messageRepo.listByRoom(roomId);
    set((state) => {
      const existing = state.messagesByRoom[roomId];
      // Merge, don't overwrite: a message may have been ingested from the
      // network while this query was in flight, and it must not vanish.
      const next = existing ? mergeById(existing, messages) : messages;
      return { messagesByRoom: { ...state.messagesByRoom, [roomId]: next } };
    });
  },

  sendMessage: async (roomId, memberIds, body, file) => {
    const self = useIdentityStore.getState().self;
    if (!self) throw new Error("no local identity");
    const trimmed = body.trim();
    if (!trimmed && !file) return;

    let attachment: { id: string; name: string; size: number; type: string } | undefined;
    let fileBuffer: Uint8Array | undefined;
    if (file) {
      const id = crypto.randomUUID();
      const buffer = await file.arrayBuffer();
      fileBuffer = new Uint8Array(buffer);
      await fileRepo.insertFile({
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        data: fileBuffer,
      });
      attachment = { id, name: file.name, size: file.size, type: file.type };
    }

    const message = await chatService.sendMessage(
      self,
      roomId,
      memberIds,
      trimmed,
      Date.now(),
      attachment,
      fileBuffer
    );
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: insertOrdered(state.messagesByRoom[roomId] ?? [], message),
      },
      draftByRoom: { ...state.draftByRoom, [roomId]: "" },
    }));
    void useRoomStore.getState().loadRooms();
  },

  setDraft: (roomId, draft) =>
    set((state) => ({ draftByRoom: { ...state.draftByRoom, [roomId]: draft } })),

  ingestMessage: (message) => {
    get().ingestMessages([message]);
  },

  ingestMessages: (messages) => {
    if (messages.length === 0) return;
    set((state) => {
      const next = { ...state.messagesByRoom };
      let changed = false;
      // Group additions per already-loaded room, then sort each room once.
      for (const roomId of new Set(messages.map((m) => m.roomId))) {
        const loaded = next[roomId];
        if (!loaded) continue;
        const seen = new Set(loaded.map((m) => m.id));
        const additions = messages.filter((m) => m.roomId === roomId && !seen.has(m.id));
        if (additions.length === 0) continue;
        next[roomId] = [...loaded, ...additions].sort(byHlc);
        changed = true;
      }
      return changed ? { messagesByRoom: next } : state;
    });
    void useRoomStore.getState().loadRooms();
  },

  updateMessageStatus: (roomId, messageId, status) => {
    const loaded = get().messagesByRoom[roomId];
    if (!loaded) return;
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [roomId]: loaded.map((m) =>
          m.id === messageId ? { ...m, deliveryStatus: status } : m,
        ),
      },
    }));
  },

  refreshRoom: async (roomId) => {
    if (get().messagesByRoom[roomId]) await get().loadMessages(roomId);
  },
}));
