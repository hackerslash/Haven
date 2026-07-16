import { useRosterStore } from "../../stores/useRosterStore";
import type { Presence } from "../../types/domain";

const PRESENCE_DOT: Record<Presence, string> = {
  online: "bg-success",
  connecting: "bg-warning",
  offline: "bg-text-secondary",
};

const PRESENCE_LABEL: Record<Presence, string> = {
  online: "Online",
  connecting: "Connecting…",
  offline: "Offline",
};

type SidebarProps = {
  selectedContactId: string | null;
  onSelectHome: () => void;
  onSelectContact: (contactId: string) => void;
};

export function Sidebar({ selectedContactId, onSelectHome, onSelectContact }: SidebarProps) {
  const contactsById = useRosterStore((s) => s.contactsById);
  const presenceById = useRosterStore((s) => s.presenceById);
  const contacts = Object.values(contactsById).filter((c) => !c.revoked);

  return (
    <nav
      aria-label="Conversations"
      className="flex w-64 shrink-0 flex-col border-r border-border bg-bg-secondary"
    >
      <button
        onClick={onSelectHome}
        className={`m-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
          selectedContactId === null ? "bg-bg-tertiary" : "hover:bg-bg-tertiary"
        }`}
      >
        Home &amp; invites
      </button>

      <div className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Direct Messages — {contacts.length}
      </div>

      <ul className="flex-1 overflow-y-auto px-2">
        {contacts.map((contact) => {
          const presence = presenceById[contact.identityId] ?? "offline";
          const active = selectedContactId === contact.identityId;
          return (
            <li key={contact.identityId}>
              <button
                onClick={() => onSelectContact(contact.identityId)}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                  active ? "bg-bg-tertiary" : "hover:bg-bg-tertiary"
                }`}
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${PRESENCE_DOT[presence]}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{contact.displayName}</span>
                  <span className="block text-xs text-text-secondary">
                    {PRESENCE_LABEL[presence]}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        {contacts.length === 0 && (
          <li className="px-2 py-1.5 text-sm text-text-secondary">No contacts yet.</li>
        )}
      </ul>
    </nav>
  );
}
