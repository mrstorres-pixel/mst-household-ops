import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MST Household",
  description: "Operations system for MST Household merchandising goods."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
