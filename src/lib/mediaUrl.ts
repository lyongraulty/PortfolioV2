const VIDEO_EXTENSION_RE = /\.(mp4|webm|ogg|ogv|mov|m4v)(?:$|[?#])/i;
const VIDEO_FORMAT_RE = /^(mp4|webm|ogg|ogv|mov|m4v)$/i;
const VIDEO_PATH_HINT_RE = /(^|\/)(video|videos)(\/|$)/i;
const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function withMediaBaseIfRelative(raw: string): string {
  if (!raw || ABSOLUTE_URL_RE.test(raw) || raw.startsWith("/")) {
    return raw;
  }

  const base = (process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? process.env.BUNNY_MEDIA_BASE_URL ?? "").trim();
  if (!base) {
    return raw;
  }

  return `${trimTrailingSlash(base)}/${raw.replace(/^\/+/g, "")}`;
}

// CMS media URLs are source-of-truth values and must be used as-is.
// Do not rewrite hostnames, prepend CDN bases, or normalize path segments.
export function toCmsMediaUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  return withMediaBaseIfRelative(raw);
}

export function toRenderableMediaUrl(value: unknown): string {
  const raw = toCmsMediaUrl(value);
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    parsed.pathname = parsed.pathname
      .split("/")
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");
    return parsed.toString();
  } catch {
    return encodeURI(raw);
  }
}

export function getVideoMimeType(url: string): string | undefined {
  const value = toCmsMediaUrl(url).toLowerCase();
  if (!value) {
    return undefined;
  }

  if (value.includes(".webm")) return "video/webm";
  if (value.includes(".ogv") || value.includes(".ogg")) return "video/ogg";
  if (value.includes(".mov")) return "video/quicktime";
  if (value.includes(".m4v")) return "video/x-m4v";
  if (value.includes(".mp4")) return "video/mp4";

  return undefined;
}

export function isLikelyVideoUrl(url: string): boolean {
  const value = toCmsMediaUrl(url);
  if (!value) {
    return false;
  }

  if (VIDEO_EXTENSION_RE.test(value)) {
    return true;
  }

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname.toLowerCase();
    if (VIDEO_EXTENSION_RE.test(pathname)) {
      return true;
    }

    if (VIDEO_PATH_HINT_RE.test(pathname)) {
      return true;
    }

    const format = parsed.searchParams.get("format") ?? parsed.searchParams.get("fm");
    if (format && VIDEO_FORMAT_RE.test(format)) {
      return true;
    }

    const resourceType = parsed.searchParams.get("resource_type");
    if (resourceType && resourceType.toLowerCase() === "video") {
      return true;
    }

    const mime = parsed.searchParams.get("mime") ?? parsed.searchParams.get("content-type");
    if (mime && mime.toLowerCase().startsWith("video/")) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
