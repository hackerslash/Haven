import { create } from "zustand";

/** Backstop expiry: if a peer's `typing: false` is lost (they disconnected
 * mid-type), the indicator still clears this long after their last ping. Must
 * be longer than the sender's re-ping throttle so a steady typist never blinks
 * out between pings. */
const TYPING_EXPIRY_MS = 6_000;

type TypingState = {
  /** roomId -> (userId -> expiry timestamp). A user is "typing" while now < expiry. */
  typingByRoom: Record<string, Record<string, number>>;
  /** Bridge-called: a typing signal arrived from a trusted peer. */
  setTyping: (roomId: string, userId: string, typing: boolean) => void;
  /** Live typist ids for a room (expired entries filtered out). */
  typistsIn: (roomId: string) => string[];
};

let sweepTimer: ReturnType<typeof setInterval> | null = null;

export const useTypingStore = create<TypingState>((set, get) => ({
  typingByRoom: {},

  setTyping: (roomId, userId, typing) => {
    set((state) => {
      const room = { ...(state.typingByRoom[roomId] ?? {}) };
      if (typing) room[userId] = Date.now() + TYPING_EXPIRY_MS;
      else delete room[userId];
      return { typingByRoom: { ...state.typingByRoom, [roomId]: room } };
    });

    // A single low-frequency sweep drops entries whose expiry passed (covers a
    // lost `typing: false`); it stops itself once nothing is typing anywhere.
    if (typing && !sweepTimer) {
      sweepTimer = setInterval(() => {
        const now = Date.now();
        let anyLive = false;
        set((state) => {
          const next: Record<string, Record<string, number>> = {};
          let changed = false;
          for (const [rid, users] of Object.entries(state.typingByRoom)) {
            const kept: Record<string, number> = {};
            for (const [uid, expiry] of Object.entries(users)) {
              if (expiry > now) {
                kept[uid] = expiry;
                anyLive = true;
              } else {
                changed = true;
              }
            }
            if (Object.keys(kept).length > 0) next[rid] = kept;
            else if (Object.keys(users).length > 0) changed = true;
          }
          return changed ? { typingByRoom: next } : state;
        });
        if (!anyLive && sweepTimer) {
          clearInterval(sweepTimer);
          sweepTimer = null;
        }
      }, 1_000);
    }
  },

  typistsIn: (roomId) => {
    const now = Date.now();
    const room = get().typingByRoom[roomId] ?? {};
    return Object.entries(room)
      .filter(([, expiry]) => expiry > now)
      .map(([userId]) => userId);
  },
}));
