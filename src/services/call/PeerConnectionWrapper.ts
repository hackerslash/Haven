import { ICE_SERVERS } from "../peer/iceServers";

export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

export type PeerConnectionCallbacks = {
  /** Send an SDP offer/answer to the remote via the signaling transport. */
  onDescription: (description: RTCSessionDescriptionInit) => void;
  /** Send a local ICE candidate to the remote. */
  onCandidate: (candidate: RTCIceCandidateInit) => void;
  /** A remote media stream became available (or its tracks changed). */
  onRemoteStream: (stream: MediaStream) => void;
  /** Connection state transitions, for UI + higher-level recovery logic. */
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  /** Measured link quality, updated from getStats() every couple seconds. */
  onQuality?: (quality: ConnectionQuality) => void;
};

// Adaptive-bitrate tiers (bps) for the video sender, from 1080p-ish down to a
// last-ditch low. We nudge maxBitrate between these based on measured loss/RTT;
// libwebrtc's own congestion control still operates under whatever ceiling we set.
const BITRATE_TIERS = [2_500_000, 1_200_000, 600_000, 300_000];
const STATS_INTERVAL_MS = 2_000;
const ICE_DISCONNECT_GRACE_MS = 3_000;
const MAX_ICE_RESTARTS = 5;

/**
 * One raw RTCPeerConnection per remote peer with W3C perfect negotiation, plus
 * the Phase 5 reliability layer: ICE restart on disconnect/fail (grace timer +
 * exponential backoff), per-connection adaptive video bitrate driven by
 * getStats(), and a coarse link-quality signal for the UI. Polite/impolite is
 * decided by the caller (lexicographic identityId compare).
 */
export class PeerConnectionWrapper {
  readonly pc: RTCPeerConnection;
  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private readonly remoteStream = new MediaStream();

  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private iceRestartAttempts = 0;
  private bitrateTier = 0;
  private goodStreak = 0;
  private badStreak = 0;
  private lastPacketsLost = 0;
  private lastPacketsSent = 0;
  private closed = false;

  constructor(
    private readonly isPolite: boolean,
    private readonly callbacks: PeerConnectionCallbacks,
  ) {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        if (this.pc.localDescription) {
          this.callbacks.onDescription(this.pc.localDescription.toJSON());
        }
      } catch (err) {
        console.error("negotiation failed", err);
      } finally {
        this.makingOffer = false;
      }
    };

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.callbacks.onCandidate(candidate.toJSON());
    };

    this.pc.ontrack = ({ track }) => {
      this.remoteStream.addTrack(track);
      this.callbacks.onRemoteStream(this.remoteStream);
      track.onended = () => this.remoteStream.removeTrack(track);
    };

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
      if (this.pc.connectionState === "connected") this.iceRestartAttempts = 0;
    };

    this.pc.oniceconnectionstatechange = () => this.handleIceStateChange();

    this.statsTimer = setInterval(() => void this.sampleStats(), STATS_INTERVAL_MS);
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream) {
    this.pc.addTrack(track, stream);
  }

  async replaceVideoTrack(track: MediaStreamTrack | null) {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(track);
  }

  async handleDescription(description: RTCSessionDescriptionInit) {
    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === "stable" || this.isSettingRemoteAnswerPending);
    const offerCollision = description.type === "offer" && !readyForOffer;

    this.ignoreOffer = !this.isPolite && offerCollision;
    if (this.ignoreOffer) return;

    this.isSettingRemoteAnswerPending = description.type === "answer";
    await this.pc.setRemoteDescription(description);
    this.isSettingRemoteAnswerPending = false;

    if (description.type === "offer") {
      await this.pc.setLocalDescription();
      if (this.pc.localDescription) {
        this.callbacks.onDescription(this.pc.localDescription.toJSON());
      }
    }
  }

  async handleCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) throw err;
    }
  }

  // --- ICE restart ---

  private handleIceStateChange() {
    const state = this.pc.iceConnectionState;
    if (state === "connected" || state === "completed") {
      if (this.disconnectTimer) {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
      }
      return;
    }
    if (state === "disconnected") {
      // Transient blips often self-heal; wait out a grace period first.
      if (!this.disconnectTimer) {
        this.disconnectTimer = setTimeout(() => {
          this.disconnectTimer = null;
          if (this.pc.iceConnectionState !== "connected") this.scheduleIceRestart();
        }, ICE_DISCONNECT_GRACE_MS);
      }
    } else if (state === "failed") {
      this.scheduleIceRestart();
    }
  }

  private scheduleIceRestart() {
    if (this.closed || this.iceRestartAttempts >= MAX_ICE_RESTARTS) return;
    // Only the impolite peer initiates the restart offer, so both sides don't
    // fire competing restarts; perfect negotiation would resolve glare anyway,
    // but this keeps the churn down.
    if (this.isPolite) return;

    const attempt = this.iceRestartAttempts++;
    const backoff = Math.min(1_000 * 2 ** attempt, 30_000);
    setTimeout(() => {
      if (this.closed || this.pc.iceConnectionState === "connected") return;
      try {
        this.pc.restartIce();
      } catch (err) {
        console.warn("ICE restart failed", err);
      }
    }, backoff);
  }

  // --- Adaptive bitrate + quality ---

  private async sampleStats() {
    if (this.closed) return;
    const stats = await this.pc.getStats().catch(() => null);
    if (!stats) return;

    let rtt = 0;
    let fractionLost = 0;
    let sawRemoteInbound = false;

    stats.forEach((report) => {
      if (report.type === "remote-inbound-rtp") {
        sawRemoteInbound = true;
        if (typeof report.roundTripTime === "number") rtt = report.roundTripTime;
        if (typeof report.fractionLost === "number") fractionLost = report.fractionLost;
      } else if (report.type === "outbound-rtp" && report.kind === "video") {
        // Fallback loss estimate from cumulative counters if no remote report.
        const lost = (report.packetsLost as number) ?? this.lastPacketsLost;
        const sent = (report.packetsSent as number) ?? this.lastPacketsSent;
        const dLost = lost - this.lastPacketsLost;
        const dSent = sent - this.lastPacketsSent;
        if (!sawRemoteInbound && dSent > 0) fractionLost = Math.max(0, dLost / dSent);
        this.lastPacketsLost = lost;
        this.lastPacketsSent = sent;
      }
    });

    this.reportQuality(rtt, fractionLost);
    this.adaptBitrate(rtt, fractionLost);
  }

  private reportQuality(rtt: number, fractionLost: number) {
    let quality: ConnectionQuality = "good";
    if (fractionLost > 0.1 || rtt > 0.5) quality = "poor";
    else if (fractionLost > 0.03 || rtt > 0.3) quality = "fair";
    this.callbacks.onQuality?.(quality);
  }

  private adaptBitrate(rtt: number, fractionLost: number) {
    const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender || !sender.track) return;

    const bad = fractionLost > 0.05 || rtt > 0.4;
    const good = fractionLost < 0.02 && rtt < 0.2;
    if (bad) {
      this.badStreak++;
      this.goodStreak = 0;
    } else if (good) {
      this.goodStreak++;
      this.badStreak = 0;
    } else {
      this.goodStreak = 0;
      this.badStreak = 0;
    }

    let nextTier = this.bitrateTier;
    if (this.badStreak >= 2 && this.bitrateTier < BITRATE_TIERS.length - 1) {
      nextTier = this.bitrateTier + 1;
      this.badStreak = 0;
    } else if (this.goodStreak >= 10 && this.bitrateTier > 0) {
      nextTier = this.bitrateTier - 1;
      this.goodStreak = 0;
    }
    if (nextTier === this.bitrateTier) return;

    this.bitrateTier = nextTier;
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].maxBitrate = BITRATE_TIERS[nextTier];
    sender.setParameters(params).catch(() => {});
  }

  close() {
    this.closed = true;
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    this.pc.getSenders().forEach((s) => s.track?.stop());
    this.pc.onnegotiationneeded = null;
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.close();
  }
}
