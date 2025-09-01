'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function MagicLoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert('Error al enviar enlace: ' + error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="card p-8 space-y-4 w-full max-w-md">
        <h1 className="text-xl font-semibold text-center">Accede con tu correo</h1>
        {sent ? (
          <p className="text-green-600">✅ Revisa tu correo y da clic en el enlace para entrar.</p>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="input-base w-full"
            />
            <button onClick={handleLogin} className="btn-brand w-full">
              Enviar Magic Link
            </button>
          </>
        )}
      </div>
    </main>
  );
}
