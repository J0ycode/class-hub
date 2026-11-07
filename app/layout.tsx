import "./globals.css";
import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/PwaRegister";

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
  themeColor: "#070b16",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
