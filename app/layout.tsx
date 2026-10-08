import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/search/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { CapabilitiesProvider } from "@/components/auth/capabilities-provider";
import { PortraitShell } from "@/components/portrait-shell";
import { StandaloneOrientationLock } from "@/components/standalone-orientation-lock";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPlatformSettings } from "@/lib/platform-settings";

const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings()
  const siteName = settings.site_name || 'Rigbu LMS'
  const description =
    settings.tagline ||
    settings.landing_description ||
    'Empowering education in Bhutan with modern learning management'

  return {
    metadataBase: new URL("https://www.rigbu.app"),
    title: {
      default: "Rigbu — Learn anywhere. Light the way.",
      template: "%s · Rigbu",
    },
    description,
    applicationName: siteName,
    manifest: "/site.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      images: [
        {
          url: "/og-image-1200x630.png",
          width: 1200,
          height: 630,
          alt: "Rigbu — Learn anywhere. Light the way.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [
        {
          url: "/og-image-1200x630.png",
          width: 1200,
          height: 630,
          alt: "Rigbu — Learn anywhere. Light the way.",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteName,
    },
  }
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B2433",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn("h-full antialiased font-sans", plusJakarta.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CapabilitiesProvider>
            <StandaloneOrientationLock />
            <PortraitShell>
              {children}
              <CommandPalette />
              <Toaster richColors position="top-center" />
              <ServiceWorkerRegistration />
            </PortraitShell>
          </CapabilitiesProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
