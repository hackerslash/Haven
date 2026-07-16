import { create } from "zustand";
import type { Identity } from "../types/domain";
import type { PresenterSlotWire } from "../types/wire";
import * as roomCallService from "../services/call/roomCallService";
import * as roomMembersRepo from "../services/db/roomMembersRepo";
import { useIdentityStore } from "./useIdentityStore";

type RoomCallState = {
  roomId: string | null;
  participants: string[];
  slots: PresenterSlotWire[];
  streamsByParticipant: Record<string, MediaStream>;
  connectionByParticipant: Record<string, RTCPeerConnectionState>;
  localStream: MediaStream | null;
  micOn: boolean;
  presenting: boolean;
  presentError: string | null;

  join: (roomId: string) => Promise<void>;
  leave: () => void;
  toggleMic: () => void;
  startPresenting: () => Promise<void>;
  stopPresenting: () => void;

  _setSession: (roomId: string) => void;
  _setParticipants: (ids: string[]) => void;
  _removeParticipant: (id: string) => void;
  _setSlots: (slots: PresenterSlotWire[]) => void;
  _setParticipantStream: (id: string, stream: MediaStream) => void;
  _setParticipantConnection: (id: string, state: RTCPeerConnectionState) => void;
  _setLocalStream: (stream: MediaStream | null) => void;
  _setMicOn: (on: boolean) => void;
  _setPresenting: (on: boolean) => void;
  _setPresentError: (error: string | null) => void;
  _clear: () => void;
};

function requireSelf(): Identity {
  const self = useIdentityStore.getState().self;
  if (!self) throw new Error("no local identity");
  return self;
}

export const useRoomCallStore = create<RoomCallState>((set) => ({
  roomId: null,
  participants: [],
  slots: [],
  streamsByParticipant: {},
  connectionByParticipant: {},
  localStream: null,
  micOn: true,
  presenting: false,
  presentError: null,

  join: async (roomId) => {
    const self = requireSelf();
    const memberIds = await roomMembersRepo.listMembers(roomId);
    await roomCallService.joinRoomCall(self, roomId, memberIds);
  },
  leave: () => roomCallService.leaveRoomCall(),
  toggleMic: () => roomCallService.toggleMic(),
  startPresenting: () => roomCallService.startPresenting(),
  stopPresenting: () => roomCallService.stopPresenting(),

  _setSession: (roomId) => set({ roomId, presentError: null }),
  _setParticipants: (ids) => set({ participants: ids }),
  _removeParticipant: (id) =>
    set((s) => {
      const streams = { ...s.streamsByParticipant };
      const conns = { ...s.connectionByParticipant };
      delete streams[id];
      delete conns[id];
      return {
        participants: s.participants.filter((p) => p !== id),
        streamsByParticipant: streams,
        connectionByParticipant: conns,
      };
    }),
  _setSlots: (slots) => set({ slots }),
  _setParticipantStream: (id, stream) =>
    set((s) => ({ streamsByParticipant: { ...s.streamsByParticipant, [id]: stream } })),
  _setParticipantConnection: (id, state) =>
    set((s) => ({ connectionByParticipant: { ...s.connectionByParticipant, [id]: state } })),
  _setLocalStream: (stream) => set({ localStream: stream }),
  _setMicOn: (on) => set({ micOn: on }),
  _setPresenting: (on) => set({ presenting: on }),
  _setPresentError: (error) => set({ presentError: error }),
  _clear: () =>
    set({
      roomId: null,
      participants: [],
      slots: [],
      streamsByParticipant: {},
      connectionByParticipant: {},
      localStream: null,
      micOn: true,
      presenting: false,
      presentError: null,
    }),
}));
