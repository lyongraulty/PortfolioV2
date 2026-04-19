import { isLikelyVideoUrl, toCmsMediaUrl } from "@/lib/mediaUrl";

export type PageData = Record<string, unknown>;

/** Page 0 is the reel. Projects start at page 1 and increment from there. */
export const REEL_PAGE_ID = 0;
export type PageBlockData = Record<string, unknown>;
export type PageMediaData = Record<string, unknown>;

export function toPageText(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

export function toPageNumber(value: unknown): number | null {
  const numeric = Number(toPageText(value).trim());
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.floor(numeric);
}

export function getPageTitle(page: PageData | null | undefined): string {
  return toPageText(page?.title).trim();
}

export function getPageButtonText(page: PageData | null | undefined): string {
  return toPageText(page?.["button-text"] ?? page?.button_text).trim();
}

export function getPageProjectCopy(page: PageData | null | undefined): string {
  return toPageText(page?.["project-copy"] ?? page?.project_copy).trim();
}

export function getPageCardBackground(page: PageData | null | undefined): string {
  return toCmsMediaUrl(page?.["card-background"] ?? page?.card_background ?? page?.["card background"]);
}

export function getPageBlocks(page: PageData | null | undefined): PageBlockData[] {
  if (!Array.isArray(page?.blocks)) {
    return [];
  }

  return page.blocks.filter((block): block is PageBlockData => !!block && typeof block === "object");
}

export function getBlockMediaItems(block: PageBlockData | null | undefined): PageMediaData[] {
  if (!Array.isArray(block?.media)) {
    return [];
  }

  return block.media.filter((item): item is PageMediaData => !!item && typeof item === "object");
}

export function getCardMediaFromBackground(page: PageData | null | undefined):
  | { type: "video" | "image"; src: string }
  | undefined {
  const src = getPageCardBackground(page);
  if (!src) {
    return undefined;
  }

  return {
    type: isLikelyVideoUrl(src) ? "video" : "image",
    src,
  };
}
