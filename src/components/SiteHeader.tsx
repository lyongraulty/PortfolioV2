"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Container } from "@/components/Container";
import { ModalLink } from "@/components/ModalLink";

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { href: "/#reel", label: "Reel" },
  { href: "/#info", label: "Info" },
  { href: "/#projects", label: "Projects" },
  { href: "/contact", label: "Contact" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/music", label: "Music" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const lastOffset = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) {
      return;
    }

    const updateState = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;
      const hero = document.querySelector<HTMLElement>("#intro");
      const heroBottom = hero ? hero.getBoundingClientRect().bottom : -1;
      const info = document.querySelector<HTMLElement>("#info");
      const infoTop = info ? info.getBoundingClientRect().top : Number.POSITIVE_INFINITY;
      const headerHeight = header.getBoundingClientRect().height || 1;

      header.dataset.backdrop = infoTop <= headerHeight ? "locked" : "hero";

      if (heroBottom > 0) {
        header.dataset.state = "top";
        lastOffset.current = 0;
        header.style.setProperty("--header-translate", "0px");
        lastScrollY.current = currentY;
        return;
      }

      const nextOffset = Math.min(0, Math.max(-headerHeight, lastOffset.current - delta));
      lastOffset.current = nextOffset;
      header.style.setProperty("--header-translate", `${nextOffset}px`);
      header.dataset.state = nextOffset < 0 ? "locked" : "shown";
      lastScrollY.current = currentY;
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        updateState();
        ticking.current = false;
      });
    };

    updateState();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const smoothScrollToId = (id: string) => {
    const target = document.getElementById(id);
    if (!target) {
      return;
    }

    const startY = window.scrollY;
    const targetY = target.getBoundingClientRect().top + window.scrollY;
    const distance = targetY - startY;
    const duration = 500;
    const startTime = performance.now();

    const easeOutCubicBezier = (t: number) => {
      const cx = 0.41;
      const bx = 0.07;
      const cy = 0.16;
      const by = 0.96;

      const sampleCurveX = (u: number) => {
        const v = 1 - u;
        return 3 * v * v * u * cx + 3 * v * u * u * bx + u * u * u;
      };

      const sampleCurveY = (u: number) => {
        const v = 1 - u;
        return 3 * v * v * u * cy + 3 * v * u * u * by + u * u * u;
      };

      let u = t;
      for (let i = 0; i < 5; i += 1) {
        const x = sampleCurveX(u) - t;
        if (Math.abs(x) < 1e-4) break;
        const dx = (sampleCurveX(u + 1e-4) - sampleCurveX(u - 1e-4)) / 2e-4;
        if (Math.abs(dx) < 1e-6) break;
        u -= x / dx;
        u = Math.min(1, Math.max(0, u));
      }

      return sampleCurveY(u);
    };

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubicBezier(progress);
      window.scrollTo({ top: startY + distance * eased, behavior: "auto" });

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    window.requestAnimationFrame(tick);
  };

  const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL ?? "";
  const logoSrc = mediaBase ? `${mediaBase}/site/2019_Logo_BlackRing_NoBG_Large.png` : "";

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header-backdrop" aria-hidden="true" />
      <Container className="site-header-inner">
        {logoSrc ? (
          <Link href="/" className="site-logo" aria-label="Lyon Graulty — home">
            <img src={logoSrc} alt="Lyon Graulty" className="site-logo-img" />
          </Link>
        ) : null}
        <nav aria-label="Primary navigation">
          <ul className="site-nav-list type-nav">
            {navItems.map((item) => {
              if (item.href === "/contact") {
                return (
                  <li key={item.href}>
                    <ModalLink modal="contact">{item.label}</ModalLink>
                  </li>
                );
              }
              if (item.href === "/sandbox") {
                return (
                  <li key={item.href}>
                    <ModalLink modal="sandbox">{item.label}</ModalLink>
                  </li>
                );
              }
              if (item.href === "/music") {
                return (
                  <li key={item.href}>
                    <ModalLink modal="music">{item.label}</ModalLink>
                  </li>
                );
              }
              if (item.href.startsWith("/#")) {
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={(event) => {
                        if (pathname !== "/") {
                          return;
                        }
                        event.preventDefault();
                        const id = item.href.replace("/#", "");
                        window.history.pushState(null, "", item.href);
                        smoothScrollToId(id);
                      }}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              }

              return (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Container>
    </header>
  );
}
