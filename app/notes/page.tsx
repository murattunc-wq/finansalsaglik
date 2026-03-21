'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  Search, Bell, Moon, Sun, Wallet, Calculator, FileEdit, Trash2 
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';

/* ============================================================
   HELPERS
   ============================================================ */
function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function NotesPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  /* ---- Notes State ---- */
  const [notes, setNotes] = useState<string>(() => loadLS('fcv2_daily_notes', ''));

  /* ---- Calculator State ---- */
  const [calcInput, setCalcInput] = useState('0');
  const [calcPrev, setCalcPrev] = useState<string|null>(null);
  const [calcOp, setCalcOp] = useState<string|null>(null);
  const [newNum, setNewNum] = useState(false);

  /* ---- Persist to localStorage ---- */
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('fcv2_daily_notes', JSON.stringify(notes));
    }
  }, [notes, mounted]);

  /* ============================================================
     CALCULATOR LOGIC
     ============================================================ */
  const handleCalcClick = (val: string) => {
    if (/[0-9.]/.test(val)) {
      if (newNum) {
        setCalcInput(val);
        setNewNum(false);
      } else {
        setCalcInput(calcInput === '0' && val !== '.' ? val : calcInput + val);
      }
    } else if (['+', '-', '×', '÷'].includes(val)) {
      if (calcOp && calcPrev && !newNum) {
        const result = evaluate(calcPrev, calcInput, calcOp);
        setCalcInput(String(result));
        setCalcPrev(String(result));
      } else {
        setCalcPrev(calcInput);
      }
      setCalcOp(val);
      setNewNum(true);
    } else if (val === '⌫') {
      if (calcInput.length > 1) {
        setCalcInput(calcInput.slice(0, -1));
      } else {
        setCalcInput('0');
        setNewNum(true);
      }
    } else if (val === '%') {
      const num = parseFloat(calcInput);
      if (!isNaN(num)) setCalcInput(String(num / 100));
    } else if (val === '=') {
      if (calcOp && calcPrev) {
        const result = evaluate(calcPrev, calcInput, calcOp);
        setCalcInput(String(result));
        setCalcPrev(null);
        setCalcOp(null);
        setNewNum(true);
      }
    } else if (val === 'C') {
      setCalcInput('0');
      setCalcPrev(null);
      setCalcOp(null);
      setNewNum(true);
    }
  };

  const evaluate = (a: string, b: string, op: string) => {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (isNaN(numA) || isNaN(numB)) return 0;
    switch (op) {
      case '+': return numA + numB;
      case '-': return numA - numB;
      case '×': return numA * numB;
      case '÷': return numB === 0 ? 0 : numA / numB;
      default: return numB;
    }
  };

  /* ============================================================
     STYLE SHORTCUTS
     ============================================================ */
  const bg      = "min-h-screen bg-[#fafafa] dark:bg-black text-slate-900 dark:text-neutral-50 transition-colors duration-200";
  const navBg   = "bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800";
  const card    = "bg-white dark:bg-[#09090b] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm";
  const muted   = "text-slate-500 dark:text-neutral-400";
  const title   = "text-slate-900 dark:text-neutral-50";
  const isDark  = mounted && theme === 'dark';

  if (!mounted) return null;

  return (
    <div className={bg} onClick={() => { setIsNotificationsOpen(false); setIsProfileOpen(false); }}>
      
      {/* ── NAV ── */}
      <div className={`${navBg} sticky top-0 z-40 border-b border-slate-100 dark:border-neutral-800`}>
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          
          {/* Left: Logo and Search */}
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <Link href="/" className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">
              <span className="text-white dark:text-black text-sm font-bold">₺</span>
            </Link>
            
            {/* Tabs */}
            <div className="hidden sm:flex items-center gap-1 bg-slate-100/50 dark:bg-neutral-900/50 p-1 rounded-lg">
               <Link href="/" className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all">
                 Kokpit
               </Link>
               <Link href="/notes" className="px-3 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-neutral-800">
                 Notlarım
               </Link>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full max-w-[160px] sm:max-w-xs transition-all hidden md:block">
              <Search className={`absolute left-3 top-2.5 h-4 w-4 ${muted}`} />
              <input 
                placeholder="Notlarda ara..." 
                className={`w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-neutral-900 rounded-md text-sm ${title} focus:outline-none border border-transparent focus:border-slate-300 dark:focus:border-neutral-700 transition-colors`} 
              />
            </div>
          </div>

          {/* Right: Theme, Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition-colors`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* Profile dropdown */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen(prev => !prev); setIsNotificationsOpen(false); }}
                className={`flex items-center gap-2 rounded-full sm:rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 p-1 transition-colors outline-none focus:outline-none`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-neutral-700 font-semibold text-sm overflow-hidden shrink-0 shadow-sm`}
                  style={{ background: sessionUser?.image ? 'transparent' : '#e2e8f0' }}>
                  {sessionUser?.image
                    ? <img src={sessionUser.image} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                    : <span className="text-slate-600 dark:text-neutral-300">{(sessionUser?.name || sessionUser?.email || 'U').charAt(0).toUpperCase()}</span>
                  }
                </div>
              </button>
              {isProfileOpen && (
                <div 
                  onClick={e => e.stopPropagation()}
                  className={`absolute right-0 top-full mt-2 w-56 ${card} rounded-xl shadow-xl border border-slate-100 dark:border-neutral-800 overflow-hidden transition-all z-50`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                    <p className={`text-sm font-semibold ${title} truncate`}>{sessionUser?.name || 'Kullanıcı'}</p>
                    <p className={`text-xs ${muted} truncate`}>{sessionUser?.email || ''}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
                  >
                    <Trash2 className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1500px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-6" style={{ minHeight: 'calc(100vh - 70px)' }}>

        {/* Left Area: Not Defteri */}
        <div className={`flex-1 flex flex-col ${card} overflow-hidden shadow-sm`}>
          <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/30">
            <div className="flex items-center gap-2">
              <FileEdit className={`w-5 h-5 text-indigo-500`} />
              <h2 className={`font-semibold ${title}`}>Günlük Hesaplamalar & Notlar</h2>
            </div>
            <span className={`text-xs ${muted}`}>Otomatik Kaydedilir</span>
          </div>
          <div className="flex-1 p-0 relative">
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notlarınızı ve taslak hesaplamalarınızı buraya yazabilirsiniz...&#10;&#10;Örnek:&#10;23 kt mevcut / 9k taksit 5.6.Ay&#10;7k 7.8.9.ay&#10;34 ykb mevcut / 29k 5. / 19k 6.ay&#10;&#10;💰37k vergi borcu var."
              className="absolute inset-0 w-full h-full resize-none p-6 bg-transparent text-slate-800 dark:text-neutral-200 outline-none leading-relaxed text-sm md:text-base font-medium placeholder:text-slate-300 dark:placeholder:text-neutral-700"
              style={{ lineHeight: '1.7' }}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Right Area: Hesap Makinesi */}
        <div className={`w-full lg:w-[320px] shrink-0 ${card} overflow-hidden shadow-sm flex flex-col self-start`}>
          <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center gap-2 bg-slate-50/50 dark:bg-neutral-900/30">
            <Calculator className={`w-5 h-5 text-emerald-500`} />
            <h2 className={`font-semibold ${title}`}>Eşlikçi Hesap Makinesi</h2>
          </div>
          
          <div className="p-5 flex flex-col flex-1">
            {/* Display */}
            <div className="bg-slate-100 dark:bg-[#18181b] rounded-xl p-4 mb-4 flex flex-col justify-end items-end h-24 border border-slate-200 dark:border-neutral-800 shadow-inner">
              <div className="text-xs text-slate-500 dark:text-neutral-400 h-4 mb-1">
                {calcPrev && calcOp ? `${calcPrev} ${calcOp}` : ''}
              </div>
              <div className={`text-3xl font-bold ${title} tracking-tight break-all`}>
                {calcInput}
              </div>
            </div>

            {/* Keypad */}
            <div className="grid grid-cols-4 gap-2 flex-1">
              {['C', '⌫', '%', '÷', 
                '7', '8', '9', '×', 
                '4', '5', '6', '-', 
                '1', '2', '3', '+', 
                '0', '00', '.', '='].map((btn, i) => {
                const isOp = ['÷', '×', '-', '+', '='].includes(btn);
                const isClear = btn === 'C';
                const isAction = ['⌫', '%'].includes(btn);
                
                return (
                  <button
                    key={i}
                    onClick={() => handleCalcClick(btn)}
                    className={`
                      h-12 md:h-14 font-semibold text-lg md:text-xl rounded-lg transition-all focus:outline-none active:scale-95
                      ${isOp ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm' : 
                        isClear ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30' : 
                        isAction ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700' :
                        'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-[#09090b] dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900 shadow-sm'}
                    `}
                  >
                    {btn}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
