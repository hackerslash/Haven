import { useRoomCallStore } from "../../stores/useRoomCallStore";
import { useRosterStore } from "../../stores/useRosterStore";
import { useIdentityStore } from "../../stores/useIdentityStore";
import { VideoTile } from "./VideoTile";

function useNameLookup() {
  const self = useIdentityStore((s) => s.self);
  const contactsById = useRosterStore((s) => s.contactsById);
  return (id: string) =>
    id === self?.identityId ? "You" : (contactsById[id]?.displayName ?? "Unknown");
}

export function RoomCallView() {
  const self = useIdentityStore((s) => s.self);
  const participants = useRoomCallStore((s) => s.participants);
  const slots = useRoomCallStore((s) => s.slots);
  const streamsByParticipant = useRoomCallStore((s) => s.streamsByParticipant);
  const qualityByParticipant = useRoomCallStore((s) => s.qualityByParticipant);
  const localStream = useRoomCallStore((s) => s.localStream);
  const micOn = useRoomCallStore((s) => s.micOn);
  const presenting = useRoomCallStore((s) => s.presenting);
  const presentError = useRoomCallStore((s) => s.presentError);

  const leave = useRoomCallStore((s) => s.leave);
  const toggleMic = useRoomCallStore((s) => s.toggleMic);
  const startPresenting = useRoomCallStore((s) => s.startPresenting);
  const stopPresenting = useRoomCallStore((s) => s.stopPresenting);

  const nameOf = useNameLookup();
  const presenterIds = slots.map((s) => s.holderId).filter((id): id is string => id !== null);
  const slotsFull = presenterIds.length >= 2 && !presenting;

  function streamFor(id: string): MediaStream | null {
    if (id === self?.identityId) return localStream;
    return streamsByParticipant[id] ?? null;
  }

  const QUALITY_DOT: Record<string, string> = {
    good: "bg-success",
    fair: "bg-warning",
    poor: "bg-danger",
    unknown: "bg-text-secondary",
  };
  function dotFor(id: string): string {
    if (id === self?.identityId) return "bg-success";
    return QUALITY_DOT[qualityByParticipant[id] ?? "unknown"];
  }

  return (
    <div className="flex flex-1 flex-col bg-bg-primary">
      {/* Presenter stage — the up-to-2 active presenters */}
      <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-4 md:grid-cols-2">
        {presenterIds.length === 0 && (
          <div className="col-span-full flex items-center justify-center text-sm text-text-secondary">
            No one is presenting. Click “Present” to share your camera.
          </div>
        )}
        {presenterIds.map((id) => {
          const stream = streamFor(id);
          return (
            <VideoTile
              key={id}
              stream={stream}
              muted={id === self?.identityId}
              mirror={id === self?.identityId}
              label={nameOf(id)}
              hasVideo={(stream?.getVideoTracks().length ?? 0) > 0}
            />
          );
        })}
      </div>

      {/* Viewer thumbnail strip — everyone present, audio-only or not */}
      <div className="flex gap-2 overflow-x-auto border-t border-border px-4 py-2">
        {participants.map((id) => (
          <div
            key={id}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-bg-secondary px-3 py-1.5"
          >
            <span className={`h-2 w-2 rounded-full ${dotFor(id)}`} aria-hidden="true" />
            <span className="text-xs text-text-primary">{nameOf(id)}</span>
            {presenterIds.includes(id) && (
              <span className="rounded bg-accent px-1 text-[10px] font-medium text-white">
                live
              </span>
            )}
          </div>
        ))}
      </div>

      {presentError && (
        <p role="alert" className="px-4 py-1 text-center text-xs text-danger">
          {presentError}
        </p>
      )}

      <footer className="flex items-center justify-center gap-3 border-t border-border py-3">
        <button
          onClick={toggleMic}
          aria-pressed={!micOn}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            micOn ? "bg-bg-tertiary text-text-primary" : "bg-danger text-white"
          }`}
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        {presenting ? (
          <button
            onClick={stopPresenting}
            className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
          >
            Stop presenting
          </button>
        ) : (
          <>
            <button
              onClick={() => startPresenting("camera")}
              disabled={slotsFull}
              title={slotsFull ? "Both presenter slots are taken" : "Share your camera"}
              className="rounded-full bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Present
            </button>
            <button
              onClick={() => startPresenting("screen")}
              disabled={slotsFull}
              title={slotsFull ? "Both presenter slots are taken" : "Share your screen"}
              className="rounded-full bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Share screen
            </button>
          </>
        )}
        <button
          onClick={leave}
          className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white"
        >
          Leave
        </button>
      </footer>
    </div>
  );
}
