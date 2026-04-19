"use client";

import { useEffect, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

type ProjectOverlayWindowProps = {
  title: string;
  description: string;
  index: number;
  onClose?: () => void;
};

function formatIndex(index: number) {
  return String(index).padStart(2, "0");
}

function closeToPreviousOrHome(router: ReturnType<typeof useRouter>) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

export function ProjectOverlayWindow({ title, description, index, onClose }: ProjectOverlayWindowProps) {
  const router = useRouter();
  const handleClose = onClose ?? (() => closeToPreviousOrHome(router));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="window-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={handleBackdropClick}>
      <div className="window-panel">
        <button type="button" className="window-close type-button" onClick={handleClose} aria-label="Close project" />
        <p className="reel-label type-overline">PROJECT</p>
        <h1>{title}</h1>
        <p className="reel-index type-overline">{formatIndex(index)}.</p>
        <p className="reel-divider type-overline">-</p>
        <p className="reel-description type-caption">{description}</p>
      </div>
    </div>
  );
}
