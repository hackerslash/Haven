import { getDb } from "./client";

type RoomMemberRow = {
  room_id: string;
  contact_id: string;
  role: "owner" | "member";
  joined_at: number;
  last_read_seq: number;
  notifications_muted: number;
};

export async function listMembers(roomId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<RoomMemberRow[]>(
    "SELECT contact_id FROM room_members WHERE room_id = $1",
    [roomId],
  );
  return rows.map((r) => r.contact_id);
}

/** Group room ids we share with a given contact — used to backfill each
 * shared room's chat when that peer reconnects. */
export async function sharedGroupRoomIds(contactId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ room_id: string }[]>(
    `SELECT rm.room_id FROM room_members rm
       JOIN rooms r ON r.id = rm.room_id
      WHERE rm.contact_id = $1 AND r.type = 'group'`,
    [contactId],
  );
  return rows.map((r) => r.room_id);
}

export async function addMember(
  roomId: string,
  contactId: string,
  role: "owner" | "member",
  joinedAt: number,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO room_members (room_id, contact_id, role, joined_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(room_id, contact_id) DO NOTHING`,
    [roomId, contactId, role, joinedAt],
  );
}
