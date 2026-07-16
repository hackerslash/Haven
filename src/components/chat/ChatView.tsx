import { useEffect, useState } from "react";
import { useIdentityStore } from "../../stores/useIdentityStore";
import { useRosterStore } from "../../stores/useRosterStore";
import { useChatStore } from "../../stores/useChatStore";
import { useRoomStore } from "../../stores/useRoomStore";
import { dmRoomId } from "../../services/room/chatService";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import type { Presence } from "../../types/domain";

const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  connecting: "Connecting…",
  offline: "Offline",
};

type ChatViewProps = {
  contactId: string;
};

export function ChatView({ contactId }: ChatViewProps) {
  const self = useIdentityStore((s) => s.self);
  const contact = useRosterStore((s) => s.contactsById[contactId]);
  const presence = useRosterStore((s) => s.presenceById[contactId]) ?? "offline";

  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setDraft = useChatStore((s) => s.setDraft);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);

  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!self) return;
    void dmRoomId(self.identityId, contactId).then((id) => {
      if (cancelled) return;
      setRoomId(id);
      setActiveRoom(id);
      void loadMessages(id);
    });
    return () => {
      cancelled = true;
    };
  }, [self, contactId, loadMessages, setActiveRoom]);

  const messages = useChatStore((s) => (roomId ? s.messagesByRoom[roomId] : undefined)) ?? [];
  const draft = useChatStore((s) => (roomId ? s.draftByRoom[roomId] : undefined)) ?? "";

  function handleSend() {
    if (!roomId) return;
    void sendMessage(roomId, [contactId], draft);
  }

  if (!contact) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        Contact not found.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="font-semibold">{contact.displayName}</h1>
        <span className="text-xs text-text-secondary">{PRESENCE_LABEL[presence]}</span>
      </header>
      <MessageList messages={messages} />
      <Composer
        value={draft}
        placeholder={`Message ${contact.displayName}`}
        onChange={(v) => roomId && setDraft(roomId, v)}
        onSend={handleSend}
      />
    </div>
  );
}
