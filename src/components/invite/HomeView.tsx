import { useState } from "react";
import { useRosterStore } from "../../stores/useRosterStore";

export function HomeView() {
  const createInvite = useRosterStore((s) => s.createInvite);
  const acceptInvite = useRosterStore((s) => s.acceptInvite);

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [joinInput, setJoinInput] = useState("");
  const [joinStatus, setJoinStatus] = useState<"idle" | "joining" | "error" | "joined">("idle");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleCreateInvite() {
    setInviteError(null);
    try {
      const link = await createInvite();
      setInviteLink(link);
      setCopied(false);
    } catch (err) {
      setInviteError(String(err));
    }
  }

  async function handleCopy() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinInput.trim() || joinStatus === "joining") return;
    setJoinStatus("joining");
    setJoinError(null);
    try {
      await acceptInvite(joinInput.trim());
      setJoinStatus("joined");
      setJoinInput("");
    } catch (err) {
      setJoinStatus("error");
      setJoinError(String(err));
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4 p-6">
      <div className="rounded-xl bg-bg-secondary p-4">
        <h2 className="text-sm font-semibold">Invite someone</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Share this with someone once — they'll be permanently trusted after.
        </p>
        <button
          onClick={handleCreateInvite}
          className="mt-3 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Create invite
        </button>
        {inviteError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {inviteError}
          </p>
        )}
        {inviteLink && (
          <div className="mt-3">
            <textarea
              readOnly
              value={inviteLink}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-bg-tertiary p-2 font-mono text-xs text-text-primary"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopy}
              className="mt-2 rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-bg-tertiary"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleJoin} className="rounded-xl bg-bg-secondary p-4">
        <h2 className="text-sm font-semibold">Join with an invite</h2>
        <textarea
          value={joinInput}
          onChange={(e) => setJoinInput(e.target.value)}
          rows={3}
          placeholder="Paste an invite here…"
          className="mt-2 w-full resize-none rounded-lg border border-border bg-bg-tertiary p-2 font-mono text-xs text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <button
          type="submit"
          disabled={!joinInput.trim() || joinStatus === "joining"}
          className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {joinStatus === "joining" ? "Connecting…" : "Connect"}
        </button>
        {joinStatus === "error" && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {joinError}
          </p>
        )}
        {joinStatus === "joined" && (
          <p role="status" className="mt-2 text-sm text-success">
            You're now trusted with that member.
          </p>
        )}
      </form>
    </div>
  );
}
