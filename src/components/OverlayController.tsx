"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProjectOverlayWindow } from "@/components/ProjectOverlayWindow";
import { ProjectPageOverlayWindow } from "@/components/ProjectPageOverlayWindow";
import { ReelOverlayWindow } from "@/components/ReelOverlayWindow";
import { StaticOverlayWindow } from "@/components/StaticOverlayWindow";
import { ContactOverlayContent } from "@/components/ContactOverlayContent";
import { getWorkBySlug, workItems } from "@/lib/work";

function buildCloseHref(pathname: string, searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams.toString());
  params.delete("modal");
  params.delete("slug");
  params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export function OverlayController() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const modal = searchParams.get("modal");
  const slug = searchParams.get("slug");
  const page = searchParams.get("page");
  const previousOverflow = useRef<string | null>(null);

  const project = useMemo(() => (slug ? getWorkBySlug(slug) : null), [slug]);
  const projectIndex = useMemo(() => {
    if (!project) return null;
    return workItems.findIndex((workItem) => workItem.slug === project.slug) + 2;
  }, [project]);

  const handleClose = () => {
    router.push(buildCloseHref(pathname, searchParams), { scroll: false });
  };

  useEffect(() => {
    if (!modal) {
      if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
        previousOverflow.current = null;
      }
      return;
    }

    if (previousOverflow.current === null) {
      previousOverflow.current = document.body.style.overflow;
    }
    document.body.style.overflow = "hidden";

    return () => {
      if (previousOverflow.current !== null) {
        document.body.style.overflow = previousOverflow.current;
        previousOverflow.current = null;
      }
    };
  }, [modal]);

  if (!modal) {
    return null;
  }

  if (modal === "project") {
    if (!project || projectIndex === null) {
      return null;
    }
    return (
      <ProjectOverlayWindow
        title={project.title}
        description={project.summary}
        index={projectIndex}
        onClose={handleClose}
      />
    );
  }

  if (modal === "reel") {
    return <ReelOverlayWindow onClose={handleClose} />;
  }

  if (modal === "project-page") {
    if (!page) {
      return null;
    }
    return <ProjectPageOverlayWindow pageId={page} onClose={handleClose} />;
  }

  if (modal === "contact") {
    return (
      <StaticOverlayWindow dialogLabel="Let's talk overlay" onClose={handleClose}>
        <ContactOverlayContent />
      </StaticOverlayWindow>
    );
  }

  if (modal === "music") {
    return <StaticOverlayWindow title="Music" onClose={handleClose} />;
  }

  if (modal === "sandbox") {
    return <StaticOverlayWindow title="Sandbox" onClose={handleClose} />;
  }

  return null;
}
