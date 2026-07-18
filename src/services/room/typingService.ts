import type { TypingMessage } from "../../types/wire";
import { getPeerRegistry } from "../peer/registry";
import { derivePeerId } from "../peer/derivePeerId";
import { useIdentityStore } from "../../stores/useIdentityStore";

/** Re-send "still typing" no more than this often while keystrokes continue —
 * one ping covers the receiver's expiry window, so we don't spam a packet per
 * keystroke. */
const THROTTLE_MS = 3_000;
/** After this long without a keystroke, tell peers we stopped. Must be shorter
 * than the receiver's expiry (TYPING_EXPIRY_MS) so the indicator clears from an
 * explicit stop in the normal case, not just the expiry backstop. */
const IDLE_MS = 4_000;

type RoomTypingState = { lastSentAt: number; idleTimer: ReturnType<typeof setTimeout> };
const active = new Map<string, RoomTypingState>();

function broadcast(memberIds: string[], data: TypingMessage) {
  const self = useIdentityStore.getState().self;
  const registry = getPeerRegistry();
  for (const id of memberIds) {
    if (id === self?.identityId) continue;
    registry.send(derivePeerId(id), data);
  }
}

/** Called on each keystroke. Sends a throttled `typing: true` and schedules an
 * automatic `typing: false` once the user goes idle. */
export function notifyTyping(roomId: string, memberIds: string[]) {
  const self = useIdentityStore.getState().self;
  if (!self) return;
  const now = Date.now();
  const existing = active.get(roomId);
  if (existing) clearTimeout(existing.idleTimer);

  const idleTimer = setTimeout(() => stopTyping(roomId, memberIds), IDLE_MS);

  // Throttle the "true" pings; the idle timer is always refreshed above.
  if (!existing || now - existing.lastSentAt >= THROTTLE_MS) {
    broadcast(memberIds, { type: "typing", roomId, fromId: self.identityId, typing: true });
    active.set(roomId, { lastSentAt: now, idleTimer });
  } else {
    active.set(roomId, { lastSentAt: existing.lastSentAt, idleTimer });
  }
}

/** Called on send, blur, or view unmount. Idempotent — a no-op if we weren't
 * marked typing in this room. */
export function stopTyping(roomId: string, memberIds: string[]) {
  const state = active.get(roomId);
  if (!state) return;
  clearTimeout(state.idleTimer);
  active.delete(roomId);
  const self = useIdentityStore.getState().self;
  if (!self) return;
  broadcast(memberIds, { type: "typing", roomId, fromId: self.identityId, typing: false });
}
