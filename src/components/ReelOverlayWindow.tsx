"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { getVideoMimeType, toCmsMediaUrl, toRenderableMediaUrl } from "@/lib/mediaUrl";
import { getPageBlocks, getPageTitle } from "@/lib/pageData";

function closeToPreviousOrHome(router: ReturnType<typeof useRouter>) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

type ReelPage = {
  page?: string | number | null;
  title?: string | null;
  blocks?: unknown;
  [key: string]: unknown;
};

type ReelMediaItem = {
  role?: string;
  url?: string;
};

type ReelBlock = {
  type?: string;
  title?: string;
  copy?: string;
  media?: ReelMediaItem[];
};

function normalizePages(data: unknown): ReelPage[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const rawPages = (data as { pages?: unknown }).pages;
  if (!Array.isArray(rawPages)) {
    return [];
  }
  return rawPages.filter((entry) => entry && typeof entry === "object") as ReelPage[];
}

function extractReelFromBlocks(page: ReelPage | null) {
  const rawBlocks = getPageBlocks(page);
  if (rawBlocks.length === 0) {
    return null;
  }

  const blocks = rawBlocks
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      type: typeof item.type === "string" ? item.type : "",
      title: typeof item.title === "string" ? item.title : "",
      copy: typeof item.copy === "string" ? item.copy : "",
      media: Array.isArray(item.media)
        ? item.media
            .filter((media): media is Record<string, unknown> => !!media && typeof media === "object")
            .map((media) => ({
              role: typeof media.role === "string" ? media.role.toLowerCase() : "",
              url: typeof media.url === "string" ? media.url : "",
            }))
        : [],
    })) as ReelBlock[];

  if (blocks.length === 0) {
    return null;
  }

  const videoBlock =
    blocks.find((block) => {
      return block.type === "video" || block.type === "video_embed";
    }) ?? null;

  if (!videoBlock) {
    return null;
  }

  const media = Array.isArray(videoBlock.media) ? videoBlock.media : [];
  const primaryMedia = media.find((item) => item.role === "video" || item.role === "embed") ?? media[0];
  const poster = media.find((item) => item.role === "poster" || item.role === "image") ?? null;
  const textBlock =
    blocks.find((block) => {
      return block.type === "text" && typeof block.copy === "string" && block.copy.trim().length > 0;
    }) ?? null;

  const video = toCmsMediaUrl(primaryMedia?.url);
  const thumb = toCmsMediaUrl(poster?.url);
  const copy = typeof textBlock?.copy === "string" ? textBlock.copy : "";
  const title = (typeof videoBlock.title === "string" && videoBlock.title.trim().length > 0 ? videoBlock.title : "") || "";

  return video ? { video, thumb, copy, title } : null;
}

function getReelPage(pages: ReelPage[]): ReelPage | null {
  return pages.find((page) => String(page.page ?? "") === "1") ?? pages[0] ?? null;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? "";
    } else if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") ?? "";
      } else if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] ?? "";
      }
    }

    if (!videoId) {
      return null;
    }

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&modestbranding=1`;
  } catch {
    return null;
  }
}

export function ReelOverlayWindow({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [pageData, setPageData] = useState<ReelPage | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const defaultClose = useCallback(() => {
    closeToPreviousOrHome(router);
  }, [router]);

  const handleClose = onClose ?? defaultClose;
  const blockData = extractReelFromBlocks(pageData);
  const reelTitle = getPageTitle(pageData) || blockData?.title || "MOTION REEL";
  const reelVideoSource = blockData?.video || "";
  const reelVideoRenderSource = toRenderableMediaUrl(reelVideoSource);
  const reelVideoMime = getVideoMimeType(reelVideoRenderSource);
  const reelYouTubeEmbed = toYouTubeEmbedUrl(reelVideoSource);
  const reelThumb = blockData?.thumb || "";
  const reelThumbRenderSource = toRenderableMediaUrl(reelThumb);
  const reelCopy = blockData?.copy || "";

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const response = await fetch("/api/pages");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as unknown;
        const pages = normalizePages(data);
        const reelPage = getReelPage(pages);
        if (isMounted) {
          setPageData(reelPage);
        }
      } catch {
        // ignore and fall back to defaults
      }
    };
    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  const closeReel = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    handleClose();
  }, [handleClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const syncFromVideo = () => {
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setIsPlaying(!video.paused);
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    syncFromVideo();
    video.addEventListener("loadedmetadata", syncFromVideo);
    video.addEventListener("timeupdate", syncFromVideo);
    video.addEventListener("play", syncFromVideo);
    video.addEventListener("pause", syncFromVideo);
    video.addEventListener("volumechange", syncFromVideo);

    return () => {
      video.removeEventListener("loadedmetadata", syncFromVideo);
      video.removeEventListener("timeupdate", syncFromVideo);
      video.removeEventListener("play", syncFromVideo);
      video.removeEventListener("pause", syncFromVideo);
      video.removeEventListener("volumechange", syncFromVideo);
    };
  }, [hasStarted]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeReel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeReel]);

  const startPlayback = useCallback(() => {
    setHasStarted(true);
    if (reelYouTubeEmbed) {
      return;
    }

    window.requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      void video.play();
    });
  }, [reelYouTubeEmbed]);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
  }, []);

  const onSeek = useCallback((value: string) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const next = Number(value);
    if (Number.isFinite(next)) {
      video.currentTime = next;
    }
  }, []);

  const onVolumeChange = useCallback((value: string) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const next = Number(value);
    if (!Number.isFinite(next)) {
      return;
    }
    video.volume = next;
    if (video.muted && next > 0) {
      video.muted = false;
    }
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeReel();
    }
  };

  return (
    <div
      className="window-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Motion reel overlay"
      onClick={handleBackdropClick}
    >
      <div className="window-panel reel-window">
        <div className="reel-embed">
          {hasStarted ? (
            reelYouTubeEmbed ? (
              <iframe
                src={reelYouTubeEmbed}
                className="reel-video"
                title={`${reelTitle} video`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="reel-video"
                  preload="metadata"
                  playsInline
                  onClick={togglePlayback}
                >
                  <source src={reelVideoRenderSource} type={reelVideoMime} />
                </video>
                <div className="reel-controls" role="group" aria-label="Video controls">
                  <button type="button" className="reel-control-btn type-button" onClick={togglePlayback}>
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                  <input
                    className="reel-scrubber"
                    type="range"
                    min={0}
                    max={Math.max(duration, 0)}
                    step={0.1}
                    value={Math.min(currentTime, duration || 0)}
                    onChange={(event) => onSeek(event.currentTarget.value)}
                    aria-label="Seek"
                  />
                  <span className="reel-time type-meta">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
                  <button type="button" className="reel-control-btn type-button" onClick={toggleMute}>
                    {isMuted || volume === 0 ? "Unmute" : "Mute"}
                  </button>
                  <input
                    className="reel-volume"
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={isMuted ? 0 : volume}
                    onChange={(event) => onVolumeChange(event.currentTarget.value)}
                    aria-label="Volume"
                  />
                </div>
              </>
            )
          ) : (
            <button
              type="button"
              className="reel-cover-button"
              onClick={startPlayback}
              aria-label="Play motion reel"
              disabled={!reelYouTubeEmbed && !reelVideoRenderSource}
            >
              {reelThumbRenderSource ? <img src={reelThumbRenderSource} alt="Motion reel thumbnail" /> : null}
              <span className="reel-cover-play" aria-hidden="true" />
            </button>
          )}
        </div>
        <h2>{reelTitle}</h2>
        {reelCopy ? (
          <p className="reel-meta-list type-body" style={{ whiteSpace: "pre-line" }}>
            {reelCopy}
          </p>
        ) : null}
        <div className="reel-close-wrap">
          <button
            type="button"
            className="window-close type-button"
            onClick={closeReel}
            aria-label="Close reel overlay"
          />
        </div>
      </div>
    </div>
  );
}
