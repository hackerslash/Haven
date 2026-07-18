import type { ConnectionQuality } from "../../services/call/PeerConnectionWrapper";

/** Tailwind background class for a connection-quality indicator dot. Shared by
 * every call surface so the color→quality mapping can't drift between them. */
export const QUALITY_DOT: Record<ConnectionQuality, string> = {
  good: "bg-success",
  fair: "bg-warning",
  poor: "bg-danger",
  unknown: "bg-text-muted",
};

/** Human-readable label for a connection quality. */
export const QUALITY_LABEL: Record<ConnectionQuality, string> = {
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  unknown: "Measuring…",
};
