// src/app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import BrandLoader from '../components/BrandLoader';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Fleet Flow | PTA Operadores',
  description: 'App de estatus y evidencias para operadores.',
  applicationName: 'Fleet Flow',
  manifest: '/site.webmanifest', // opcional si usas PWA
  other: {
    'format-detection': 'telephone=no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0f172a', // <- movido aquí para eliminar el warning
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          'antialiased',
          'min-h-screen',
          'bg-white',
          'text-slate-900',
          'overflow-x-hidden',
        ].join(' ')}
      >
        <BrandLoader />
        <main className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
