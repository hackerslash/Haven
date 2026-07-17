import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { AlertCircle, Check, CheckCheck, Clock, MessageSquare } from "lucide-react";
import type { DeliveryStatus, Message } from "../../types/domain";
import { useIdentityStore } from "../../stores/useIdentityStore";
import { useRosterStore } from "../../stores/useRosterStore";
import { Avatar } from "../ui/Avatar";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { cx } from "../../lib/cx";

const GROUP_GAP_MS = 5 * 60_000;

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function daySeparatorLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function DeliveryTick({ status }: { status: DeliveryStatus }) {
  switch (status) {
    case "pending":
      return <Clock size={12} className="text-text-muted" aria-label="Sending" />;
    case "sent":
      return <Check size={12} className="text-text-muted" aria-label="Sent" />;
    case "delivered":
      return <CheckCheck size={12} className="text-accent" aria-label="Delivered" />;
    case "failed":
      return <AlertCircle size={12} className="text-danger" aria-label="Failed to send" />;
  }
}

type MessageListProps = {
  /** undefined = still loading; [] = loaded and empty. */
  messages: Message[] | undefined;
  /** Optional intro shown above the first message (e.g. DM header). */
  intro?: React.ReactNode;
};

export function MessageList({ messages, intro }: MessageListProps) {
  const self = useIdentityStore((s) => s.self);
  const contactsById = useRosterStore((s) => s.contactsById);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const didInitialRender = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 120;
    if (nearBottom || !didInitialRender.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
    didInitialRender.current = true;
  }, [messages]);

  function authorName(authorId: string): string {
    if (authorId === self?.identityId) return self.displayName;
    return contactsById[authorId]?.displayName ?? "Unknown";
  }

  if (messages === undefined) {
    return (
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto">
        {intro}
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Say hello — messages are end-to-end between trusted devices."
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4" role="log">
      {intro}
      <ul>
        {messages.map((message, i) => {
          const prev = messages[i - 1];
          const isOwn = message.authorId === self?.identityId;
          const newDay =
            !prev || new Date(prev.sentAt).toDateString() !== new Date(message.sentAt).toDateString();
          const startsGroup =
            newDay ||
            !prev ||
            prev.authorId !== message.authorId ||
            message.sentAt - prev.sentAt > GROUP_GAP_MS;

          return (
            <li key={message.id}>
              {newDay && (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] font-semibold text-text-muted">
                    {daySeparatorLabel(message.sentAt)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <motion.div
                initial={didInitialRender.current ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className={cx(
                  "flex gap-2",
                  startsGroup ? "mt-3" : "mt-0.5",
                  isOwn ? "flex-row-reverse" : "flex-row",
                )}
              >
                {/* Avatar column (others only); spacer keeps continuations aligned */}
                {!isOwn &&
                  (startsGroup ? (
                    <Avatar id={message.authorId} name={authorName(message.authorId)} size="md" />
                  ) : (
                    <span className="w-8 shrink-0" />
                  ))}
                <div
                  className={cx(
                    "flex min-w-0 max-w-[75%] flex-col",
                    isOwn ? "items-end" : "items-start",
                  )}
                >
                  {startsGroup && !isOwn && (
                    <div className="mb-0.5 flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-text-primary">
                        {authorName(message.authorId)}
                      </span>
                      <span className="text-[11px] text-text-muted">{timeOf(message.sentAt)}</span>
                    </div>
                  )}
                  <div
                    className={cx(
                      "group flex items-end gap-1.5",
                      isOwn ? "flex-row-reverse" : "flex-row",
                    )}
                  >
                    <div
                      className={cx(
                        "select-text whitespace-pre-wrap break-words rounded-2xl px-3 py-1.5 text-sm",
                        isOwn
                          ? "bg-accent text-white"
                          : "bg-bg-tertiary text-text-primary",
                      )}
                    >
                      {message.body}
                    </div>
                    <span
                      className={cx(
                        "mb-0.5 flex shrink-0 items-center gap-1 text-[10px] text-text-muted",
                        "opacity-0 transition-opacity group-hover:opacity-100",
                      )}
                    >
                      {timeOf(message.sentAt)}
                      {isOwn && <DeliveryTick status={message.deliveryStatus} />}
                    </span>
                  </div>
                </div>
              </motion.div>
            </li>
          );
        })}
      </ul>
      <div ref={bottomRef} />
    </div>
  );
}
