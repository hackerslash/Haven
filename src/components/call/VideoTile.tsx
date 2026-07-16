import { useEffect, useRef } from "react";

type VideoTileProps = {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  label: string;
  hasVideo: boolean;
};

function requestFullscreen(el: HTMLElement) {
  if (el.requestFullscreen) el.requestFullscreen();
  else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
}

export function VideoTile({ stream, muted, mirror, label, hasVideo }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && el.srcObject !== stream) el.srcObject = stream;
  }, [stream]);

  const handleFullscreen = () => {
    if (wrapRef.current) requestFullscreen(wrapRef.current);
  };

  return (
    <div
      ref={wrapRef}
      onDoubleClick={handleFullscreen}
      className="group relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-black"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={`h-full w-full object-cover ${hasVideo ? "" : "hidden"} ${
          mirror ? "-scale-x-100" : ""
        }`}
      />
      {!hasVideo && (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-tertiary text-xl font-semibold text-text-primary">
          {label.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {label}
      </span>
      {/* Fullscreen button — visible on hover */}
      <button
        onClick={handleFullscreen}
        aria-label="Fullscreen"
        title="Fullscreen (or double-click)"
        className="absolute right-2 top-2 hidden rounded bg-black/50 p-1 text-white opacity-80 hover:opacity-100 group-hover:flex"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  );
}
