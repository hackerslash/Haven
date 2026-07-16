// Wire formats exchanged between trusted peers. Kept separate from
// types/domain.ts (local persisted shapes) since these cross the network
// and are versioned/signed independently of how we store things locally.

export type InvitePayload = {
  v: 1;
  inviterId: string;
  inviterPubKey: string;
  inviterPeerId: string;
  inviteToken: string;
  createdAt: number;
  expiresAt: number;
};

export type SignedInvitePayload = InvitePayload & { sig: string };

export type RosterEntryWire = {
  identityId: string;
  publicKey: string;
  displayName: string;
  addedBy: string;
  addedAt: number;
  updatedAt: number;
  revoked: boolean;
  revokedAt: number | null;
  revokedBy: string | null;
};

export type InviteConsumeMessage = {
  type: "invite_consume";
  inviteToken: string;
  inviteeId: string;
  inviteePubKey: string;
  inviteeDisplayName: string;
  ts: number;
  sig: string;
};

export type InviteAckMessage = {
  type: "invite_ack";
  inviteToken: string;
  accepted: boolean;
  reason?: string;
  roster: RosterEntryWire[];
  sig: string;
};

export type RosterSyncMessage = {
  type: "roster_sync";
  entries: RosterEntryWire[];
};

export type ChatMessageWire = {
  id: string;
  roomId: string;
  authorId: string;
  authorSeq: number;
  hlc: string;
  contentType: "text" | "image" | "file" | "system";
  body: string | null;
  replyToId: string | null;
  sentAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  sig: string;
};

export type ChatMessageMessage = {
  type: "chat_message";
  message: ChatMessageWire;
};

/** DM rooms have deterministic IDs derived from the two member identityIds
 * (see roomService.dmRoomId), so both sides independently agree on the room a
 * message belongs to without exchanging room metadata. This carries the
 * highest author_seq the requester already has per author, so the responder
 * sends only the gap. */
export type RoomSyncRequestMessage = {
  type: "room_sync_request";
  roomId: string;
  have: Record<string, number>;
};

export type RoomSyncResponseMessage = {
  type: "room_sync_response";
  roomId: string;
  messages: ChatMessageWire[];
};

// --- Call control (a layer above raw negotiation) ---

export type CallInviteMessage = {
  type: "call_invite";
  roomId: string;
  fromId: string;
};

export type CallAcceptMessage = {
  type: "call_accept";
  roomId: string;
  fromId: string;
};

export type CallDeclineMessage = {
  type: "call_decline";
  roomId: string;
  fromId: string;
};

export type CallHangupMessage = {
  type: "call_hangup";
  roomId: string;
  fromId: string;
};

// --- Perfect-negotiation signaling (SDP + ICE), relayed over the PeerJS
// data connection. `channel` says which session the message belongs to so a
// 1:1 ring call and a group room mesh never cross-talk: "dm" routes to the
// 1:1 callService, a roomId string routes to that room's mesh session. ---

export type SignalChannel = "dm" | string;

export type RtcDescriptionMessage = {
  type: "rtc_description";
  channel: SignalChannel;
  fromId: string;
  description: RTCSessionDescriptionInit;
};

export type RtcCandidateMessage = {
  type: "rtc_candidate";
  channel: SignalChannel;
  fromId: string;
  candidate: RTCIceCandidateInit;
};

// --- Group room calls: join/leave a room's mesh session, plus the 2-slot
// presenter coordination (epoch + absolute-time lease, no central arbiter). ---

export type RoomCallJoinMessage = {
  type: "room_call_join";
  roomId: string;
  fromId: string;
};

export type RoomCallLeaveMessage = {
  type: "room_call_leave";
  roomId: string;
  fromId: string;
};

/** Reply to a join, telling the newcomer who is already present (and current
 * slot state) so they can build the right mesh links immediately. */
export type RoomCallPresenceMessage = {
  type: "room_call_presence";
  roomId: string;
  fromId: string;
  participants: string[];
  slots: PresenterSlotWire[];
};

export type PresenterSlotWire = {
  slotIndex: 0 | 1;
  holderId: string | null;
  epoch: number;
  leaseExpiresAt: number;
  mediaKind: "camera" | "screen" | null;
};

export type SlotClaimMessage = {
  type: "slot_claim";
  roomId: string;
  slotIndex: 0 | 1;
  claimantId: string;
  epoch: number;
  leaseExpiresAt: number;
  mediaKind: "camera" | "screen";
};

export type SlotHeartbeatMessage = {
  type: "slot_heartbeat";
  roomId: string;
  slotIndex: 0 | 1;
  holderId: string;
  epoch: number;
  leaseExpiresAt: number;
  mediaKind: "camera" | "screen";
};

export type SlotReleaseMessage = {
  type: "slot_release";
  roomId: string;
  slotIndex: 0 | 1;
  holderId: string;
  epoch: number;
};

// --- Group room membership announcement ---

export type RoomAnnounceMessage = {
  type: "room_announce";
  room: {
    id: string;
    name: string | null;
    topic: string | null;
    createdBy: string;
    createdAt: number;
  };
  memberIds: string[];
};

export type HavenMessage =
  | InviteConsumeMessage
  | InviteAckMessage
  | RosterSyncMessage
  | ChatMessageMessage
  | RoomSyncRequestMessage
  | RoomSyncResponseMessage
  | CallInviteMessage
  | CallAcceptMessage
  | CallDeclineMessage
  | CallHangupMessage
  | RtcDescriptionMessage
  | RtcCandidateMessage
  | RoomCallJoinMessage
  | RoomCallLeaveMessage
  | RoomCallPresenceMessage
  | SlotClaimMessage
  | SlotHeartbeatMessage
  | SlotReleaseMessage
  | RoomAnnounceMessage;
