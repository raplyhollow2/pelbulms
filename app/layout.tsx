import type { Metadata } from "next";
import "./globals.css";
import { CommandPalette } from "@/components/search/command-palette";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { CapabilitiesProvider } from "@/components/auth/capabilities-provider";
// import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPlatformSettings } from "@/lib/platform-settings";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPlatformSettings()
  const siteName = settings.site_name || 'Pelbu LMS'
  const description =
    settings.tagline ||
    settings.landing_description ||
    'Empowering education in Bhutan with modern learning management'

  return {
    title: {
      default: `${siteName} - Advanced Learning Platform`,
      template: `%s · ${siteName}`,
    },
    description,
    applicationName: siteName,
    manifest: "/manifest.json",
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon.svg", sizes: "any" },
      ],
      shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-icon" }],
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
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={cn("h-full antialiased", "font-sans", inter.variable)}
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <CapabilitiesProvider>
            {children}
            <CommandPalette />
            <Toaster richColors position="top-center" />
          </CapabilitiesProvider>
        </ThemeProvider>
        {/* <ServiceWorkerRegistration /> */}
      </body>
    </html>
  );
}
