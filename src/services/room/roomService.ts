import type { Identity } from "../../types/domain";
import type { RoomAnnounceMessage } from "../../types/wire";
import * as roomRepo from "../db/roomRepo";
import * as roomMembersRepo from "../db/roomMembersRepo";
import * as rosterRepo from "../db/rosterRepo";
import { getPeerRegistry } from "../peer/registry";
import { derivePeerId } from "../peer/derivePeerId";

/** Group room id: random uuid (unlike DM rooms, membership is explicit and
 * not derivable from a pair of identities). */
export async function createGroupRoom(
  self: Identity,
  name: string,
  memberIds: string[],
): Promise<string> {
  const now = Date.now();
  const roomId = `grp_${crypto.randomUUID().replace(/-/g, "")}`;

  await roomRepo.upsertGroupRoom({
    id: roomId,
    name,
    topic: null,
    createdBy: self.identityId,
    createdAt: now,
  });
  await roomMembersRepo.addMember(roomId, self.identityId, "owner", now);
  for (const m of memberIds) await roomMembersRepo.addMember(roomId, m, "member", now);

  await announceRoom(self, roomId);
  return roomId;
}

/** Broadcasts room metadata + membership to every member we can reach, so
 * they materialize the same room locally. Called on create and on demand. */
export async function announceRoom(self: Identity, roomId: string): Promise<void> {
  const room = await roomRepo.getRoom(roomId);
  if (!room || room.type !== "group") return;
  const memberIds = await roomMembersRepo.listMembers(roomId);

  const message: RoomAnnounceMessage = {
    type: "room_announce",
    room: {
      id: room.id,
      name: room.name,
      topic: room.topic,
      createdBy: room.createdBy ?? self.identityId,
      createdAt: room.createdAt,
    },
    memberIds,
  };

  const registry = getPeerRegistry();
  for (const memberId of memberIds) {
    if (memberId === self.identityId) continue;
    registry.send(derivePeerId(memberId), message);
  }
}

export async function handleRoomAnnounce(self: Identity, msg: RoomAnnounceMessage): Promise<void> {
  // Only materialize rooms we're actually a member of, and only wire in
  // members we already trust (ignore unknown identities in the list).
  if (!msg.memberIds.includes(self.identityId)) return;

  await roomRepo.upsertGroupRoom(msg.room);
  const now = Date.now();
  for (const memberId of msg.memberIds) {
    if (memberId !== self.identityId) {
      const contact = await rosterRepo.getContact(memberId);
      if (!contact) continue;
    }
    const role = memberId === msg.room.createdBy ? "owner" : "member";
    await roomMembersRepo.addMember(msg.room.id, memberId, role, now);
  }
}
