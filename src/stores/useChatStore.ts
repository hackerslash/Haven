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
  /** Bridge-called: a delivery receipt arrived; the repo row is already updated. */
  updateMessageStatus: (roomId: string, messageId: string, status: DeliveryStatus) => void;
  /** Reloads a room's messages from the DB, but only if it's already loaded. */
  refreshRoom: (roomId: string) => Promise<void>;
};

function insertOrdered(list: Message[], message: Message): Message[] {
  if (list.some((m) => m.id === message.id)) return list;
  const next = [...list, message];
  next.sort((a, b) => (a.hlc < b.hlc ? -1 : a.hlc > b.hlc ? 1 : 0));
  return next;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByRoom: {},
  draftByRoom: {},

  loadMessages: async (roomId) => {
    const messages = await messageRepo.listByRoom(roomId);
    set((state) => ({ messagesByRoom: { ...state.messagesByRoom, [roomId]: messages } }));
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
    const loaded = get().messagesByRoom[message.roomId];
    if (loaded) {
      set((state) => ({
        messagesByRoom: {
          ...state.messagesByRoom,
          [message.roomId]: insertOrdered(loaded, message),
        },
      }));
    }
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
