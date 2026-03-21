'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  Search, Moon, Sun, Calculator, FileEdit, Trash2, TrendingDown, TrendingUp, Sparkles
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
   SMART PARSER TYPES & LOGIC
   ============================================================ */
type MonthEntry = { description: string; amount: number; type: 'income' | 'expense' };
type MonthMap = Record<number, MonthEntry[]>; // key = month number (1-12)

const MONTH_NAMES: Record<string, number> = {
  'ocak': 1, 'jan': 1, 'oca': 1,
  'subat': 2, 'şubat': 2, 'feb': 2, 'şub': 2,
  'mart': 3, 'mar': 3,
  'nisan': 4, 'apr': 4, 'nis': 4,
  'mayis': 5, 'mayıs': 5, 'may': 5,
  'haziran': 6, 'jun': 6, 'haz': 6,
  'temmuz': 7, 'jul': 7, 'tem': 7,
  'agustos': 8, 'ağustos': 8, 'aug': 8, 'ağu': 8, 'agu': 8,
  'eylul': 9, 'eylül': 9, 'sep': 9, 'eyl': 9,
  'ekim': 10, 'oct': 10, 'eki': 10,
  'kasim': 11, 'kasım': 11, 'nov': 11, 'kas': 11,
  'aralik': 12, 'aralık': 12, 'dec': 12, 'ara': 12,
};

/** Parse amount strings like "9k", "9.000", "9000", "9.5k" → number */
function parseAmount(str: string): number | null {
  const lower = str.toLowerCase().trim().replace(/\./g, '').replace(/,/g, '.');
  const kMatch = lower.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const plain = parseFloat(lower);
  if (!isNaN(plain) && plain > 0) return plain;
  return null;
}

/** Extract month numbers from strings like "5.6.Ay", "7.8.9.ay", "nisan", "5." */
function extractMonths(str: string): number[] {
  const months: number[] = [];
  const lower = str.toLowerCase().trim();

  // Check month names
  for (const [name, num] of Object.entries(MONTH_NAMES)) {
    if (lower.includes(name)) {
      // Extract multiple names in comma-separated like "temmuz, agustos, eylul"
      const parts = lower.split(/[,;]+/).map(p => p.trim());
      for (const part of parts) {
        for (const [n2, num2] of Object.entries(MONTH_NAMES)) {
          if (part.includes(n2) && !months.includes(num2)) months.push(num2);
        }
      }
      return months;
    }
  }

  // Check numeric patterns like "5.6.ay", "7.8.9.ay", "5."
  const numericAy = lower.match(/(\d+)(?:\.(\d+))*\.?(?:ay)?/g);
  if (numericAy) {
    for (const chunk of numericAy) {
      const nums = chunk.replace(/[^0-9.]/g, '').split('.').filter(Boolean);
      for (const n of nums) {
        const m = parseInt(n, 10);
        if (m >= 1 && m <= 12 && !months.includes(m)) months.push(m);
      }
    }
  }

  return months;
}

/** Determine if a segment keyword references income or expense */
function guessType(text: string): 'income' | 'expense' {
  const lower = text.toLowerCase();
  if (/taksit|borç|borc|gider|ödeme|odeme|aidat|kira/.test(lower)) return 'expense';
  if (/gelir|getiri|kira gelir|maaş|maas/.test(lower)) return 'income';
  return 'expense'; // default for unclassified amounts is expense/payment
}

/**
 * Main parse function
 * Returns a map of month → [entries]
 */
function parseNotes(text: string): MonthMap {
  const result: MonthMap = {};
  const lines = text.split('\n').filter(l => l.trim());

  const addEntry = (month: number, desc: string, amount: number, type: 'income' | 'expense') => {
    if (!result[month]) result[month] = [];
    result[month].push({ description: desc.trim(), amount, type });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // Split by '/' for multi-segment lines like "23 kt mevcut / 9k taksit 5.6.Ay / 7k 7.8.9.ay"
    const segments = line.split('/').map(s => s.trim());

    // The first segment usually names the entity (e.g. "23 kt mevcut", "65k nisan")
    // subsequent segments are month-specific amounts
    const firstName = segments[0];

    // Try to find an entity name (non-numeric prefix)
    const entityMatch = firstName.match(/^(\d+(?:[\.,]\d+)?k?\s+)?(.*?)(\s+\d.*)?$/i);
    const entityLabel = entityMatch?.[2]?.replace(/mevcut|mevcut\s*bakiye/i, '').trim() || firstName.replace(/[\d.,k]+/g, '').trim();
    
    // Handle simple "65k nisan" / "43k mayıs" pattern (single segment lines with month name)
    if (segments.length === 1) {
      // Gather all tokens
      const tokens = line.split(/\s+/);
      let monthsFound: number[] = [];
      let amountFound: number | null = null;
      const labelParts: string[] = [];

      for (const token of tokens) {
        const amt = parseAmount(token);
        if (amt !== null && amountFound === null) {
          amountFound = amt;
          continue;
        }
        const mths = extractMonths(token);
        if (mths.length > 0) {
          monthsFound = [...monthsFound, ...mths].filter((v, i, a) => a.indexOf(v) === i);
          continue;
        }
        labelParts.push(token);
      }

      // Also check comma-separated months in same line ("temmuz, agustos, eylul")
      if (monthsFound.length === 0) {
        monthsFound = extractMonths(line);
      }

      if (amountFound !== null && monthsFound.length > 0) {
        const type = guessType(line);
        for (const m of monthsFound) {
          addEntry(m, labelParts.join(' ') || entityLabel || 'Not', amountFound, type);
        }
      }
      continue;
    }

    // Multi-segment line
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const tokens = seg.split(/\s+/);
      const amounts: number[] = [];
      let segMonths: number[] = [];
      const labelParts: string[] = [];

      for (const token of tokens) {
        const amt = parseAmount(token);
        if (amt !== null) { amounts.push(amt); continue; }
        const mths = extractMonths(token);
        if (mths.length > 0) { segMonths = [...segMonths, ...mths].filter((v, i2, a) => a.indexOf(v) === i2); continue; }
        if (token.toLowerCase() !== 'ay') labelParts.push(token);
      }

      if (amounts.length > 0 && segMonths.length > 0) {
        const desc = entityLabel || labelParts.join(' ') || 'Not';
        const type = guessType(seg + ' ' + firstName);
        for (const amt of amounts) {
          for (const m of segMonths) {
            addEntry(m, desc, amt, type);
          }
        }
      }
    }
  }

  return result;
}

const MONTH_LABELS: Record<number, string> = {
  1: 'Ocak', 2: 'Şubat', 3: 'Mart', 4: 'Nisan', 5: 'Mayıs', 6: 'Haziran',
  7: 'Temmuz', 8: 'Ağustos', 9: 'Eylül', 10: 'Ekim', 11: 'Kasım', 12: 'Aralık'
};

/* ============================================================
   COMPONENT
   ============================================================ */
export default function NotesPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);

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
    if (mounted) localStorage.setItem('fcv2_daily_notes', JSON.stringify(notes));
  }, [notes, mounted]);

  /* ---- Smart Parser ---- */
  const parsedMonths = useMemo(() => parseNotes(notes), [notes]);
  const sortedMonths = Object.keys(parsedMonths)
    .map(Number)
    .sort((a, b) => a - b);

  /* ============================================================
     CALCULATOR LOGIC
     ============================================================ */
  const handleCalcClick = (val: string) => {
    if (/[0-9.]/.test(val)) {
      if (newNum) { setCalcInput(val); setNewNum(false); }
      else setCalcInput(calcInput === '0' && val !== '.' ? val : calcInput + val);
    } else if (['+', '-', '×', '÷'].includes(val)) {
      if (calcOp && calcPrev && !newNum) {
        const result = evaluate(calcPrev, calcInput, calcOp);
        setCalcInput(String(result));
        setCalcPrev(String(result));
      } else { setCalcPrev(calcInput); }
      setCalcOp(val);
      setNewNum(true);
    } else if (val === '⌫') {
      if (calcInput.length > 1) setCalcInput(calcInput.slice(0, -1));
      else { setCalcInput('0'); setNewNum(true); }
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
      case '+': return +(numA + numB).toFixed(4);
      case '-': return +(numA - numB).toFixed(4);
      case '×': return +(numA * numB).toFixed(4);
      case '÷': return numB === 0 ? 0 : +(numA / numB).toFixed(4);
      default: return numB;
    }
  };

  /* ============================================================
     STYLE SHORTCUTS
     ============================================================ */
  const bg    = "min-h-screen bg-[#fafafa] dark:bg-black text-slate-900 dark:text-neutral-50 transition-colors duration-200";
  const navBg = "bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800";
  const card  = "bg-white dark:bg-[#09090b] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm";
  const muted = "text-slate-500 dark:text-neutral-400";
  const ttl   = "text-slate-900 dark:text-neutral-50";
  const isDark = mounted && theme === 'dark';

  if (!mounted) return null;

  return (
    <div className={bg} onClick={() => setIsProfileOpen(false)}>
      
      {/* ── NAV ── */}
      <div className={`${navBg} sticky top-0 z-40`}>
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <Link href="/" className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">
              <span className="text-white dark:text-black text-sm font-bold">₺</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 bg-slate-100/50 dark:bg-neutral-900/50 p-1 rounded-lg">
               <Link href="/" className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all">
                 Kokpit
               </Link>
               <Link href="/notes" className="px-3 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-neutral-800">
                 Notlarım
               </Link>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition-colors`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen(prev => !prev); }}
                className="flex items-center gap-2 rounded-full sm:rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 p-1 transition-colors"
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-neutral-700 font-semibold text-sm overflow-hidden shrink-0 shadow-sm"
                  style={{ background: sessionUser?.image ? 'transparent' : '#e2e8f0' }}>
                  {sessionUser?.image
                    ? <img src={sessionUser.image} alt="avatar" className="w-8 h-8 rounded-full object-cover" />
                    : <span className="text-slate-600">{(sessionUser?.name || 'U').charAt(0).toUpperCase()}</span>}
                </div>
              </button>
              {isProfileOpen && (
                <div onClick={e => e.stopPropagation()} className={`absolute right-0 top-full mt-2 w-56 ${card} rounded-xl shadow-xl z-50 overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                    <p className={`text-sm font-semibold ${ttl} truncate`}>{sessionUser?.name || 'Kullanıcı'}</p>
                    <p className={`text-xs ${muted} truncate`}>{sessionUser?.email || ''}</p>
                  </div>
                  <button onClick={() => signOut({ callbackUrl: '/login' })} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium">
                    <Trash2 className="w-4 h-4" /> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-[1500px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-6" style={{ minHeight: 'calc(100vh - 70px)' }}>

        {/* Left Area: Main Note + Monthly Breakdown */}
        <div className="flex-1 flex flex-col gap-6 min-w-0">

          {/* Notepad */}
          <div className={`flex flex-col ${card} overflow-hidden`} style={{ minHeight: 340 }}>
            <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/30 shrink-0">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-indigo-500" />
                <h2 className={`font-semibold ${ttl}`}>Günlük Hesaplamalar & Notlar</h2>
              </div>
              <span className={`text-xs ${muted}`}>Otomatik Kaydedilir</span>
            </div>
            <div className="relative flex-1" style={{ minHeight: 280 }}>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Hesaplamalarınızı ve notlarınızı buraya yazın.&#10;&#10;Örnek:&#10;23 kt mevcut / 9k taksit 5.6.Ay / 7k 7.8.9.ay&#10;34 ykb mevcut / 29k 5. / 19k 6.ay&#10;8 vakifbank mevcut / 5k 5.ay&#10;&#10;65k nisan&#10;43k mayis&#10;32k haziran"
                className="absolute inset-0 w-full h-full resize-none p-6 bg-transparent text-slate-800 dark:text-neutral-200 outline-none leading-relaxed text-sm md:text-[15px] font-mono placeholder:text-slate-300 dark:placeholder:text-neutral-700"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Smart Monthly Breakdown */}
          {sortedMonths.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              <div className="p-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/30 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h2 className={`font-semibold ${ttl}`}>Akıllı Aylık Özet</h2>
                <span className={`ml-auto text-xs ${muted} font-mono`}>Notlarınızdan otomatik analiz edildi</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-neutral-800">
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide ${muted}`}>Ay</th>
                      <th className={`px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide ${muted}`}>Açıklama</th>
                      <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted}`}>Tutar</th>
                      <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted}`}>Aylık Toplam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMonths.map(month => {
                      const entries = parsedMonths[month];
                      const total = entries.reduce((s, e) => s + (e.type === 'income' ? e.amount : -e.amount), 0);
                      return entries.map((entry, i) => (
                        <tr key={`${month}-${i}`} className={`border-b border-slate-50 dark:border-neutral-900 hover:bg-slate-50/40 dark:hover:bg-neutral-900/30 transition-colors`}>
                          {i === 0 && (
                            <td rowSpan={entries.length} className="px-5 py-3 align-top">
                              <span className={`inline-flex items-center justify-center w-16 text-xs font-bold py-1 rounded-full ${
                                total >= 0 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
                              }`}>
                                {MONTH_LABELS[month] || `Ay ${month}`}
                              </span>
                            </td>
                          )}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {entry.type === 'income' 
                                ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                : <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0" />}
                              <span className={`text-sm ${ttl}`}>{entry.description || 'Not'}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-sm font-medium ${entry.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {entry.type === 'expense' ? '-' : '+'}₺{entry.amount.toLocaleString('tr-TR')}
                            </span>
                          </td>
                          {i === 0 && (
                            <td rowSpan={entries.length} className="px-5 py-3 text-right align-middle">
                              <span className={`text-base font-bold ${total >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {total >= 0 ? '+' : ''}₺{Math.abs(total).toLocaleString('tr-TR')}
                              </span>
                            </td>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Area: Hesap Makinesi */}
        <div className={`w-full lg:w-[300px] xl:w-[320px] shrink-0 flex flex-col gap-4`}>
          <div className={`${card} overflow-hidden flex flex-col`}>
            <div className="p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center gap-2 bg-slate-50/50 dark:bg-neutral-900/30">
              <Calculator className="w-5 h-5 text-emerald-500" />
              <h2 className={`font-semibold ${ttl}`}>Hesap Makinesi</h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {/* Display */}
              <div className="bg-slate-100 dark:bg-[#18181b] rounded-xl p-4 flex flex-col justify-end items-end h-20 border border-slate-200 dark:border-neutral-800">
                <div className={`text-xs ${muted} h-4 mb-1`}>
                  {calcPrev && calcOp ? `${calcPrev} ${calcOp}` : ''}
                </div>
                <div className={`text-3xl font-bold ${ttl} tracking-tight break-all`}>
                  {parseFloat(calcInput) > 999 
                    ? parseFloat(calcInput).toLocaleString('tr-TR', { maximumFractionDigits: 4 })
                    : calcInput}
                </div>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-4 gap-1.5">
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
                        h-12 font-semibold text-lg rounded-lg transition-all active:scale-95 select-none
                        ${isOp ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 
                          isClear ? 'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30' : 
                          isAction ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700' :
                          'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-[#09090b] dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900'}
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
    </div>
  );
}
