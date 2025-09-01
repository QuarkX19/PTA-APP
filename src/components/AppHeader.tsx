'use client';
import Image from 'next/image';

export default function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex items-center gap-3 py-4 px-5 border-b border-slate-200 bg-white">
      <Image
        src="/LogoFleetFlow.png" // Asegúrate de ponerlo en /public
        alt="Fleet Flow"
        width={40}
        height={40}
        priority
      />
      <div className="leading-tight">
        <div className="text-2xl font-extrabold tracking-tight text-brand">
          Fleet Flow
        </div>
        {subtitle && (
          <div className="text-sm text-accent uppercase tracking-wide">
            {subtitle}
          </div>
        )}
      </div>
    </header>
  );
}
