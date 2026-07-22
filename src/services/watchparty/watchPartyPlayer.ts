// watchPartyPlayer.ts
// Pure HTML <video> player — no libmpv, no native path, works identically
// on macOS, Windows, and Linux without any extra installation.

export type TrackInfo = {
  id: number;
  type: "video" | "audio" | "sub";
  title: string | null;
  lang: string | null;
  codec: string | null;
  selected: boolean;
  isDefault: boolean;
};

export type WpEvent =
  | { kind: "time"; pos: number; tsMs: number }
  | { kind: "duration"; duration: number }
  | { kind: "pause"; paused: boolean }
  | { kind: "buffering"; pausedForCache: boolean; cachedSec: number; ready: boolean }
  | { kind: "tracks"; tracks: TrackInfo[] }
  | { kind: "eof" }
  | { kind: "error"; message: string };

// "html" once a <video> element is attached, "none" before that.
export type PlayerMode = "html" | "none";
export type StageRect = { x: number; y: number; w: number; h: number; dpr: number };
export type AudioTrackId = number | "no" | "auto";
export type SubTrackId = number | "no";

type Listener = (e: WpEvent) => void;

let mode: PlayerMode = "none";
const listeners = new Set<Listener>();
let htmlVideo: HTMLVideoElement | null = null;
let htmlDetach: (() => void) | null = null;

function emit(e: WpEvent) {
  for (const l of listeners) l(e);
}

export function onPlayerEvent(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function playerMode(): PlayerMode {
  return mode;
}

export function attachHtml(video: HTMLVideoElement): void {
  detachHtml();
  htmlVideo = video;
  mode = "html";
  const v = video;

  const onTime = () => emit({ kind: "time", pos: v.currentTime, tsMs: performance.now() });
  const onDur = () =>
    emit({ kind: "duration", duration: Number.isFinite(v.duration) ? v.duration : 0 });
  const onPlay = () => emit({ kind: "pause", paused: false });
  const onPause = () => emit({ kind: "pause", paused: true });
  const onWaiting = () =>
    emit({ kind: "buffering", pausedForCache: true, cachedSec: 0, ready: false });
  const onPlaying = () =>
    emit({ kind: "buffering", pausedForCache: false, cachedSec: 0, ready: true });
  const onCanPlay = () =>
    emit({ kind: "buffering", pausedForCache: false, cachedSec: 0, ready: true });
  const onEnded = () => emit({ kind: "eof" });
  const onError = () => emit({ kind: "error", message: v.error?.message ?? "playback error" });

  v.addEventListener("timeupdate", onTime);
  v.addEventListener("durationchange", onDur);
  v.addEventListener("play", onPlay);
  v.addEventListener("pause", onPause);
  v.addEventListener("waiting", onWaiting);
  v.addEventListener("playing", onPlaying);
  v.addEventListener("canplay", onCanPlay);
  v.addEventListener("ended", onEnded);
  v.addEventListener("error", onError);

  htmlDetach = () => {
    v.removeEventListener("timeupdate", onTime);
    v.removeEventListener("durationchange", onDur);
    v.removeEventListener("play", onPlay);
    v.removeEventListener("pause", onPause);
    v.removeEventListener("waiting", onWaiting);
    v.removeEventListener("playing", onPlaying);
    v.removeEventListener("canplay", onCanPlay);
    v.removeEventListener("ended", onEnded);
    v.removeEventListener("error", onError);
  };
}

function detachHtml() {
  htmlDetach?.();
  htmlDetach = null;
  htmlVideo = null;
}

export async function load(url: string): Promise<void> {
  if (htmlVideo) {
    htmlVideo.src = url;
    htmlVideo.load();
  }
}

export async function setPause(paused: boolean): Promise<void> {
  if (!htmlVideo) return;
  if (paused) {
    htmlVideo.pause();
  } else {
    await htmlVideo.play().catch(() => {});
  }
}

export async function seek(sec: number): Promise<void> {
  if (htmlVideo) htmlVideo.currentTime = Math.max(0, sec);
}

export async function setSpeed(rate: number): Promise<void> {
  if (htmlVideo) htmlVideo.playbackRate = rate;
}

// Audio/subtitle track switching via HTML is limited to what the browser
// exposes. These are no-ops unless extended via hls.js / dash.js in future.
export async function setAudioTrack(_id: AudioTrackId): Promise<void> {}
export async function setSubTrack(_id: SubTrackId): Promise<void> {}
export async function setSubDelay(_sec: number): Promise<void> {}

// Subtitle file upload: inject as a <track> element with a blob URL.
export async function addSubtitle(name: string, bytes: Uint8Array): Promise<void> {
  if (!htmlVideo) return;
  const blob = new Blob([bytes], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.label = name;
  track.src = url;
  track.default = true;
  htmlVideo.appendChild(track);
  // Show the newly added track.
  if (htmlVideo.textTracks.length > 0) {
    htmlVideo.textTracks[htmlVideo.textTracks.length - 1].mode = "showing";
  }
}

// HTML <video> doesn't expose structured track metadata the same way mpv did.
// Return an empty list; the TrackMenus component gracefully hides when empty.
export async function getTracks(): Promise<TrackInfo[]> {
  return [];
}

export async function now(): Promise<{ pos: number; tsMs: number }> {
  return {
    pos: htmlVideo?.currentTime ?? 0,
    tsMs: performance.now(),
  };
}

// setStageRect is a no-op: the <video> element is positioned by CSS, no native
// view overlay needed.
export function setStageRect(_rect: StageRect): void {}

export function teardown(): Promise<void> {
  if (htmlVideo) {
    htmlVideo.pause();
    htmlVideo.removeAttribute("src");
    htmlVideo.load();
  }
  detachHtml();
  mode = "none";
  return Promise.resolve();
}
