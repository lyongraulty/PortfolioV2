"use client";

import { useEffect, useRef } from "react";

export function SectionHoverObserver() {
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activeSection = useRef<HTMLElement | null>(null);
  const ticking = useRef(false);
  const reelHover = useRef(false);

  useEffect(() => {
    const updateHover = () => {
      if (reelHover.current) {
        return;
      }

      if (!lastPoint.current) {
        return;
      }

      const { x, y } = lastPoint.current;
      if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
        if (activeSection.current) {
          activeSection.current.removeAttribute("data-hover");
          activeSection.current = null;
        }
        return;
      }

      const reel = document.querySelector<HTMLElement>("#reel");
      if (reel) {
        const rect = reel.getBoundingClientRect();
        const isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        if (isInside) {
          if (activeSection.current && activeSection.current !== reel) {
            activeSection.current.removeAttribute("data-hover");
          }
          reel.setAttribute("data-hover", "true");
          activeSection.current = reel;
          return;
        }
      }

      const zones = Array.from(document.querySelectorAll<HTMLElement>("[data-hover-zone='project']"));
      const zone =
        zones.find((item) => {
          const rect = item.getBoundingClientRect();
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        }) ?? null;

      if (zone === activeSection.current) {
        return;
      }

      if (activeSection.current) {
        activeSection.current.removeAttribute("data-hover");
      }
      if (zone) {
        zone.setAttribute("data-hover", "true");
      }
      activeSection.current = zone;
    };

    const requestUpdate = () => {
      if (ticking.current) {
        return;
      }
      ticking.current = true;
      window.requestAnimationFrame(() => {
        updateHover();
        ticking.current = false;
      });
    };

    const getZoneFromElement = (element: HTMLElement | null) =>
      element?.closest<HTMLElement>("[data-hover-zone='project'], [data-hover-zone='reel'], #reel") ?? null;

    const onPointerMove = (event: PointerEvent | MouseEvent) => {
      lastPoint.current = { x: event.clientX, y: event.clientY };
      requestUpdate();
    };

    const onPointerEnter = (event: PointerEvent | MouseEvent) => {
      lastPoint.current = { x: event.clientX, y: event.clientY };
      requestUpdate();
    };

    const onPointerOver = (event: PointerEvent) => {
      const zone = getZoneFromElement(event.target as HTMLElement | null);
      if (zone && zone !== activeSection.current) {
        if (activeSection.current) {
          activeSection.current.removeAttribute("data-hover");
        }
        zone.setAttribute("data-hover", "true");
        activeSection.current = zone;
      }
    };

    const onPointerOut = (event: PointerEvent) => {
      const fromZone = getZoneFromElement(event.target as HTMLElement | null);
      const toZone = getZoneFromElement(event.relatedTarget as HTMLElement | null);
      if (fromZone && fromZone === activeSection.current && fromZone !== toZone) {
        fromZone.removeAttribute("data-hover");
        activeSection.current = null;
      }
    };

    const onPointerLeave = () => {
      lastPoint.current = null;
      if (activeSection.current) {
        activeSection.current.removeAttribute("data-hover");
        activeSection.current = null;
      }
    };

    const onScroll = () => {
      requestUpdate();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onPointerMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("pointerenter", onPointerEnter);
    document.addEventListener("pointerover", onPointerOver);
    document.addEventListener("pointerout", onPointerOut);

    const reelZone = document.querySelector<HTMLElement>("#reel");
    const onReelEnter = (event: PointerEvent) => {
      lastPoint.current = { x: event.clientX, y: event.clientY };
      reelHover.current = true;
      if (activeSection.current && activeSection.current !== reelZone) {
        activeSection.current.removeAttribute("data-hover");
      }
      reelZone?.setAttribute("data-hover", "true");
      activeSection.current = reelZone ?? null;
    };
    const onReelLeave = () => {
      reelHover.current = false;
      if (reelZone && activeSection.current === reelZone) {
        reelZone.removeAttribute("data-hover");
        activeSection.current = null;
      }
    };
    reelZone?.addEventListener("pointerenter", onReelEnter);
    reelZone?.addEventListener("pointerleave", onReelLeave);

    let reelObserver: IntersectionObserver | null = null;
    if (reelZone) {
      reelObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          if (!lastPoint.current) return;
          if (reelHover.current) return;
          const { x, y } = lastPoint.current;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return;
          const rect = reelZone.getBoundingClientRect();
          const isInside = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
          if (isInside && !reelZone.hasAttribute("data-hover")) {
            if (activeSection.current && activeSection.current !== reelZone) {
              activeSection.current.removeAttribute("data-hover");
            }
            reelZone.setAttribute("data-hover", "true");
            activeSection.current = reelZone;
          } else if (!isInside && activeSection.current === reelZone && !reelHover.current) {
            reelZone.removeAttribute("data-hover");
            activeSection.current = null;
          }
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1] }
      );
      reelObserver.observe(reelZone);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("pointerenter", onPointerEnter);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("pointerout", onPointerOut);
      reelZone?.removeEventListener("pointerenter", onReelEnter);
      reelZone?.removeEventListener("pointerleave", onReelLeave);
      reelObserver?.disconnect();
    };
  }, []);

  return null;
}
