import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/download',
        destination: '/',
        permanent: true,
      },
    ]
  },
  // @react-pdf/renderer must not be bundled; it runs in the Node runtime
  // for server-side certificate PDF generation.
  serverExternalPackages: ['@react-pdf/renderer', 'exceljs'],
  // Safety net for small proxy uploads; large media goes direct to Cloudinary.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
