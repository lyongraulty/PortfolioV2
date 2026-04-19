import { ModalLink } from "@/components/ModalLink";
import { getVideoMimeType, toRenderableMediaUrl } from "@/lib/mediaUrl";
import {
  getCardMediaFromBackground,
  getPageButtonText,
  getPageProjectCopy,
  getPageTitle,
  toPageNumber,
  toPageText,
  REEL_PAGE_ID,
} from "@/lib/pageData";
import { getPages, type PageRow } from "../../fetch/getPages";
import styles from "@/components/ProjectsMainTakeLightArchive.module.css";

function isRenderableProjectPage(page: PageRow): boolean {
  return !!(getPageTitle(page) || getPageProjectCopy(page) || getCardMediaFromBackground(page));
}

function formatIndex(n: number): string {
  return String(n).padStart(2, "0");
}

function splitTitle(title: string): { lead: string; trail: string } {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { lead: words[0] ?? "PROJECT", trail: "" };
  const mid = Math.ceil(words.length / 2);
  return { lead: words.slice(0, mid).join(" "), trail: words.slice(mid).join(" ") };
}

export async function ProjectsMainTakeLightArchive() {
  const pages = await getPages();
  const projectPages = pages
    .filter((p) => { const n = toPageNumber(p.page); return n !== null && n > REEL_PAGE_ID; })
    .sort((a, b) => (toPageNumber(a.page) ?? 9999) - (toPageNumber(b.page) ?? 9999))
    .filter(isRenderableProjectPage);

  const total = projectPages.length;
  const headerSrc = toRenderableMediaUrl("site/header.mp4");

  return (
    <div className={styles.page}>

      {/* ── HERO VIDEO ── */}
      <section className={styles.heroSection}>
        {headerSrc && (
          <video
            className={styles.heroVideo}
            autoPlay muted loop playsInline preload="metadata"
            aria-hidden="true"
          >
            <source src={headerSrc} type="video/mp4" />
          </video>
        )}
        <div className={styles.heroOverlay}>
          <p className={styles.heroEyebrow}>Selected Work - {total} Specimens</p>
          <h1 className={styles.heroTitle}>
            Lyon<br />Graulty
          </h1>
          <p className={styles.heroSub}>Motion Design - 2D &amp; 3D - Austin, TX</p>
        </div>
      </section>

      {/* ── PROJECT STACK ── */}
      <main className={styles.stack}>
        {projectPages.length === 0 && (
          <div className={styles.emptyState}>
            <p>No project pages - run local sync and refresh.</p>
          </div>
        )}

        {projectPages.map((page, index) => {
          const pageNumber  = toPageNumber(page.page) ?? 0;
          const title       = getPageTitle(page) || "Project";
          const description = getPageProjectCopy(page) || "";
          const buttonText  = getPageButtonText(page) || "View Project";
          const year        = toPageText(page.year);
          const category    = toPageText(page.category);
          const media       = getCardMediaFromBackground(page);
          const mediaSrc    = toRenderableMediaUrl(media?.src);
          const mediaMime   = media?.type === "video" ? getVideoMimeType(mediaSrc) : undefined;
          const { lead, trail } = splitTitle(title);
          const seq         = formatIndex(index + 1);
          return (
            <section
              key={`spec-${pageNumber}`}
              id={`specimen-${seq}`}
              className={styles.specimen}
            >
              {/* label bar */}
              <div className={styles.labelRow}>
                <span className={styles.labelNum}>{seq}</span>
                <span className={styles.labelCat}>{category || "Motion Design"}</span>
                <span className={styles.labelYear}>{year}</span>
              </div>

              {/* type clock */}
              <div className={styles.typeClock}>
                <p className={styles.seqLabel}>
                  <em>{seq}</em>{category || "Motion Design"}
                </p>
                <h2 className={styles.wordLead}>{lead}</h2>
                {trail && <p className={styles.wordTrail}>{trail}</p>}
                {description && <p className={styles.copy}>{description}</p>}
                <div className={styles.dataRow}>
                  {year && (
                    <div className={styles.dataStat}>
                      <span className={styles.dataLabel}>Year</span>
                      <span className={styles.dataVal}>{year}</span>
                    </div>
                  )}
                  {category && (
                    <div className={styles.dataStat}>
                      <span className={styles.dataLabel}>Category</span>
                      <span className={styles.dataVal}>{category}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* video */}
              <div className={styles.videoWrap}>
                {media && mediaSrc ? (
                  media.type === "video" ? (
                    <video autoPlay muted loop playsInline preload="metadata" className={styles.videoEl}>
                      <source src={mediaSrc} type={mediaMime} />
                    </video>
                  ) : (
                    <img src={mediaSrc} alt="" className={styles.videoEl} />
                  )
                ) : (
                  <div className={styles.mediaFallback}>Media unavailable</div>
                )}
                <div className={styles.corners} aria-hidden="true" />
                <div className={styles.videoFooter}>
                  <ModalLink className={styles.button} modal="project-page" page={String(pageNumber)}>
                    {buttonText}
                  </ModalLink>
                </div>
              </div>

              {/* caption line */}
              <div className={styles.captionBar}>
                <span className={styles.captionLeft}>{title}{category ? ` - ${category}` : ""}</span>
                <span className={styles.captionRight}>{category || "Motion Design"}</span>
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
