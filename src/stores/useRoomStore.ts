import { create } from "zustand";
import type { Room } from "../types/domain";
import * as roomRepo from "../services/db/roomRepo";

type RoomState = {
  roomsById: Record<string, Room>;
  activeRoomId: string | null;

  loadRooms: () => Promise<void>;
  setActiveRoom: (id: string | null) => void;
  upsertRoomLocal: (room: Room) => void;
};

export const useRoomStore = create<RoomState>((set) => ({
  roomsById: {},
  activeRoomId: null,

  loadRooms: async () => {
    const rooms = await roomRepo.listRooms();
    set({ roomsById: Object.fromEntries(rooms.map((r) => [r.id, r])) });
  },

  setActiveRoom: (id) => set({ activeRoomId: id }),

  upsertRoomLocal: (room) =>
    set((state) => ({ roomsById: { ...state.roomsById, [room.id]: room } })),
}));
