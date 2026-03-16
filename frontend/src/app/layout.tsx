/**
 * app/layout.tsx — Root layout for JengoRoute dashboard.
 *
 * Responsive shell:
 *   Desktop (md+): Sidebar (left) + scrollable main content (right).
 *   Mobile  (<md): Fixed top bar + full-width scrollable content.
 *
 * Loads Leaflet CSS globally and wraps all pages.
 */

import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';

export const metadata: Metadata = {
  title: 'JengoRoute — Security Operations',
  description:
    'WhatsApp-native security operations dashboard for supervisors.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS — required for map rendering */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          {/*
            On mobile the sidebar becomes a fixed top bar (h-[57px]),
            so we add top padding to push content below it.
            On desktop the sidebar is a flex sibling so no padding needed.
          */}
          <main className="flex-1 overflow-y-auto pt-[57px] md:pt-0">
            <div className="max-w-[1400px] mx-auto px-4 py-4 md:px-6 md:py-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
