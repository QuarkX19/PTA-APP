// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Debe ir a NIVEL RAÍZ (no dentro de "experimental")
  // Usa solo hostnames (sin http:// ni puertos)
  allowedDevOrigins: ['192.168.0.7', '192.168.0.3', 'localhost'],
};

export default nextConfig;
