import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/ui/command-palette";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "Pelbu LMS - Advanced Learning Platform",
  description: "Empowering education in Bhutan with modern learning management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pelbu LMS",
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFC72C",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CommandPalette />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
