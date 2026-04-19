import type { Metadata } from "next";
import { Archivo_Black, Montserrat, PT_Mono } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { OverlayController } from "@/components/OverlayController";
import { SectionHoverObserver } from "@/components/SectionHoverObserver";
import { getFontList, getTokens } from "../../fetch/getTokens";
import "./globals.css";

const ptMono = PT_Mono({
  variable: "--font-pt-mono",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Minimal portfolio scaffold with dynamic project pages.",
};
export const dynamic = "force-dynamic";

function toCssVarName(key: string): string {
  const normalized = (key.startsWith("--") ? key.slice(2) : key)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized;
}

function toGoogleFontsHref(fontFamily: string): string {
  const family = encodeURIComponent(fontFamily.trim()).replace(/%20/g, "+");
  return `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [tokens, fontList] = await Promise.all([getTokens(), getFontList()]);

  const cssVars = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => {
      if (value === null || value === undefined || typeof value === "object") {
        return null;
      }

      const normalizedKey = toCssVarName(key);
      if (!normalizedKey) {
        return null;
      }
      return [`--${normalizedKey}`, String(value)] as const;
    })
    .filter((entry): entry is readonly [`--${string}`, string] => entry !== null);

  const cssVarStyle = Object.fromEntries(cssVars) as React.CSSProperties;
  const fontStylesheets = Array.from(new Set(fontList.map(toGoogleFontsHref)));

  return (
    <html
      lang="en"
      className={`${ptMono.variable} ${archivoBlack.variable} ${montserrat.variable}`}
      style={cssVarStyle}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {fontStylesheets.map((href) => (
          <link key={href} rel="stylesheet" href={href} />
        ))}
      </head>
      <body>
        <SiteHeader />
        <SectionHoverObserver />
        <main>{children}</main>
        <OverlayController />
        <SiteFooter />
      </body>
    </html>
  );
}
