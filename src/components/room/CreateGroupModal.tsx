import { useState } from "react";
import { useRosterStore } from "../../stores/useRosterStore";
import { useRoomStore } from "../../stores/useRoomStore";
import { useIdentityStore } from "../../stores/useIdentityStore";
import { createGroupRoom } from "../../services/room/roomService";

type CreateGroupModalProps = {
  onClose: () => void;
  onCreated: (roomId: string) => void;
};

export function CreateGroupModal({ onClose, onCreated }: CreateGroupModalProps) {
  const self = useIdentityStore((s) => s.self);
  const contactsById = useRosterStore((s) => s.contactsById);
  const loadRooms = useRoomStore((s) => s.loadRooms);
  const contacts = Object.values(contactsById).filter((c) => !c.revoked);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!self || !name.trim() || selected.size === 0 || submitting) return;
    setSubmitting(true);
    try {
      const roomId = await createGroupRoom(self, name.trim(), Array.from(selected));
      await loadRooms();
      onCreated(roomId);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-96 rounded-2xl bg-bg-secondary p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create a room"
      >
        <h2 className="text-lg font-semibold text-text-primary">Create a room</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Room name"
          maxLength={48}
          className="mt-4 w-full rounded-lg border border-border bg-bg-tertiary px-3 py-2 text-text-primary outline-none focus:ring-2 focus:ring-accent"
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Members
        </p>
        <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
          {contacts.map((contact) => (
            <li key={contact.identityId}>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-bg-tertiary">
                <input
                  type="checkbox"
                  checked={selected.has(contact.identityId)}
                  onChange={() => toggle(contact.identityId)}
                />
                <span className="text-sm text-text-primary">{contact.displayName}</span>
              </label>
            </li>
          ))}
          {contacts.length === 0 && (
            <li className="text-sm text-text-secondary">Invite some contacts first.</li>
          )}
        </ul>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-bg-tertiary"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || selected.size === 0 || submitting}
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
