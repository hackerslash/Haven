import { useEffect, useState } from "react";
import { useChatStore } from "../../stores/useChatStore";
import { useRoomStore } from "../../stores/useRoomStore";
import { useRoomCallStore } from "../../stores/useRoomCallStore";
import { useIdentityStore } from "../../stores/useIdentityStore";
import * as roomMembersRepo from "../../services/db/roomMembersRepo";
import { MessageList } from "../chat/MessageList";
import { Composer } from "../chat/Composer";
import { RoomCallView } from "../call/RoomCallView";

type GroupRoomViewProps = {
  roomId: string;
};

export function GroupRoomView({ roomId }: GroupRoomViewProps) {
  const self = useIdentityStore((s) => s.self);
  const room = useRoomStore((s) => s.roomsById[roomId]);
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom);

  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setDraft = useChatStore((s) => s.setDraft);
  const messages = useChatStore((s) => s.messagesByRoom[roomId]) ?? [];
  const draft = useChatStore((s) => s.draftByRoom[roomId]) ?? "";

  const callRoomId = useRoomCallStore((s) => s.roomId);
  const joinCall = useRoomCallStore((s) => s.join);

  const [memberIds, setMemberIds] = useState<string[]>([]);
  const inThisCall = callRoomId === roomId;
  const inAnotherCall = callRoomId !== null && callRoomId !== roomId;

  useEffect(() => {
    setActiveRoom(roomId);
    void loadMessages(roomId);
    void roomMembersRepo.listMembers(roomId).then(setMemberIds);
  }, [roomId, loadMessages, setActiveRoom]);

  function handleSend() {
    const others = memberIds.filter((id) => id !== self?.identityId);
    void sendMessage(roomId, others, draft);
  }

  if (!room) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        Room not found.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h1 className="font-semibold">{room.name ?? "Room"}</h1>
        <span className="text-xs text-text-secondary">{memberIds.length} members</span>
        <div className="ml-auto">
          {!inThisCall && (
            <button
              onClick={() => joinCall(roomId)}
              disabled={inAnotherCall}
              title={inAnotherCall ? "Leave your current call first" : "Join the voice/video room"}
              className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-bg-tertiary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Join call
            </button>
          )}
        </div>
      </header>

      {inThisCall ? (
        <RoomCallView />
      ) : (
        <>
          <MessageList messages={messages} />
          <Composer
            value={draft}
            placeholder={`Message ${room.name ?? "the room"}`}
            onChange={(v) => setDraft(roomId, v)}
            onSend={handleSend}
          />
        </>
      )}
    </div>
  );
}
