export type SpeakingCallback = (speaking: Set<string>) => void;

export class SpeakingMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localCtx: AudioContext | null = null;
  private localSource: MediaStreamAudioSourceNode | null = null;
  private localId: string;
  private getRemoteReceivers: () => Map<string, RTCRtpReceiver[]>;
  private callback: SpeakingCallback;
  private speakingUntil: Map<string, number> = new Map();
  private static THRESHOLD = 0.01;
  private static HOLD_MS = 400;
  private static INTERVAL_MS = 200;

  constructor(
    localId: string,
    localStream: MediaStream | null,
    getRemoteReceivers: () => Map<string, RTCRtpReceiver[]>,
    callback: SpeakingCallback,
  ) {
    this.localId = localId;
    this.getRemoteReceivers = getRemoteReceivers;
    this.callback = callback;

    if (localStream && localStream.getAudioTracks().length > 0) {
      try {
        this.localCtx = new AudioContext();
        this.localSource = this.localCtx.createMediaStreamSource(localStream);
        this.localAnalyser = this.localCtx.createAnalyser();
        this.localAnalyser.fftSize = 256;
        this.localSource.connect(this.localAnalyser);
      } catch {
        // AudioContext may fail in some environments; local detection disabled.
        this.localCtx = null;
        this.localSource = null;
        this.localAnalyser = null;
      }
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), SpeakingMonitor.INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.localSource) {
      this.localSource.disconnect();
      this.localSource = null;
    }
    if (this.localCtx) {
      void this.localCtx.close();
      this.localCtx = null;
    }
    this.localAnalyser = null;
    this.speakingUntil.clear();
  }

  private tick(): void {
    const now = Date.now();

    // --- Local audio ---
    if (this.localAnalyser) {
      const buf = new Float32Array(this.localAnalyser.fftSize);
      this.localAnalyser.getFloatTimeDomainData(buf);
      let sumSq = 0;
      for (let i = 0; i < buf.length; i++) {
        sumSq += buf[i] * buf[i];
      }
      const rms = Math.sqrt(sumSq / buf.length);
      if (rms > SpeakingMonitor.THRESHOLD) {
        this.speakingUntil.set(this.localId, now + SpeakingMonitor.HOLD_MS);
      }
    }

    // --- Remote audio ---
    const remotes = this.getRemoteReceivers();
    for (const [participantId, receivers] of remotes) {
      for (const receiver of receivers) {
        try {
          const sources = receiver.getSynchronizationSources();
          if (sources) {
            for (const source of sources) {
              if (
                source.audioLevel !== undefined &&
                source.audioLevel > SpeakingMonitor.THRESHOLD
              ) {
                this.speakingUntil.set(participantId, now + SpeakingMonitor.HOLD_MS);
              }
            }
          }
        } catch {
          // getSynchronizationSources may not be available in all browsers.
        }
      }
    }

    // --- Build active-speaking set ---
    const speaking = new Set<string>();
    for (const [id, until] of this.speakingUntil) {
      if (now < until) {
        speaking.add(id);
      } else {
        this.speakingUntil.delete(id);
      }
    }

    this.callback(speaking);
  }
}
