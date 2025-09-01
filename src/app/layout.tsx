// src/app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';
import BrandLoader from '@/components/BrandLoader';

export const metadata: Metadata = {
  title: 'PTA Operadores',
  description: 'Registro de estatus y evidencias',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-slate-50 text-slate-900">
        {/* Carga colores/branding desde Supabase en el cliente */}
        <BrandLoader />

        <div className="min-h-dvh flex flex-col">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
              <Link
                href="/"
                className="font-semibold tracking-wide"
                style={{ color: 'var(--brand-navy)' }}
              >
                PTA-APP
              </Link>
              <nav className="text-sm">
                <Link href="/admin" className="px-3 py-1 rounded hover:bg-slate-100">
                  Admin
                </Link>
              </nav>
            </div>
          </header>

          <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>

          <footer className="border-t bg-white">
            <div className="max-w-6xl mx-auto px-4 py-3 text-xs text-slate-500">
              © {new Date().getFullYear()} PTA-APP
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

