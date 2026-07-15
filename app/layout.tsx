import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/search/command-palette";
// import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
      className={cn("h-full antialiased", "font-sans", inter.variable)}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <CommandPalette />
        {/* <ServiceWorkerRegistration /> */}
      </body>
    </html>
  );
}
