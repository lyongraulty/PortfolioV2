import projectManifest from "../../content/projects.json";

export type ProjectMedia = {
  type: "video" | "image";
  src: string;
};

export type ProjectEntry = {
  slug: string;
  title: string;
  year: string;
  category: string;
  summary: string;
  detail: string;
  media?: ProjectMedia;
};

type RawProjectEntry = Omit<ProjectEntry, "media"> & {
  media?: {
    type: string;
    src: string;
  };
};

function trimSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function isAbsoluteUrl(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

export function resolveProjectMediaSource(src: string): string {
  const value = src.trim();
  if (!value || isAbsoluteUrl(value) || value.startsWith("/")) {
    return value;
  }

  const baseUrl = process.env.BUNNY_MEDIA_BASE_URL?.trim() || process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim();
  if (!baseUrl) {
    return value;
  }

  return `${trimSlash(baseUrl)}/${value.replace(/^\/+/g, "")}`;
}

function normalizeMediaType(value: string): ProjectMedia["type"] {
  return value === "video" ? "video" : "image";
}

export const projectEntries: ProjectEntry[] = (projectManifest as RawProjectEntry[]).map((entry) => ({
  ...entry,
  media: entry.media
    ? {
        type: normalizeMediaType(entry.media.type),
        src: resolveProjectMediaSource(entry.media.src),
      }
    : undefined,
}));

export function getProjectBySlug(slug: string) {
  return projectEntries.find((item) => item.slug === slug);
}
