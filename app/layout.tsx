import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Inter, the typeface OuterSignal uses, self-hosted so no request goes to a third-party font CDN.
import "@fontsource-variable/inter/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prospect Brief",
  description:
    "Scan Shopify stores for their marketing stack, rank their fit for OuterSignal, and write a fact-checked call-prep brief.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
