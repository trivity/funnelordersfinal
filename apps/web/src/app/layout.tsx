import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'FunnelOrders — Centralized Order Routing',
  description: 'Connect your funnels to your fulfillment platforms in minutes. Route orders from ClickFunnels, GoHighLevel, Kartra and more to WooCommerce and Shopify automatically.',
  metadataBase: new URL('https://funnelorders.com'),
  openGraph: {
    type: 'website',
    url: 'https://funnelorders.com',
    siteName: 'FunnelOrders',
    title: 'FunnelOrders — Centralized Order Routing',
    description: 'Connect your funnels to your fulfillment platforms in minutes. Route orders from ClickFunnels, GoHighLevel, Kartra and more to WooCommerce and Shopify automatically.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1280,
        height: 720,
        alt: 'FunnelOrders — Centralized Order Routing',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FunnelOrders — Centralized Order Routing',
    description: 'Connect your funnels to your fulfillment platforms in minutes.',
    images: ['/og-image.jpg'],
  },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
