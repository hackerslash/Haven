import { useEffect, useState } from "react";
import { useTypingStore } from "../../stores/useTypingStore";
import { useRosterStore } from "../../stores/useRosterStore";

type TypingIndicatorProps = {
  roomId: string | null | undefined;
};

function label(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]} are typing`;
  return "Several people are typing";
}

export function TypingIndicator({ roomId }: TypingIndicatorProps) {
  const typingByRoom = useTypingStore((s) => (roomId ? s.typingByRoom[roomId] : undefined));
  const contactsById = useRosterStore((s) => s.contactsById);

  // Re-render on the same cadence as the store sweep so an entry that expires
  // between store writes still disappears promptly.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!typingByRoom || Object.keys(typingByRoom).length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, [typingByRoom]);

  const now = Date.now();
  const typists = Object.entries(typingByRoom ?? {})
    .filter(([, expiry]) => expiry > now)
    .map(([userId]) => contactsById[userId]?.displayName ?? "Someone");

  return (
    <div className="mx-auto h-5 max-w-2xl px-4 text-xs text-text-secondary" aria-live="polite">
      {typists.length > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="flex gap-0.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" />
          </span>
          <span className="truncate">{label(typists)}</span>
        </span>
      )}
    </div>
  );
}
