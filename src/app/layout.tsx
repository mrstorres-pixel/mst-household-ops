import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "MST Household",
  description: "Operations system for MST Household merchandising goods."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script
        id="theme-init"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (() => {
              try {
                const stored = localStorage.getItem("mst-theme");
                const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                document.documentElement.dataset.theme = stored || system;
              } catch {
                document.documentElement.dataset.theme = "light";
              }
            })();
          `
        }}
      />
      <body>{children}</body>
    </html>
  );
}
