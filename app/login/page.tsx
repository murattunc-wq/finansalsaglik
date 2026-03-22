'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/components/LanguageProvider';

export default function LoginPage() {
  const router = useRouter();
  const { t, locale, setLocale } = useLanguage();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (res?.error) { setError(t('E-posta veya şifre hatalı.')); return; }
    router.push('/');
  };

  const handleGoogle = async () => {
    await signIn('google', { callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center p-4 relative">
      
      {/* Language Toggle */}
      <div className="absolute top-6 right-6 flex items-center gap-1 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-lg p-1 shadow-sm z-10 text-sm font-semibold">
        <button onClick={() => setLocale('tr')} className={`px-2 py-1 rounded transition-colors ${locale === 'tr' ? 'bg-slate-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`}>TR</button>
        <button onClick={() => setLocale('en')} className={`px-2 py-1 rounded transition-colors ${locale === 'en' ? 'bg-slate-100 dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-neutral-800/50'}`}>EN</button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#0f0f10] rounded-2xl shadow-xl border border-slate-100 dark:border-neutral-800 p-8">
        
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center mx-auto mb-4">
            <span className="text-white dark:text-black text-xl font-bold">₺</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('Finansal Kokpit')}</h1>
          <p className="text-slate-500 dark:text-neutral-400 text-sm mt-1">{t('Hesabınıza giriş yapın')}</p>
        </div>

        {/* Google Button */}
        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-800/60 transition-colors font-medium text-slate-700 dark:text-neutral-300 mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t('Google ile Giriş Yap')}
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-neutral-800"/></div>
          <div className="relative flex justify-center"><span className="px-3 bg-white dark:bg-[#0f0f10] text-xs text-slate-400">{t('veya')}</span></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleCredentials} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">{t('E-posta')}</label>
            <input
              type="email" required value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="ornek@email.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-neutral-300 mb-1.5">{t('Şifre')}</label>
            <input
              type="password" required value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-white text-sm"
            />
          </div>

          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? t('Giriş yapılıyor...') : t('Giriş Yap')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 dark:text-neutral-400 mt-6">
          {t('Hesabınız yok mu?')} <a href="/register" className="text-slate-900 dark:text-white font-semibold hover:underline">{t('Kayıt Ol')}</a>
        </p>
      </div>
    </div>
  );
}
