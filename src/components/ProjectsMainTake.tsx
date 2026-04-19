import { ModalLink } from "@/components/ModalLink";
import { getVideoMimeType, toRenderableMediaUrl } from "@/lib/mediaUrl";
import { getCardMediaFromBackground, getPageButtonText, getPageProjectCopy, getPageTitle, toPageNumber, REEL_PAGE_ID } from "@/lib/pageData";
import { getPages, type PageRow } from "../../fetch/getPages";
import styles from "@/components/ProjectsMainTake.module.css";

function isRenderableProjectPage(page: PageRow): boolean {
  const title = getPageTitle(page);
  const copy = getPageProjectCopy(page);
  const media = getCardMediaFromBackground(page);
  return !!(title || copy || media);
}

function formatIndex(index: number): string {
  return String(index).padStart(2, "0");
}

export async function ProjectsMainTake() {
  const pages = await getPages();
  const projectPages = pages
    .filter((page) => {
      const pageNumber = toPageNumber(page.page);
      return pageNumber !== null && pageNumber > REEL_PAGE_ID;
    })
    .sort((a, b) => (toPageNumber(a.page) ?? Number.MAX_SAFE_INTEGER) - (toPageNumber(b.page) ?? Number.MAX_SAFE_INTEGER))
    .filter(isRenderableProjectPage);

  return (
    <div className={styles.page}>
      <section className={styles.intro}>
        <p>Project Selection - Main Page Take</p>
        <h1>
          Projects Stack
          <br />
          to Split Modal
        </h1>
      </section>

      <div className={styles.systemRow}>
        <p>{projectPages.length} live project pages loaded</p>
        <p>Open any project to preview the split specimen modal</p>
      </div>

      <div className={styles.label}>Selected Projects</div>

      <main className={styles.stack}>
        {projectPages.length === 0 ? (
          <div className={styles.emptyState}>
            <h2>No project pages available</h2>
            <p>Run the local sync and try again so the cards and modal pages can populate.</p>
          </div>
        ) : null}
        {projectPages.map((page, index) => {
          const pageNumber = toPageNumber(page.page) ?? 0;
          const title = getPageTitle(page) || "PROJECT";
          const description = getPageProjectCopy(page) || "Live project loaded from page variables.";
          const buttonText = getPageButtonText(page) || "View Project";
          const media = getCardMediaFromBackground(page);
          const mediaSrc = toRenderableMediaUrl(media?.src);
          const mediaMime = media?.type === "video" ? getVideoMimeType(mediaSrc) : undefined;

          return (
            <article
              key={`take-page-${pageNumber}`}
              className={`${styles.card}${index === 0 ? ` ${styles.firstCard}` : ""}`}
              data-hover-zone="project"
            >
              {media && mediaSrc ? (
                <div className={styles.media} aria-hidden="true">
                  {media.type === "video" ? (
                    <video autoPlay muted loop playsInline preload="metadata">
                      <source src={mediaSrc} type={mediaMime} />
                    </video>
                  ) : (
                    <img src={mediaSrc} alt="" />
                  )}
                </div>
              ) : (
                <div className={styles.mediaFallback} aria-hidden="true">
                  <p>Media unavailable</p>
                </div>
              )}

              <div className={styles.cardContent}>
                <div className={styles.meta}>Project {formatIndex(pageNumber)}</div>
                <h2 className={styles.title}>{title}</h2>
                <p className={styles.description}>{description}</p>
                <ModalLink className={styles.button} modal="project-page" page={String(pageNumber)}>
                  {buttonText}
                </ModalLink>
              </div>
            </article>
          );
        })}
      </main>
    </div>
  );
}
