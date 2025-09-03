'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage('✅ Revisa tu correo para continuar con el acceso.');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-2xl font-bold text-[#001F3F]">Acceso Seguro</h1>
        <p className="text-gray-600">Ingresa tu correo para recibir un enlace de acceso</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full border border-gray-300 rounded-lg p-2"
          />
          <button
            type="submit"
            className="w-full bg-[#FFB400] text-black px-4 py-2 rounded-lg font-semibold hover:bg-[#e0a200]"
          >
            Enviar enlace mágico
          </button>
        </form>

        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>
    </main>
  );
}
