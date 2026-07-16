import { useCallStore } from "../../stores/useCallStore";
import { useRosterStore } from "../../stores/useRosterStore";
import { VideoTile } from "./VideoTile";

function useRemoteName(remoteId: string | undefined): string {
  const contact = useRosterStore((s) => (remoteId ? s.contactsById[remoteId] : undefined));
  return contact?.displayName ?? "Unknown";
}

export function CallOverlay() {
  const activeCall = useCallStore((s) => s.activeCall);
  const localStream = useCallStore((s) => s.localStream);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const micOn = useCallStore((s) => s.micOn);
  const camOn = useCallStore((s) => s.camOn);
  const screenOn = useCallStore((s) => s.screenOn);
  const screenError = useCallStore((s) => s.screenError);
  const connectionState = useCallStore((s) => s.connectionState);
  const quality = useCallStore((s) => s.quality);

  const acceptCall = useCallStore((s) => s.acceptCall);
  const declineCall = useCallStore((s) => s.declineCall);
  const hangUp = useCallStore((s) => s.hangUp);
  const toggleMic = useCallStore((s) => s.toggleMic);
  const toggleCam = useCallStore((s) => s.toggleCam);
  const toggleScreenShare = useCallStore((s) => s.toggleScreenShare);

  const remoteName = useRemoteName(activeCall?.remoteId);

  if (!activeCall) return null;

  if (activeCall.status === "incoming") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="w-80 rounded-2xl bg-bg-secondary p-6 text-center shadow-xl">
          <p className="text-lg font-semibold text-text-primary">{remoteName}</p>
          <p className="mt-1 text-sm text-text-secondary">Incoming call…</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={declineCall}
              className="rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white"
            >
              Decline
            </button>
            <button
              onClick={acceptCall}
              className="rounded-lg bg-success px-4 py-2 text-sm font-medium text-white"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reconnecting =
    activeCall.status === "active" &&
    (connectionState === "disconnected" || connectionState === "failed");

  const statusLabel =
    activeCall.status === "outgoing"
      ? "Calling…"
      : activeCall.status === "connecting"
        ? "Connecting…"
        : reconnecting
          ? "Reconnecting…"
          : connectionState === "connected"
            ? "Connected"
            : connectionState;

  const QUALITY_DOT: Record<string, string> = {
    good: "bg-success",
    fair: "bg-warning",
    poor: "bg-danger",
    unknown: "bg-text-secondary",
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <p className="font-semibold text-text-primary">{remoteName}</p>
          <p className="flex items-center gap-1.5 text-xs text-text-secondary" role="status" aria-live="polite">
            {activeCall.status === "active" && !reconnecting && (
              <span className={`h-2 w-2 rounded-full ${QUALITY_DOT[quality]}`} aria-hidden="true" />
            )}
            {statusLabel}
          </p>
        </div>
      </header>
      {reconnecting && (
        <div className="bg-warning/15 px-6 py-1.5 text-center text-xs text-warning" role="status">
          Connection interrupted — trying to reconnect…
        </div>
      )}
      {screenError && (
        <div className="bg-danger/15 px-6 py-1.5 text-center text-xs text-danger" role="alert">
          {screenError}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto p-6 md:grid-cols-2">
        <VideoTile
          stream={remoteStream}
          label={remoteName}
          hasVideo={(remoteStream?.getVideoTracks().length ?? 0) > 0}
        />
        <VideoTile
          stream={localStream}
          label={screenOn ? "You (screen)" : "You"}
          muted
          mirror={!screenOn}
          hasVideo={(camOn || screenOn) && (localStream?.getVideoTracks().length ?? 0) > 0}
        />
      </div>

      <footer className="flex items-center justify-center gap-3 border-t border-border py-4">
        <button
          onClick={toggleMic}
          aria-pressed={!micOn}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            micOn ? "bg-bg-tertiary text-text-primary" : "bg-danger text-white"
          }`}
        >
          {micOn ? "Mute" : "Unmute"}
        </button>
        <button
          onClick={toggleCam}
          aria-pressed={camOn}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            camOn ? "bg-accent text-white" : "bg-bg-tertiary text-text-primary"
          }`}
        >
          {camOn ? "Stop video" : "Start video"}
        </button>
        <button
          onClick={() => void toggleScreenShare()}
          aria-pressed={screenOn}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            screenOn ? "bg-accent text-white" : "bg-bg-tertiary text-text-primary"
          }`}
        >
          {screenOn ? "Stop sharing" : "Share screen"}
        </button>
        <button
          onClick={hangUp}
          className="rounded-full bg-danger px-4 py-2 text-sm font-medium text-white"
        >
          Leave
        </button>
      </footer>
    </div>
  );
}
