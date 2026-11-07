import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import PwaRegister from "@/components/PwaRegister";

// Self-hosted at build time by next/font: no request to Google from the browser.
const serif = Fraunces({ subsets: ["latin"], variable: "--font-serif", display: "swap", style: ["normal", "italic"] });
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Class Hub — S3 EARTH CSE",
  description: "Your organised class library with watch tracking.",
  applicationName: "Class Hub",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Class Hub",
    statusBarStyle: "black-translucent",
  },
  other: {
    // Next emits `mobile-web-app-capable`; older iOS still looks for this one.
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0a10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
