"use client";

import { useCallback, useEffect, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type StaticOverlayWindowProps = {
  title?: string;
  dialogLabel?: string;
  onClose?: () => void;
  children?: ReactNode;
};

function closeToPreviousOrHome(router: ReturnType<typeof useRouter>) {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/");
  }
}

export function StaticOverlayWindow({ title, dialogLabel, onClose, children }: StaticOverlayWindowProps) {
  const router = useRouter();
  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    closeToPreviousOrHome(router);
  }, [onClose, router]);
  const ariaLabel = dialogLabel ?? (title ? `${title} overlay` : "Modal overlay");

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
    <div className="window-overlay" role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={handleBackdropClick}>
      <div className="window-panel">
        <button type="button" className="window-close" aria-label="Close modal" onClick={handleClose} />
        {title ? <h2>{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
