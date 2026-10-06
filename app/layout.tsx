import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/search/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { CapabilitiesProvider } from "@/components/auth/capabilities-provider";
import { PortraitShell } from "@/components/portrait-shell";
import { StandaloneOrientationLock } from "@/components/standalone-orientation-lock";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPlatformSettings } from "@/lib/platform-settings";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

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
      default: `${siteName} - Advanced Learning Platform`,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    manifest: "/manifest.json",
    icons: settings.logo_url
      ? {
          icon: [{ url: settings.logo_url }],
          shortcut: [{ url: settings.logo_url }],
          apple: [{ url: settings.logo_url }],
        }
      : {
          icon: [
            { url: "/favicon.svg", type: "image/svg+xml" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
          ],
          apple: "/apple-touch-icon.png",
        },
    openGraph: {
      images: [
        {
          url: "/brand/rigbu-character-on-light-1024.png",
          width: 1024,
          height: 1024,
          alt: "Rigbu",
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
      className={cn("h-full antialiased font-sans", inter.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CapabilitiesProvider>
            <StandaloneOrientationLock />
            <PortraitShell>
              {children}
              <CommandPalette />
              <Toaster richColors position="top-center" />
            </PortraitShell>
          </CapabilitiesProvider>
        </ThemeProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
