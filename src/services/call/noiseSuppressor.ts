import { RnnoiseWorkletNode, loadRnnoise } from "@sapphi-red/web-noise-suppressor";
import rnnoiseWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseSimdWasmUrl from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import rnnoiseWorkletUrl from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";

/**
 * ML noise suppression (RNNoise) for the outgoing microphone.
 *
 * The platform's built-in `noiseSuppression` constraint is mild — it leaves
 * steady background noise (a fan, an AC) audible — and the stronger
 * `voiceIsolation` constraint only exists on WKWebView/Safari, so on Windows
 * WebView2 nothing removes it. RNNoise runs in an AudioWorklet and works
 * identically on every platform.
 *
 * Graph: MediaStreamSource(raw mic) → RnnoiseWorkletNode → MediaStreamDestination.
 * The destination's track is what we transmit; the raw mic track stays the
 * capture source (and the thing mute toggles, which silences the input).
 *
 * Everything is best-effort: if the wasm/worklet can't load, the caller falls
 * back to the raw mic track, so a call never breaks just because RNNoise is
 * unavailable — it just isn't noise-suppressed.
 */

export type MicProcessor = {
  /** The processed audio track to transmit in place of the raw mic track. */
  track: MediaStreamTrack;
  /** Enable/disable RNNoise live WITHOUT changing the output track identity, so
   * toggling the setting mid-call needs no renegotiation. */
  setEnabled(on: boolean): void;
  /** Tear down this processor's graph (the shared AudioContext stays open).
   * Does NOT stop the raw source track — the caller owns that. */
  dispose(): Promise<void>;
};

// One AudioContext shared by every capture-side graph (RNNoise, speaking
// analysis). Opening/closing contexts mid-call re-initializes the platform
// audio unit, which on macOS audibly changes how remote playback sounds —
// so this context is created once and never closed for the app's lifetime.
let sharedCtx: AudioContext | null = null;
let rnnoiseWorkletLoaded: Promise<void> | null = null;

export function getSharedAudioContext(): AudioContext {
  // RNNoise assumes 48 kHz — pin the context so the worklet gets it directly.
  if (!sharedCtx) sharedCtx = new AudioContext({ sampleRate: 48_000 });
  return sharedCtx;
}

// The wasm binary is fetched once and reused across calls.
let wasmBinaryPromise: Promise<ArrayBuffer> | null = null;
function getWasmBinary(): Promise<ArrayBuffer> {
  if (!wasmBinaryPromise) {
    // Don't cache a rejection: one transient fetch failure would otherwise
    // disable RNNoise for the rest of the session. Clear it so the next call
    // retries.
    wasmBinaryPromise = loadRnnoise({ url: rnnoiseWasmUrl, simdUrl: rnnoiseSimdWasmUrl }).catch(
      (err) => {
        wasmBinaryPromise = null;
        throw err;
      },
    );
  }
  return wasmBinaryPromise;
}

export async function createMicProcessor(
  rawTrack: MediaStreamTrack,
  enabled: boolean,
): Promise<MicProcessor | null> {
  try {
    const wasmBinary = await getWasmBinary();
    const ctx = getSharedAudioContext();
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    if (!rnnoiseWorkletLoaded) {
      // Don't cache a rejection — retry on the next call.
      rnnoiseWorkletLoaded = ctx.audioWorklet.addModule(rnnoiseWorkletUrl).catch((err) => {
        rnnoiseWorkletLoaded = null;
        throw err;
      });
    }
    await rnnoiseWorkletLoaded;

    const source = ctx.createMediaStreamSource(new MediaStream([rawTrack]));
    const node = new RnnoiseWorkletNode(ctx, { maxChannels: 1, wasmBinary });
    const dest = ctx.createMediaStreamDestination();

    let currentlyEnabled = false;
    const routeThroughRnnoise = () => {
      source.disconnect();
      node.disconnect();
      source.connect(node);
      node.connect(dest);
      currentlyEnabled = true;
    };
    const routeBypass = () => {
      source.disconnect();
      node.disconnect();
      source.connect(dest);
      currentlyEnabled = false;
    };
    if (enabled) routeThroughRnnoise();
    else routeBypass();

    const track = dest.stream.getAudioTracks()[0];
    if (!track) {
      source.disconnect();
      node.disconnect();
      return null;
    }
    // Opus optimizes for voice when the track is hinted as speech.
    try {
      track.contentHint = "speech";
    } catch {
      // contentHint is advisory
    }

    return {
      track,
      setEnabled(on: boolean) {
        if (on === currentlyEnabled) return;
        if (on) routeThroughRnnoise();
        else routeBypass();
      },
      // Tears down this processor's nodes only — the shared AudioContext
      // stays open (closing it mid-call re-inits the platform audio unit).
      async dispose() {
        try {
          node.destroy();
        } catch {
          // best effort
        }
        try {
          source.disconnect();
          node.disconnect();
          dest.disconnect();
        } catch {
          // best effort
        }
      },
    };
  } catch (err) {
    console.warn("[noiseSuppressor] RNNoise unavailable, using raw mic:", err);
    return null;
  }
}
