"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getVideoMimeType, isLikelyVideoUrl, toCmsMediaUrl, toRenderableMediaUrl } from "@/lib/mediaUrl";
import { getPageBlocks, getPageTitle, toPageText } from "@/lib/pageData";
import signal from "@/components/ColossalSignalModal.module.css";
import editorial from "@/components/EditorialModal.module.css";

type PageRow = Record<string, unknown>;

type MediaItem = {
  url?: unknown;
  role?: unknown;
  thumbnail_at?: unknown;
  thumbnailAt?: unknown;
  thumb?: unknown;
  poster?: unknown;
};

type BlockItem = {
  index?: unknown;
  type?: unknown;
  title?: unknown;
  layout?: unknown;
  copy?: unknown;
  text?: unknown;
  body?: unknown;
  description?: unknown;
  media?: unknown;
  video?: unknown;
  url?: unknown;
  image?: unknown;
};

type ProjectBlock = {
  slot: number;
  title: string;
  layout: string;
  copy: string;
  media: Array<{ url: string; role: string; thumbnailAt?: number }>;
};

type RenderableMedia = {
  key: string;
  url: string;
  posterUrl: string;
  playable: boolean;
  thumbnailAt?: number;
};

type ColossalMediaMap = {
  hero: string;
  yellowstoneBg: string;
  thumb: string;
  step1: string;
  step23: string;
  step4: string;
  step57: string;
  step8: string;
  aru: string;
  spectrogramMap: string;
  master: string;
};

function normalizeRole(value: unknown): string {
  return toPageText(value).trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeLayout(value: unknown): string {
  return toPageText(value).trim().toLowerCase().replace(/\s+/g, "-");
}

function closeToPreviousOrHome(router: ReturnType<typeof useRouter>) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

function normalizePages(data: unknown): PageRow[] {
  if (!data || typeof data !== "object") {
    return [];
  }
  const rawPages = (data as { pages?: unknown }).pages;
  if (!Array.isArray(rawPages)) {
    return [];
  }
  return rawPages.filter((entry) => entry && typeof entry === "object") as PageRow[];
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

function toBlockSlot(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  const parsed = Number(toPageText(value).trim());
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return fallback;
}

function normalizeBlockMedia(block: BlockItem): Array<{ url: string; role: string; thumbnailAt?: number }> {
  const mediaRaw = Array.isArray(block.media) ? block.media : [];
  const media = mediaRaw.filter((item): item is MediaItem => !!item && typeof item === "object");

  const fromMedia = media
    .map((item) => ({
      url: toCmsMediaUrl(item.url),
      role: toPageText(item.role).trim().toLowerCase(),
      thumbnailAt:
        typeof item.thumbnail_at === "number" && Number.isFinite(item.thumbnail_at) && item.thumbnail_at >= 0
          ? item.thumbnail_at
          : typeof item.thumbnailAt === "number" && Number.isFinite(item.thumbnailAt) && item.thumbnailAt >= 0
            ? item.thumbnailAt
            : undefined,
    }))
    .filter((item) => !!item.url)
    .map((item) => ({
      url: item.url,
      role: item.role || (isLikelyVideoUrl(item.url) ? "video" : "image"),
      thumbnailAt: item.thumbnailAt,
    }));

  if (fromMedia.length > 0) {
    return fromMedia;
  }

  const single = toCmsMediaUrl(block.video ?? block.url ?? block.image);
  if (!single) {
    return [];
  }

  return [{ url: single, role: isLikelyVideoUrl(single) ? "video" : "image", thumbnailAt: undefined }];
}

function isPlayableMedia(url: string, role: string): boolean {
  return role === "video" || role === "embed" || !!toYouTubeEmbedUrl(url) || isLikelyVideoUrl(url);
}

function TimecodeVideoThumb({ src, seconds, title }: { src: string; seconds: number; title: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const renderSrc = toRenderableMediaUrl(src);
  const mime = getVideoMimeType(renderSrc);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const onLoaded = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : 0;
      const target = duration > 0 ? Math.min(seconds, Math.max(0, duration - 0.1)) : seconds;
      el.currentTime = Math.max(0, target);
    };

    el.addEventListener("loadedmetadata", onLoaded);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [seconds, renderSrc]);

  return (
    <video ref={ref} className="project-media-video" preload="metadata" muted playsInline aria-label={title}>
      <source src={renderSrc} type={mime} />
    </video>
  );
}

function AutoPlayVideo({ src, posterUrl }: { src: string; posterUrl: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const renderSrc = toRenderableMediaUrl(src);
  const renderPoster = toRenderableMediaUrl(posterUrl);
  const mime = getVideoMimeType(renderSrc);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    const tryPlay = async () => {
      try {
        await el.play();
      } catch {
        // If autoplay is blocked, controls remain available for manual start.
      }
    };

    void tryPlay();
  }, [renderSrc]);

  return (
    <video ref={ref} className="project-media-video" preload="metadata" playsInline controls autoPlay poster={renderPoster}>
      <source src={renderSrc} type={mime} />
    </video>
  );
}

function buildRenderableMedia(block: ProjectBlock): RenderableMedia[] {
  const posterIndices = block.media
    .map((item, index) => ({ role: item.role, index }))
    .filter((item) => item.role === "poster" || item.role === "thumb")
    .map((item) => item.index);
  const usedPosterIndices = new Set<number>();
  const renderables: RenderableMedia[] = [];

  block.media.forEach((item, index) => {
    const playable = isPlayableMedia(item.url, item.role);
    const isPosterOnly = item.role === "poster" || item.role === "thumb";
    if (isPosterOnly) {
      return;
    }

    let posterUrl = "";
    if (playable && posterIndices.length > 0) {
      const nextPoster = posterIndices.find((posterIndex) => posterIndex > index && !usedPosterIndices.has(posterIndex));
      const prevPoster =
        [...posterIndices].reverse().find((posterIndex) => posterIndex < index && !usedPosterIndices.has(posterIndex)) ?? null;
      const chosenPosterIndex = nextPoster ?? prevPoster ?? posterIndices.find((posterIndex) => !usedPosterIndices.has(posterIndex));
      if (typeof chosenPosterIndex === "number") {
        usedPosterIndices.add(chosenPosterIndex);
        posterUrl = block.media[chosenPosterIndex]?.url ?? "";
      }
    }

    renderables.push({
      key: `${block.slot}-${index}-${item.url}`,
      url: item.url,
      posterUrl,
      playable,
      thumbnailAt: item.thumbnailAt,
    });
  });

  return renderables;
}

function renderStartedMedia(url: string, title: string, posterUrl = "") {
  const embed = toYouTubeEmbedUrl(url);
  if (embed) {
    return (
      <iframe
        src={embed}
        className="project-media-iframe"
        title={`${title} media`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }

  if (isLikelyVideoUrl(url)) {
    return <AutoPlayVideo src={url} posterUrl={posterUrl} />;
  }

  return <img src={toRenderableMediaUrl(url)} className="project-media-image" alt={`${title} media`} />;
}

function renderMediaPreview(url: string, posterUrl: string, title: string, thumbnailAt?: number) {
  if (posterUrl) {
    return <img src={toRenderableMediaUrl(posterUrl)} className="project-media-image" alt={`${title} thumbnail`} />;
  }

  if (isLikelyVideoUrl(url)) {
    if (typeof thumbnailAt === "number" && Number.isFinite(thumbnailAt) && thumbnailAt >= 0) {
      return <TimecodeVideoThumb src={url} seconds={thumbnailAt} title={`${title} thumbnail`} />;
    }
    const renderSrc = toRenderableMediaUrl(url);
    const mime = getVideoMimeType(renderSrc);
    return (
      <video className="project-media-video" preload="metadata" muted playsInline>
        <source src={renderSrc} type={mime} />
      </video>
    );
  }

  return <img src={toRenderableMediaUrl(url)} className="project-media-image" alt={`${title} media`} />;
}

function buildProjectBlocks(page: PageRow | null): ProjectBlock[] {
  if (!page) {
    return [];
  }

  const structuredBlocks = getPageBlocks(page);
  if (structuredBlocks.length > 0) {
    const blocks = structuredBlocks
      .filter((raw): raw is BlockItem => !!raw && typeof raw === "object")
      .map((block, i) => {
        const slot = toBlockSlot(block.index, i + 1);
        const title = toPageText(block.title).trim();
        const layout = normalizeLayout(block.layout);
        const copy = toPageText(block.copy ?? block.text ?? block.body ?? block.description).trim();
        const media = normalizeBlockMedia(block);
        return { slot, title, layout, copy, media } satisfies ProjectBlock;
      })
      .filter((block) => block.media.length > 0 || block.title.length > 0 || block.copy.length > 0)
      .sort((a, b) => a.slot - b.slot);

    if (blocks.length > 0) {
      return blocks;
    }
  }

  return [];
}

function getPageSlug(page: PageRow | null): string {
  return toPageText(page?.slug).trim().toLowerCase();
}

function uniqueMediaUrls(blocks: ProjectBlock[]): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const block of blocks) {
    for (const item of block.media) {
      const value = toCmsMediaUrl(item.url);
      if (!value || seen.has(value)) {
        continue;
      }
      seen.add(value);
      urls.push(value);
    }
  }

  return urls;
}

function buildRoleMediaMap(blocks: ProjectBlock[]): Map<string, string> {
  const roleMap = new Map<string, string>();
  for (const block of blocks) {
    for (const item of block.media) {
      const role = normalizeRole(item.role);
      if (!role || role === "video" || role === "image" || role === "embed") {
        continue;
      }
      const mediaUrl = toCmsMediaUrl(item.url);
      if (!mediaUrl || roleMap.has(role)) {
        continue;
      }
      roleMap.set(role, mediaUrl);
    }
  }
  return roleMap;
}

function pickMediaByHints(urls: string[], hints: string[], fallback: string): string {
  const lowerHints = hints.map((hint) => hint.toLowerCase());
  const found = urls.find((url) => {
    const normalized = url.toLowerCase();
    return lowerHints.some((hint) => normalized.includes(hint));
  });
  return found ?? fallback;
}

function buildColossalMedia(page: PageRow | null, blocks: ProjectBlock[]): ColossalMediaMap {
  const urls = uniqueMediaUrls(blocks);
  const roleMap = buildRoleMediaMap(blocks);
  const explicitHeader = toCmsMediaUrl("projects/colossal/colossal_pageheader2.mp4");
  const heroFallback = toCmsMediaUrl(page?.card_background ?? page?.["card-background"]) || urls[0] || "";
  const hero =
    roleMap.get("hero_bg") ??
    pickMediaByHints(urls, ["colossal_pageheader2", "colossal_pageheader", "pageheader2", "pageheader", "header"], explicitHeader || heroFallback);
  const fallback = hero || urls[0] || "";

  return {
    hero,
    yellowstoneBg: toCmsMediaUrl("projects/colossal/colossal_pageheader3.mp4") || roleMap.get("yellowstone_bg") || pickMediaByHints(urls, ["pageheader3", "colossal_pageheader3"], fallback),
    thumb: roleMap.get("main_thumb") ?? pickMediaByHints(urls, ["main_thumb", "thumb"], hero || fallback),
    step1: roleMap.get("step_01") ?? pickMediaByHints(urls, ["step 1 _short", "step 1 - short", "step 1"], fallback),
    step23: roleMap.get("step_02_03") ?? pickMediaByHints(urls, ["step 2 and 3", "step 2", "step 3"], fallback),
    step4: roleMap.get("step_04") ?? pickMediaByHints(urls, ["step 4 - short", "step 4"], fallback),
    step57: roleMap.get("step_05_07") ?? pickMediaByHints(urls, ["step 5 - 7", "step 5", "step 6", "step 7"], fallback),
    step8: roleMap.get("step_08") ?? pickMediaByHints(urls, ["step 8 - short", "step 8"], fallback),
    aru: roleMap.get("yellowstone_aru") ?? pickMediaByHints(urls, ["yellowstone bioacoustics - aru"], fallback),
    spectrogramMap: roleMap.get("yellowstone_map") ?? pickMediaByHints(urls, ["spectrogram and map"], fallback),
    master: roleMap.get("yellowstone_master") ?? pickMediaByHints(urls, ["master - 250509 - kh", "h264 4k - master"], fallback),
  };
}

function parseCredits(copy: string): Array<{ role: string; name: string }> {
  return copy
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const split = line.split(/\s*:\s*|\s*\/\/\s*/);
      if (split.length < 2) {
        return null;
      }
      const role = split[0]?.trim() ?? "";
      const name = split.slice(1).join(" ").trim();
      if (!role || !name) {
        return null;
      }
      return { role, name };
    })
    .filter((entry): entry is { role: string; name: string } => !!entry);
}

function isCreditsBlock(block: ProjectBlock): boolean {
  const title = block.title.toLowerCase();
  const copy = block.copy.toLowerCase();
  return title.includes("credit") || copy.includes("creative lead") || copy.includes("director") || copy.includes("editor");
}

function SignalVideoBlock({
  src,
  captionLabel,
  captionMeta,
}: {
  src: string;
  captionLabel: string;
  captionMeta: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");

  if (!src) {
    return (
      <div className={signal.videoBlock}>
        <div className={signal.videoWrap}>
          <div className={signal.videoFallback}>Media unavailable</div>
        </div>
        <div className={signal.videoCaptionBar}>
          <span className={signal.videoCaptionLabel}>{captionLabel}</span>
          <span className={signal.videoCaptionMeta}>{captionMeta}</span>
        </div>
      </div>
    );
  }

  const renderSrc = toRenderableMediaUrl(src);

  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
  };

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.videoWidth > 0 && el.videoHeight > 0) {
      setAspectRatio(`${el.videoWidth} / ${el.videoHeight}`);
    }
  };

  return (
    <div className={signal.videoBlock}>
      <div className={signal.videoWrap} style={{ aspectRatio }}>
        <video
          ref={videoRef}
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
        >
          <source src={renderSrc} type="video/mp4" />
        </video>
        <button type="button" className={signal.videoAudio} onClick={toggleMuted} aria-pressed={!muted}>
          {muted ? "Unmute" : "Mute"}
        </button>
      </div>
      <div className={signal.videoCaptionBar}>
        <span className={signal.videoCaptionLabel}>{captionLabel}</span>
        <span className={signal.videoCaptionMeta}>{captionMeta}</span>
      </div>
    </div>
  );
}

function FeatureVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(true);
  const renderSrc = toRenderableMediaUrl(src);
  const mime = getVideoMimeType(renderSrc);

  const toggleMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      if (ref.current) ref.current.muted = next;
      return next;
    });
  };

  return (
    <div className={editorial.featureVideoWrap}>
      <video ref={ref} autoPlay muted={muted} loop playsInline preload="metadata">
        <source src={renderSrc} type={mime} />
      </video>
      <button type="button" className={editorial.featureVideoAudio} onClick={toggleMuted} aria-pressed={!muted}>
        {muted ? "Unmute" : "Mute"}
      </button>
    </div>
  );
}

function EditorialDividerTicker() {
  const items = ["────────────────", "◆ CONTINUED ◆", "────────────────", "◆ CONTINUED ◆",
                 "────────────────", "◆ CONTINUED ◆", "────────────────", "◆ CONTINUED ◆",
                 "────────────────", "◆ CONTINUED ◆", "────────────────", "◆ CONTINUED ◆"];
  return (
    <div className={editorial.sectionTicker}>
      <div className={editorial.sectionTickerTrack}>
        {items.map((t, i) => (
          <span key={i} className={`${editorial.sectionTickerItem}${i % 2 === 1 ? ` ${editorial.sectionTickerItemHi}` : ""}`}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function DividerTicker({ s }: { s: Record<string, string> }) {
  const items = ["────────────────", "◆ SIGNAL CONTINUES ◆", "────────────────", "◆ SIGNAL CONTINUES ◆",
                 "────────────────", "◆ SIGNAL CONTINUES ◆", "────────────────", "◆ SIGNAL CONTINUES ◆",
                 "────────────────", "◆ SIGNAL CONTINUES ◆", "────────────────", "◆ SIGNAL CONTINUES ◆"];
  return (
    <div className={s.sectionTicker}>
      <div className={s.sectionTickerTrack}>
        {items.map((t, i) => (
          <span key={i} className={`${s.sectionTickerItem}${i % 2 === 1 ? ` ${s.sectionTickerItemHi}` : ""}`}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export function ProjectPageOverlayWindow({ pageId, onClose }: { pageId: string; onClose?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pageData, setPageData] = useState<PageRow | null>(null);
  const [pages, setPages] = useState<PageRow[]>([]);
  const [startedMedia, setStartedMedia] = useState<Set<string>>(new Set());
  const [closing, setClosing] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error" | "missing">("loading");
  const [loadMessage, setLoadMessage] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const motionParam = searchParams.get("motion");
  const exportParam = searchParams.get("export");
  const isPngExportMode = exportParam === "png";
  const motionPreset =
    motionParam === "subtle" || motionParam === "dramatic" || motionParam === "balanced" ? motionParam : "balanced";

  const defaultClose = useCallback(() => {
    closeToPreviousOrHome(router);
  }, [router]);
  const handleClose = onClose ?? defaultClose;

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoadState("loading");
      setLoadMessage("");
      setPageData(null);
      try {
        const response = await fetch("/api/pages");
        if (!response.ok) {
          if (isMounted) {
            setLoadState("error");
            setLoadMessage("Unable to load project pages right now.");
          }
          return;
        }

        const data = (await response.json()) as unknown;
        const availablePages = normalizePages(data);
        const selected = availablePages.find((page) => String(page.page ?? "") === pageId) ?? null;
        if (isMounted) {
          setPages(availablePages);
          setPageData(selected);
          if (selected) {
            setLoadState("ready");
          } else {
            setLoadState("missing");
            setLoadMessage(`Project page ${pageId} was not found.`);
          }
        }
      } catch {
        if (isMounted) {
          setLoadState("error");
          setLoadMessage("Something went wrong while loading this project.");
        }
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [pageId, loadAttempt]);

  const blocks = useMemo(() => buildProjectBlocks(pageData), [pageData]);
  const title = getPageTitle(pageData) || "PROJECT";
  const pageSlug = useMemo(() => getPageSlug(pageData), [pageData]);
  const isColossalSpecimen = pageSlug === "colossal";
  const likelyColossalPage = String(pageId).trim() === "3";
  const useColossalLayout = isColossalSpecimen || likelyColossalPage;
  const isTexasMonthlySpecimen = pageSlug === "texas-monthly";
  const likelyTexasMonthlyPage = String(pageId).trim() === "2";
  const useTexasMonthlyLayout = isTexasMonthlySpecimen || likelyTexasMonthlyPage;
  const useLightArchiveShell = true;
  const pageNumber = Number(pageId);

  const sortedPageIds = useMemo(
    () =>
      pages
        .map((page) => Number(page.page))
        .filter((id) => Number.isFinite(id) && id > 0)
        .sort((a, b) => a - b),
    [pages],
  );

  const previousPage = useMemo(() => {
    const lower = sortedPageIds.filter((id) => id < pageNumber);
    return lower.length > 0 ? lower[lower.length - 1] : null;
  }, [sortedPageIds, pageNumber]);

  const nextPage = useMemo(() => {
    const higher = sortedPageIds.filter((id) => id > pageNumber);
    return higher.length > 0 ? higher[0] : null;
  }, [sortedPageIds, pageNumber]);
  const previousPageTitle = useMemo(() => {
    if (!previousPage) return "Previous";
    const found = pages.find((page) => Number(page.page) === previousPage);
    return getPageTitle(found) || "Previous";
  }, [pages, previousPage]);
  const nextPageTitle = useMemo(() => {
    if (!nextPage) return "Next";
    const found = pages.find((page) => Number(page.page) === nextPage);
    return getPageTitle(found) || "Next";
  }, [nextPage, pages]);
  const colossalMedia = useMemo(() => buildColossalMedia(pageData, blocks), [blocks, pageData]);
  const isReady = loadState === "ready";
  const loadingGifSrc = toRenderableMediaUrl("site/SinePlay_8.gif");
  const pageCopy = toPageText((pageData as Record<string, unknown> | null)?.["project-copy"] ?? pageData?.project_copy);
  const pageYear = toPageText(pageData?.year);
  const pageCategory = toPageText(pageData?.category);
  const pageClient = toPageText((pageData as Record<string, unknown> | null)?.client) || title;
  const streamHeaderMedia = useMemo(() => {
    const card = toCmsMediaUrl(pageData?.card_background ?? pageData?.["card-background"]);
    if (card) return card;
    for (const block of blocks) {
      for (const media of block.media) {
        const url = toCmsMediaUrl(media.url);
        if (url) return url;
      }
    }
    return "";
  }, [blocks, pageData]);
  const streamTickerItems = [title, pageClient, pageYear || "Undated", pageCategory || "Archive"].filter(Boolean);

  useEffect(() => {
    setClosing(false);
    setShareState("idle");
    setStartedMedia(new Set());
  }, [pageId]);

  useEffect(() => {
    document.body.classList.add("projectpage-overlay-open");
    return () => {
      document.body.classList.remove("projectpage-overlay-open");
    };
  }, []);

  const closeOverlay = useCallback(() => {
    if (closing) {
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      handleClose();
    }, 220);
  }, [closing, handleClose]);

  const navigateToPage = useCallback(
    (targetPage: number | null) => {
      if (!targetPage || closing) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());
      params.set("modal", "project-page");
      params.set("page", String(targetPage));
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [closing, pathname, router, searchParams],
  );

  const shareProject = useCallback(async () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("modal", "project-page");
      url.searchParams.set("page", pageId);
      await navigator.clipboard.writeText(url.toString());
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 1600);
    }
  }, [pageId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOverlay();
      }
      if (event.key === "ArrowLeft") {
        navigateToPage(previousPage);
      }
      if (event.key === "ArrowRight") {
        navigateToPage(nextPage);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeOverlay, navigateToPage, nextPage, previousPage]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      closeOverlay();
    }
  };

  return (
    <div
      className={`window-overlay window-overlay--projectpage${useLightArchiveShell ? " window-overlay--projectpage-light" : ""}${isPngExportMode ? " window-overlay--projectpage-export" : ""}${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={handleBackdropClick}
    >
      <div className={`projectpage-shell motion-${motionPreset}${useLightArchiveShell ? " side-light no-side" : ""}${isPngExportMode ? " projectpage-shell--export" : ""}${closing ? " is-closing" : ""}`}>
        {false ? (
          <aside className="projectpage-side">
            <div className="projectpage-side-main">
              <div className="projectpage-side-heading">
                <p className="projectpage-side-index type-overline">{String(pageNumber).padStart(2, "0")}.</p>
                <h2 className="projectpage-side-title">{title}</h2>
              </div>
              {!isReady ? (
                <p className={`projectpage-status-pill is-${loadState}`}>
                  {loadState === "loading"
                    ? "Loading"
                    : loadState === "missing"
                      ? "Not found"
                      : "Error"}
                </p>
              ) : null}
              {pageCopy ? <p className="projectpage-side-copy type-caption">{pageCopy}</p> : null}
            </div>
            <div className="projectpage-side-footer">
              <div className="projectpage-side-rail">
                <button
                  type="button"
                  className="projectpage-side-railbtn"
                  onClick={() => navigateToPage(previousPage)}
                  disabled={!previousPage || !isReady}
                  aria-label="Previous project"
                >
                  &lt; Prev
                </button>
                <button type="button" className="projectpage-side-railbtn" onClick={closeOverlay}>
                  Close
                </button>
                <button type="button" className="projectpage-side-railbtn" onClick={shareProject} disabled={!isReady}>
                  {shareState === "copied" ? "Copied" : shareState === "error" ? "Failed" : "Share"}
                </button>
                <button
                  type="button"
                  className="projectpage-side-railbtn"
                  onClick={() => navigateToPage(nextPage)}
                  disabled={!nextPage || !isReady}
                  aria-label="Next project"
                >
                  Next &gt;
                </button>
              </div>
            </div>
          </aside>
        ) : null}

        <div className="projectpage-main">
          {!isReady ? (
            <div className={`projectpage-main-status${useLightArchiveShell ? " is-light" : ""}`} role="status" aria-live="polite">
              {loadState === "loading" ? (
                <img
                  src={loadingGifSrc}
                  alt=""
                  aria-hidden="true"
                  style={{ width: "40px", height: "40px", objectFit: "contain", marginBottom: "12px" }}
                />
              ) : null}
              <p className="status-kicker">
                {loadState === "loading" ? "Loading project" : loadState === "missing" ? "Project unavailable" : "Load error"}
              </p>
              <h3 className="status-title">
                {loadState === "loading"
                  ? "Preparing media and layout"
                  : loadState === "missing"
                    ? "This project could not be found"
                    : "Unable to load this page right now"}
              </h3>
              <p className="status-copy">
                {loadState === "loading"
                  ? "Please wait while we sync assets for this modal."
                  : loadMessage || "Try again, or close this modal and open a different project."}
              </p>
              <div className="status-actions">
                {(loadState === "error" || loadState === "missing") && (
                  <button type="button" className="status-btn" onClick={() => setLoadAttempt((value) => value + 1)}>
                    Retry
                  </button>
                )}
                <button type="button" className="status-btn" onClick={closeOverlay}>
                  Close
                </button>
              </div>
            </div>
          ) : useColossalLayout ? (
            <div className={signal.shell}>
              <nav className={signal.topNav} aria-label="Project controls">
                <button
                  type="button"
                  className={signal.topNavBtn}
                  onClick={() => navigateToPage(previousPage)}
                  disabled={!previousPage || !isReady}
                  aria-label="Previous project"
                >
                  Prev
                </button>
                <button type="button" className={signal.topNavBtn} onClick={closeOverlay}>
                  Close
                </button>
                <button type="button" className={signal.topNavBtn} onClick={shareProject} disabled={!isReady}>
                  {shareState === "copied" ? "Copied" : shareState === "error" ? "Failed" : "Share"}
                </button>
                <button
                  type="button"
                  className={signal.topNavBtn}
                  onClick={() => navigateToPage(nextPage)}
                  disabled={!nextPage || !isReady}
                  aria-label="Next project"
                >
                  Next
                </button>
              </nav>

              {/* ── TICKER ── */}
              <div className={signal.ticker}>
                <div className={signal.tickerTrack}>
                  {["Colossal Biosciences", "Dire Wolf", "De-extinction - 2025", "Science-Tech Design", "Motion Design: Lyon Graulty",
                    "Colossal Biosciences", "Dire Wolf", "De-extinction - 2025", "Science-Tech Design", "Motion Design: Lyon Graulty"].map((t, i) => (
                    <span key={i} className={signal.tickerItem}>{t}</span>
                  ))}
                </div>
              </div>

              {/* ── HEADER ── */}
              <header className={signal.header}>
                {colossalMedia.hero ? (
                  <video className={signal.headerBgVideo} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                    <source src={toRenderableMediaUrl(colossalMedia.hero)} type="video/mp4" />
                  </video>
                ) : (
                  <div className={signal.headerBg} />
                )}
                <div className={signal.headerInner}>
                  <div className={signal.headerSeq}>Transmission - {String(pageNumber).padStart(3, "0")} / Colossal Biosciences</div>
                  <h1 className={signal.headerTitle}>Dire Wolf</h1>
                  <p className={signal.headerIntro}>
                    This piece was an exciting challenge: visualizing breakthrough science in a way that felt both cinematic and clear.
                    From microscopic cell animations to bold typographic transitions, every moment had to balance precision with energy
                    — a rewarding push to make complexity feel intuitive and alive.{" "}
                    I worked across motion design, some 3D, and a lot of the system thinking—building out the animated icon language,
                    lower thirds, logo treatments, and transitions that carry the piece. The focus was on guiding the viewer&apos;s eye
                    to what matters, when it matters, and keeping everything cohesive across a wide range of content.
                  </p>
                  <div className={signal.headerMetaRow}>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Client</span>
                      <span className={signal.headerMetaVal}>Colossal Biosciences</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Year</span>
                      <span className={signal.headerMetaVal}>2025</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Category</span>
                      <span className={signal.headerMetaVal}>Science-Tech Design</span>
                    </div>
                  </div>
                </div>
              </header>

              {/* ── MAKING OF: 5 IN ORDER ── */}
              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Making Of Sequence</div>
                  <p className={signal.stepHeading}>1) Collect Dire Wolf Cells</p>
                </div>
                <SignalVideoBlock src={colossalMedia.step1} captionLabel="Making Of - Step 01" captionMeta="01 / 05" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Making Of Sequence</div>
                  <p className={signal.stepHeading}>2/3) Sequence DW Genome &amp; Identify Pure Gray Wolf</p>
                </div>
                <SignalVideoBlock src={colossalMedia.step23} captionLabel="Making Of - Step 02 / 03" captionMeta="02 / 05" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Making Of Sequence</div>
                  <p className={signal.stepHeading}>4) Sequence Gray Wolf genome</p>
                </div>
                <SignalVideoBlock src={colossalMedia.step4} captionLabel="Making Of - Step 04" captionMeta="03 / 05" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Making Of Sequence</div>
                  <p className={signal.stepHeading}>5-7) Gene Alignment, Filter Variants &amp; Genome Engineering</p>
                </div>
                <SignalVideoBlock src={colossalMedia.step57} captionLabel="Making Of - Step 05 / 07" captionMeta="04 / 05" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Making Of Sequence</div>
                  <p className={signal.stepHeading}>8) Clone Cells</p>
                </div>
                <SignalVideoBlock src={colossalMedia.step8} captionLabel="Making Of - Step 08" captionMeta="05 / 05" />
              </section>

              {/* ── CREDITS 01 ── */}
              <div className={signal.credits}>
                <div className={signal.creditsLabel}>Credits - Making Of</div>
                <div className={signal.creditsGrid}>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Creative Lead</span>
                    <span className={signal.creditName}>Chris Klee</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Director</span>
                    <span className={signal.creditName}>Ryan Padgett</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Visual Designer</span>
                    <span className={signal.creditName}>Nathan Walker</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Editor</span>
                    <span className={signal.creditName}>Kaley Hanson</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Motion Designer</span>
                    <span className={signal.creditName}>Lyon Graulty</span>
                  </div>
                </div>
              </div>

              <DividerTicker s={signal} />

              {/* ── YELLOWSTONE SUB-HEADER ── */}
              <header className={signal.sectionHeader}>
                {colossalMedia.yellowstoneBg ? (
                  <video className={signal.headerBgVideo} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                    <source src={toRenderableMediaUrl(colossalMedia.yellowstoneBg)} type="video/mp4" />
                  </video>
                ) : (
                  <div className={signal.headerBg} />
                )}
                <div className={signal.headerInner}>
                  <div className={signal.headerSeq}>Transmission - {String(pageNumber).padStart(3, "0")} / Colossal Biosciences</div>
                  <h2 className={signal.headerTitle}>Bioacoustics</h2>
                  <p className={signal.headerIntro}>
                    Acoustic intelligence for wild landscapes isn&apos;t a future idea—it&apos;s already listening.{" "}
                    I handled motion design, 3D modeling, and visual effects—translating that data into something you can actually follow on screen.
                    Turning audio into visuals, shaping patterns into something readable, and guiding attention to the meaningful parts.{" "}
                    There&apos;s a lot of detail work behind the scenes too—down to masking out individual snowflakes in one of the spectrograph shots, just to get it to sit right.
                  </p>
                  <div className={signal.headerMetaRow}>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Client</span>
                      <span className={signal.headerMetaVal}>Colossal Biosciences</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Year</span>
                      <span className={signal.headerMetaVal}>2025</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Category</span>
                      <span className={signal.headerMetaVal}>Science/Tech Documentary</span>
                    </div>
                  </div>
                </div>
              </header>

              {/* ── YELLOWSTONE: 3 IN ORDER ── */}
              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Yellowstone Sequence</div>
                  <p className={signal.stepHeading}>1) Yellowstone Bioacoustics</p>
                </div>
                <SignalVideoBlock src={colossalMedia.master} captionLabel="Yellowstone Bioacoustics" captionMeta="01 / 03" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Yellowstone Sequence</div>
                  <p className={signal.stepHeading}>2) Spectrogram and Map</p>
                </div>
                <SignalVideoBlock src={colossalMedia.spectrogramMap} captionLabel="Spectrogram and Map" captionMeta="02 / 03" />
              </section>

              <DividerTicker s={signal} />

              <section className={signal.section}>
                <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                  <div className={signal.typeBlockSeq}>Yellowstone Sequence</div>
                  <p className={signal.stepHeading}>3) Acoustic Recording Unit</p>
                </div>
                <SignalVideoBlock src={colossalMedia.aru} captionLabel="Acoustic Recording Unit" captionMeta="03 / 03" />
              </section>

              {/* ── CREDITS 02 ── */}
              <div className={signal.credits}>
                <div className={signal.creditsLabel}>Credits - Yellowstone Bioacoustics</div>
                <div className={signal.creditsGrid}>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Creative Lead</span>
                    <span className={signal.creditName}>Chris Klee</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Director</span>
                    <span className={signal.creditName}>Ryan Padgett</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Motion Designer</span>
                    <span className={signal.creditName}>Lyon Graulty</span>
                  </div>
                  <div className={signal.creditItem}>
                    <span className={signal.creditRole}>Editor</span>
                    <span className={signal.creditName}>Kaley Hanson</span>
                  </div>
                </div>
              </div>

              {/* ── FOOTER NAV ── */}
              <nav className={signal.footerNav} aria-label="Project pagination">
                <button
                  type="button"
                  className={signal.footerNavBtn}
                  onClick={() => navigateToPage(previousPage)}
                  disabled={!previousPage}
                  aria-label="Previous project"
                >
                  <span className={signal.footerNavDir}>Prev</span>
                  <span className={signal.footerNavTitle}>{previousPageTitle}</span>
                </button>
                <button
                  type="button"
                  className={`${signal.footerNavBtn} ${signal.footerNavBtnNext}`}
                  onClick={() => navigateToPage(nextPage)}
                  disabled={!nextPage}
                  aria-label="Next project"
                >
                  <span className={signal.footerNavDir}>Next</span>
                  <span className={signal.footerNavTitle}>{nextPageTitle}</span>
                </button>
              </nav>
            </div>
          ) : useTexasMonthlyLayout ? (
            <div className={editorial.shell}>
              {/* ── TOP NAV ── */}
              <nav className={editorial.topNav} aria-label="Project controls">
                <button type="button" className={editorial.topNavBtn} onClick={() => navigateToPage(previousPage)} disabled={!previousPage || !isReady} aria-label="Previous project">Prev</button>
                <button type="button" className={editorial.topNavBtn} onClick={closeOverlay}>Close</button>
                <button type="button" className={editorial.topNavBtn} onClick={shareProject} disabled={!isReady}>{shareState === "copied" ? "Copied" : shareState === "error" ? "Failed" : "Share"}</button>
                <button type="button" className={editorial.topNavBtn} onClick={() => navigateToPage(nextPage)} disabled={!nextPage || !isReady} aria-label="Next project">Next</button>
              </nav>

              {/* ── TICKER ── */}
              <div className={editorial.ticker}>
                <div className={editorial.tickerTrack}>
                  {["Texas Monthly", "Editorial Animation", "2022 – 2025", "Animated Cover Design", "Texas Monthly", "Editorial Animation", "2022 – 2025", "Animated Cover Design"].map((t, i) => (
                    <span key={i} className={editorial.tickerItem}>{t}</span>
                  ))}
                </div>
              </div>

              {/* ── HEADER (light) ── */}
              <header className={editorial.header}>
                <p className={editorial.headerEyebrow}>Editorial Animation · 2022–2025</p>
                <h1 className={editorial.headerTitle}>Texas Monthly</h1>
                {pageCopy && <p className={editorial.headerIntro}>{pageCopy}</p>}
                <div className={editorial.headerMetaRow}>
                  <div className={editorial.headerMetaItem}>
                    <span className={editorial.headerMetaLabel}>Client</span>
                    <span className={editorial.headerMetaVal}>{pageClient}</span>
                  </div>
                  <div className={editorial.headerMetaItem}>
                    <span className={editorial.headerMetaLabel}>Year</span>
                    <span className={editorial.headerMetaVal}>{pageYear || "2022–2025"}</span>
                  </div>
                  <div className={editorial.headerMetaItem}>
                    <span className={editorial.headerMetaLabel}>Category</span>
                    <span className={editorial.headerMetaVal}>{pageCategory || "Editorial Animation"}</span>
                  </div>
                </div>
              </header>

              {/* ── COVERS ── */}
              <div className={editorial.sectionBar}>Animated Covers</div>
              <section className={editorial.section}>
                <div className={editorial.coversWithBlurb}>
                  <p className={editorial.coversBlurb}>
                    Six covers, all with distinct styles and tones. Each piece called for a slightly different approach, but the throughline was restraint—finding the smallest move that makes the image feel alive.
                    <br /><br />
                    Except for the water piece. I got to let loose on that one a little more with some directed liquid simulations.
                  </p>
                  <div className={editorial.coverGrid}>

                  {[
                    { src: "projects/texas-monthly/TexasMonthly_Selena.mp4", label: "Selena" },
                    { src: "projects/texas-monthly/TexasMonthly_bumscover_H264.mp4", label: "Greg Abbott – Bum Steer of the Year" },
                    { src: "projects/texas-monthly/TexasMonthly_Water_CoverRatio_Title.mp4", label: "Who's Wasting Our Water?" },
                    { src: "projects/texas-monthly/TexasMonthly_TrumpsApostle_V06.mp4", label: "Trump's Apostle" },
                    { src: "projects/texas-monthly/TexasMonthly_ComeAndFakeIt.mp4", label: "Come and Fake It" },
                    { src: "projects/texas-monthly/TexasMonthly_TomBrownsBody_V01.mp4", label: "Tom Brown's Body" },
                  ].map(({ src, label }) => {
                    const url = toRenderableMediaUrl(src);
                    return (
                      <div key={src} className={editorial.coverCell}>
                        <video autoPlay muted loop playsInline preload="metadata">
                          <source src={url} type="video/mp4" />
                        </video>
                        <div className={editorial.coverCellCaption}>
                          <span className={editorial.coverCellLabel}>{label}</span>
                          <span className={editorial.coverCellAccent}>◆</span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
                <div className={editorial.credits}>
                  <div className={editorial.creditsLabel}>Animated Covers – Credits</div>
                  <div className={editorial.creditsGrid}>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Animation by</span>
                      <span className={editorial.creditName}>Lyon Graulty</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Produced by</span>
                      <span className={editorial.creditName}>Emily Kimbro</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Mercedes deBellard</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Mike McQuade</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Nicolás Ortega</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Tim O&apos;Brien</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Hokyoung Kim</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Doug Chayka</span>
                    </div>
                  </div>
                </div>
              </section>

              <EditorialDividerTicker />
              {/* ── TOM BROWN'S BODY ── */}
              <section className={editorial.section}>
                <div className={editorial.featureLayout}>
                  <FeatureVideo src="projects/texas-monthly/TexasMonthly_TomBrownsBody_ALL.mp4" />
                  <div className={editorial.featureCopyCol}>
                    <p className={editorial.featureTitle}>Tom Brown&apos;s Body</p>
                    <p className={editorial.featureCopyText}>
                      {`For this true crime piece, the work leaned more into tone. I developed a series of moody, atmospheric animations that extend the feeling of the illustrations—letting moments linger, adding tension, and giving the visuals a sense of unease without overstating it.\n\nIt was less about movement and more about pacing and restraint—helping set the emotional temperature of the story.`}
                    </p>
                    <p className={editorial.featureCopyCaption}>Texas Monthly · Tom Brown&apos;s Body · 2023</p>
                  </div>
                </div>
                <div className={editorial.credits}>
                  <div className={editorial.creditsLabel}>Tom Brown&apos;s Body – Credits</div>
                  <div className={editorial.creditsGrid}>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Animation by</span>
                      <span className={editorial.creditName}>Lyon Graulty</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Produced by</span>
                      <span className={editorial.creditName}>Emily Kimbro</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustrations by</span>
                      <span className={editorial.creditName}>Hokyoung Kim</span>
                    </div>
                  </div>
                </div>
              </section>

              <EditorialDividerTicker />
              {/* ── 50TH ANNIVERSARY ── */}
              <section className={editorial.section}>
                <div className={editorial.fiftiethFeature}>
                  {/* Left: copy + small Web video */}
                  <div className={editorial.fiftiethFeatureCopy}>
                    <p className={editorial.featureTitle}>50th Anniversary</p>
                    <p className={editorial.featureCopyText}>
                      {`I also contributed animation for the magazine's 50th anniversary feature—an especially meaningful piece to be part of.\n\nThe goal here was to support the storytelling in a way that felt considered and respectful of that history—adding motion where it helps, and staying out of the way where it doesn't.`}
                    </p>
                    <div className={editorial.fiftiethWebSmall}>
                      <a href="https://www.texasmonthly.com/50th-anniversary-issue/" target="_blank" rel="noopener noreferrer" className={editorial.fiftiethWebSmallWrap}>
                        <video autoPlay muted loop playsInline preload="metadata">
                          <source src={toRenderableMediaUrl("projects/texas-monthly/TexasMontly50th_Web.mp4")} type="video/mp4" />
                        </video>
                      </a>
                      <p className={editorial.fiftiethWebSmallCaption}>Web Version ↗</p>
                    </div>
                  </div>
                  {/* Right: 50thAll with padding */}
                  <div className={editorial.fiftiethFeatureVideoCol}>
                    <div className={editorial.fiftiethFeatureVideoWrap}>
                      <video autoPlay muted loop playsInline preload="metadata">
                        <source src={toRenderableMediaUrl("projects/texas-monthly/TexasMonthly_50thAll.mp4")} type="video/mp4" />
                      </video>
                    </div>
                  </div>
                </div>
                <div className={editorial.credits}>
                  <div className={editorial.creditsLabel}>50th Anniversary – Credits</div>
                  <div className={editorial.creditsGrid}>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Produced by</span>
                      <span className={editorial.creditName}>Emily Kimbro</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Animation by</span>
                      <span className={editorial.creditName}>Lyon Graulty</span>
                    </div>
                    <div className={editorial.creditItem}>
                      <span className={editorial.creditRole}>Illustration by</span>
                      <span className={editorial.creditName}>Braulio Amado</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* ── FOOTER NAV ── */}
              <nav className={editorial.footerNav} aria-label="Project pagination">
                <button type="button" className={editorial.footerNavBtn} onClick={() => navigateToPage(previousPage)} disabled={!previousPage} aria-label="Previous project">
                  <span className={editorial.footerNavDir}>Prev</span>
                  <span className={editorial.footerNavTitle}>{previousPageTitle}</span>
                </button>
                <button type="button" className={`${editorial.footerNavBtn} ${editorial.footerNavBtnNext}`} onClick={() => navigateToPage(nextPage)} disabled={!nextPage} aria-label="Next project">
                  <span className={editorial.footerNavDir}>Next</span>
                  <span className={editorial.footerNavTitle}>{nextPageTitle}</span>
                </button>
              </nav>
            </div>
          ) : (
            <div className="projectpage-main-stream">
              <nav className={signal.topNav} aria-label="Project controls">
                <button
                  type="button"
                  className={signal.topNavBtn}
                  onClick={() => navigateToPage(previousPage)}
                  disabled={!previousPage || !isReady}
                  aria-label="Previous project"
                >
                  Prev
                </button>
                <button type="button" className={signal.topNavBtn} onClick={closeOverlay}>
                  Close
                </button>
                <button type="button" className={signal.topNavBtn} onClick={shareProject} disabled={!isReady}>
                  {shareState === "copied" ? "Copied" : shareState === "error" ? "Failed" : "Share"}
                </button>
                <button
                  type="button"
                  className={signal.topNavBtn}
                  onClick={() => navigateToPage(nextPage)}
                  disabled={!nextPage || !isReady}
                  aria-label="Next project"
                >
                  Next
                </button>
              </nav>

              <div className={signal.ticker}>
                <div className={signal.tickerTrack}>
                  {[...streamTickerItems, ...streamTickerItems].map((item, i) => (
                    <span key={`ticker-${i}`} className={signal.tickerItem}>{item}</span>
                  ))}
                </div>
              </div>

              <header className={signal.header}>
                {streamHeaderMedia ? (
                  isLikelyVideoUrl(streamHeaderMedia) ? (
                    <video className={signal.headerBgVideo} autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
                      <source src={toRenderableMediaUrl(streamHeaderMedia)} type="video/mp4" />
                    </video>
                  ) : (
                    <div className={signal.headerBg} style={{ backgroundImage: `url(${toRenderableMediaUrl(streamHeaderMedia)})` }} />
                  )
                ) : (
                  <div className={signal.headerBg} />
                )}
                <div className={signal.headerInner}>
                  <div className={signal.headerSeq}>
                    {`Transmission - ${String(pageNumber).padStart(3, "0")} / ${pageClient} / ${pageYear || "----"} / ${pageCategory || "Archive"}`}
                  </div>
                  <h1 className={signal.headerTitle}>{title}</h1>
                  {pageCopy ? <p className={signal.headerIntro}>{pageCopy}</p> : null}
                  <div className={signal.headerMetaRow}>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Client</span>
                      <span className={signal.headerMetaVal}>{pageClient}</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Year</span>
                      <span className={signal.headerMetaVal}>{pageYear || "----"}</span>
                    </div>
                    <div className={signal.headerMetaItem}>
                      <span className={signal.headerMetaLabel}>Category</span>
                      <span className={signal.headerMetaVal}>{pageCategory || "Archive"}</span>
                    </div>
                  </div>
                </div>
              </header>

              {blocks.length === 0 ? (
                <div className="projectpage-main-status" role="status" aria-live="polite">
                  <p className="status-kicker">No blocks</p>
                  <h3 className="status-title">No structured content for this project yet</h3>
                  <p className="status-copy">Add blocks in content/site-data.json to populate this modal.</p>
                </div>
              ) : null}

              {blocks.map((block, index) => {
                const renderables = buildRenderableMedia(block);
                const blockSeq = String(block.slot).padStart(2, "0");
                const sectionTitle = block.title || `Section ${blockSeq}`;
                const credits = isCreditsBlock(block) ? parseCredits(block.copy) : [];
                return (
                  <Fragment key={`${block.slot}-${sectionTitle.slice(0, 16)}`}>
                    <section className={signal.section}>
                      {credits.length > 0 ? (
                        <div className={signal.credits}>
                          <div className={signal.creditsGrid}>
                            {credits.map((credit, creditIndex) => (
                              <div key={`${credit.role}-${creditIndex}`} className={signal.creditItem}>
                                <span className={signal.creditRole}>{credit.role}</span>
                                <span className={signal.creditName}>{credit.name}</span>
                              </div>
                            ))}
                          </div>
                          <div className={signal.creditsLabel} style={{ marginTop: "1.5rem", marginBottom: 0 }}>
                            Credits
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`${signal.typeBlock} ${signal.typeBlockCompact}`}>
                            <div className={signal.typeBlockSeq}>Section {blockSeq}</div>
                            <p className={signal.stepHeading}>{sectionTitle}</p>
                          </div>

                          {renderables.map((item) => {
                            const label = `${title} block ${blockSeq}`;
                            const started = startedMedia.has(item.key);
                            return (
                              <div key={item.key} className={signal.videoBlock}>
                                <div className={signal.videoWrap}>
                                  {item.playable ? (
                                    started ? (
                                      renderStartedMedia(item.url, label, item.posterUrl)
                                    ) : (
                                      <button
                                        type="button"
                                        className="reel-cover-button"
                                        onClick={() => {
                                          setStartedMedia((prev) => {
                                            const next = new Set(prev);
                                            next.add(item.key);
                                            return next;
                                          });
                                        }}
                                        aria-label={`Play ${label}`}
                                      >
                                        {renderMediaPreview(item.url, item.posterUrl, label, item.thumbnailAt)}
                                        <span className="reel-cover-play" aria-hidden="true" />
                                      </button>
                                    )
                                  ) : (
                                    renderMediaPreview(item.url, "", label, item.thumbnailAt)
                                  )}
                                </div>
                                <div className={signal.videoCaptionBar}>
                                  <span className={signal.videoCaptionLabel}>{sectionTitle}</span>
                                  <span className={signal.videoCaptionMeta}>{blockSeq}</span>
                                </div>
                              </div>
                            );
                          })}

                          {block.copy ? <p className={signal.typeBody} style={{ whiteSpace: "pre-line", margin: "1rem 1.5rem 2rem" }}>{block.copy}</p> : null}
                        </>
                      )}
                    </section>
                    {index < blocks.length - 1 ? <DividerTicker s={signal} /> : null}
                  </Fragment>
                );
              })}

              <nav className={signal.footerNav} aria-label="Project pagination">
                <button
                  type="button"
                  className={signal.footerNavBtn}
                  onClick={() => navigateToPage(previousPage)}
                  disabled={!previousPage}
                  aria-label="Previous project"
                >
                  <span className={signal.footerNavDir}>Prev</span>
                  <span className={signal.footerNavTitle}>{previousPageTitle}</span>
                </button>
                <button
                  type="button"
                  className={`${signal.footerNavBtn} ${signal.footerNavBtnNext}`}
                  onClick={() => navigateToPage(nextPage)}
                  disabled={!nextPage}
                  aria-label="Next project"
                >
                  <span className={signal.footerNavDir}>Next</span>
                  <span className={signal.footerNavTitle}>{nextPageTitle}</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
