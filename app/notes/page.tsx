'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Moon, Sun, Calculator, FileEdit, Trash2, TrendingDown, TrendingUp, Sparkles, Info } from 'lucide-react';
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
   PARSER
   ============================================================ */
const NOW_MONTH = new Date().getMonth() + 1;

const MONTH_NAME_MAP: Record<string, number> = {
  'ocak':1,'oca':1,'jan':1,
  'subat':2,'şubat':2,'sub':2,'şub':2,'feb':2,
  'mart':3,'mar':3,
  'nisan':4,'nis':4,'apr':4,
  'mayis':5,'mayıs':5,'may':5,
  'haziran':6,'haz':6,'jun':6,
  'temmuz':7,'tem':7,'jul':7,
  'agustos':8,'ağustos':8,'agu':8,'ağu':8,'aug':8,
  'eylul':9,'eylül':9,'eyl':9,'sep':9,
  'ekim':10,'eki':10,'oct':10,
  'kasim':11,'kasım':11,'kas':11,'nov':11,
  'aralik':12,'aralık':12,'ara':12,'dec':12,
};

const MONTH_LABEL: Record<number, string> = {
  1:'Ocak',2:'Şubat',3:'Mart',4:'Nisan',5:'Mayıs',6:'Haziran',
  7:'Temmuz',8:'Ağustos',9:'Eylül',10:'Ekim',11:'Kasım',12:'Aralık'
};

type ParsedEntry = { month: number; label: string; amount: number; type: 'income'|'expense' };

/** Parse "9k", "23k", "9.000" → TL amount */
function parseAmt(str: string): number | null {
  const s = str.trim().toLowerCase().replace(',','.');
  const kMatch = s.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return parseFloat(kMatch[1]) * 1000;
  const plain = parseFloat(s);
  if (!isNaN(plain) && plain > 0) return plain;
  return null;
}

/** Detect if a word is a month name, returns month number or null */
function wordToMonth(word: string): number | null {
  const lower = word.toLowerCase().replace(/[^a-zşğıüöç]/gi,'');
  return MONTH_NAME_MAP[lower] ?? null;
}

/** Extract month numbers from a segment like "5.6.Ay", "7.8.9.ay", "nisan" */
function findMonths(text: string): number[] {
  const lower = text.toLowerCase();
  const found: number[] = [];

  // Named months first (longest match first to avoid "mar" matching inside "mart" etc.)
  const sortedKeys = Object.keys(MONTH_NAME_MAP).sort((a,b) => b.length - a.length);
  for (const name of sortedKeys) {
    if (lower.includes(name) && !found.includes(MONTH_NAME_MAP[name])) {
      found.push(MONTH_NAME_MAP[name]);
    }
  }
  if (found.length > 0) return found;

  // "mevcut" = current month
  if (/mevcut/.test(lower)) return [NOW_MONTH];

  // Numeric: "5.6.ay", "7.8.9.ay", "5.", "5"
  const numericPattern = /\b(\d+(?:\.\d+)*)\s*\.?\s*(?:ay)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = numericPattern.exec(lower)) !== null) {
    const parts = m[1].split('.').filter(Boolean);
    for (const p of parts) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= 12 && !found.includes(n)) found.push(n);
    }
  }
  return found;
}

function guessType(text: string): 'income'|'expense' {
  const l = text.toLowerCase();
  if (/gelir|getiri|maaş|maas|kira\s*gelir|faiz|nakit\s*gir/.test(l)) return 'income';
  return 'expense';
}

/**
 * Main parser — returns flat list of entries with month, label, amount, type
 */
function parseNotes(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = text.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;

    const lower = line.toLowerCase();

    /* ── CASE 1: Calculation line "MONTH? X + Y = Z"
       Treats the RESULT (Z) as income for that month.
       e.g. "mart 35kalan + 7k nakit = 42k" → Mart +42k income
    ─────────────────────────────────────────────────────── */
    const calcMatch = line.match(/^([a-zşğıüöçA-ZŞĞIÜÖÇı]+\s+)?[\d.,]+k?\s*\+\s*[\d.,]+k?\s*=\s*([\d.,]+k?)/i);
    if (calcMatch) {
      const resultStr = calcMatch[2];
      const resultAmt = parseAmt(resultStr.trim());
      if (resultAmt !== null) {
        // Detect month prefix
        let month = NOW_MONTH;
        if (calcMatch[1]) {
          const m = wordToMonth(calcMatch[1].trim());
          if (m) month = m;
        }
        const label = 'Nakit / Mevcut';
        entries.push({ month, label, amount: resultAmt, type: 'income' });
      }
      continue;
    }

    /* ── CASE 2: Month-prefixed line "MONTHNAME AMOUNT description"
       e.g. "mart 37k vergi, emlak ve ito borcu"
       e.g. "💰mart 37k vergi"
    ─────────────────────────────────────────────────────── */
    // Strip emoji / symbols
    const cleanLine = line.replace(/[💰🎯✓✗→]/g, '').trim();
    
    // Try to match: optional-month AMOUNT rest-of-line (no '/' separator, no 'mevcut')
    const monthPrefixMatch = cleanLine.match(/^([a-zşğıüöçA-ZŞĞIÜÖÇı]+)\s+([\d.,]+k?)\s*(.*)$/i);
    if (monthPrefixMatch) {
      const possibleMonth = wordToMonth(monthPrefixMatch[1]);
      if (possibleMonth !== null) {
        const amt = parseAmt(monthPrefixMatch[2]);
        if (amt !== null) {
          const desc = monthPrefixMatch[3].trim() || monthPrefixMatch[1];
          const type = guessType(desc || cleanLine);
          entries.push({ month: possibleMonth, label: desc || monthPrefixMatch[1], amount: amt, type });
          continue;
        }
      }
    }

    /* ── CASE 3: Multi-segment line with '/'
       e.g. "23k kt mevcut / 9k taksit 5.6.Ay / 7k 7.8.9.ay"
    ─────────────────────────────────────────────────────── */
    if (line.includes('/')) {
      const parts = line.split('/').map(p => p.trim()).filter(Boolean);
      const firstPart = parts[0];

      // Build entity label from the first part
      const entityLabel = firstPart
        .replace(/\d+(?:\.\d+)?k?/gi, '')
        .replace(/mevcut|bakiye/gi, '')
        .replace(/[💰🎯]/g, '')
        .trim().replace(/\s+/g, ' ') || 'Not';

      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        // Find amounts
        const amtMatches = seg.match(/\d+(?:\.\d+)?k?/gi) ?? [];
        const amounts = amtMatches.map(t => parseAmt(t)).filter((a): a is number => a !== null);
        if (amounts.length === 0) continue;

        // Find months
        let months: number[] = [];
        if (i === 0 && /mevcut/.test(seg.toLowerCase())) {
          months = [NOW_MONTH];
        } else {
          months = findMonths(seg);
        }
        if (months.length === 0) continue;

        const type = guessType(seg + ' ' + firstPart);
        for (const amt of amounts.slice(0,1)) {
          for (const m of months) {
            entries.push({ month: m, label: entityLabel, amount: amt, type });
          }
        }
      }
      continue;
    }

    /* ── CASE 4: Simple "AMOUNT MONTHNAME" or "MONTHNAME AMOUNT"
       Already covered by CASE 2 — but catch remaining patterns
       e.g. standalone "65k nisan" (if no month prefix match before)
    ─────────────────────────────────────────────────────── */
    // Extract all amounts
    const amtTokens = (cleanLine.match(/\d+(?:\.\d+)?k?/gi) ?? []).map(t => parseAmt(t)).filter((a): a is number => a !== null);
    const months = findMonths(cleanLine);
    if (amtTokens.length > 0 && months.length > 0) {
      const restLabel = cleanLine.replace(/\d+(?:\.\d+)?k?/gi, '').replace(/[a-zşğıüöçA-ZŞĞIÜÖÇı]+/g, w => {
        return wordToMonth(w) ? '' : w;
      }).trim().replace(/\s+/g, ' ') || 'Not';
      const type = guessType(cleanLine);
      for (const m of months) {
        entries.push({ month: m, label: restLabel || 'Not', amount: amtTokens[0], type });
      }
    }
  }

  return entries;
}

/* ============================================================
   DEMO NOTES
   ============================================================ */
const DEMO_NOTES = `23k kt mevcut / 9k taksit 5.6.Ay / 7k 7.8.9.ay
34k ykb mevcut / 29k 5. / 19k 6.ay
8k vakifbank mevcut / 5k 5.ay

mart 37k vergi, emlak ve ito borcu

mart 35k kalan + 7k nakit = 42k`.trim();

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
  const [notes, setNotes] = useState<string>(() => loadLS('fcv2_daily_notes', ''));

  /* ---- Calculator ---- */
  const [calcInput, setCalcInput] = useState('0');
  const [calcPrev, setCalcPrev] = useState<string|null>(null);
  const [calcOp, setCalcOp] = useState<string|null>(null);
  const [newNum, setNewNum] = useState(false);

  useEffect(() => {
    if (mounted) localStorage.setItem('fcv2_daily_notes', JSON.stringify(notes));
  }, [notes, mounted]);

  /* ---- Parse ---- */
  const allEntries = useMemo(() => parseNotes(notes), [notes]);

  const byMonth = useMemo(() => {
    const map: Record<number, ParsedEntry[]> = {};
    for (const e of allEntries) {
      if (!map[e.month]) map[e.month] = [];
      map[e.month].push(e);
    }
    return map;
  }, [allEntries]);

  const sortedMonths = Object.keys(byMonth).map(Number).sort((a,b) => a-b);

  /* ---- Calculator ---- */
  const evaluate = (a: string, b: string, op: string): number => {
    const A = parseFloat(a), B = parseFloat(b);
    if (isNaN(A)||isNaN(B)) return 0;
    switch(op) {
      case '+': return +(A+B).toFixed(4);
      case '-': return +(A-B).toFixed(4);
      case '×': return +(A*B).toFixed(4);
      case '÷': return B===0?0:+(A/B).toFixed(4);
      default: return B;
    }
  };

  const handleCalcClick = (val: string) => {
    if (/[0-9.]/.test(val)) {
      if (newNum) { setCalcInput(val); setNewNum(false); }
      else setCalcInput(calcInput==='0'&&val!=='.'?val:calcInput+val);
    } else if (['+','-','×','÷'].includes(val)) {
      if (calcOp && calcPrev && !newNum) {
        const r = evaluate(calcPrev,calcInput,calcOp); setCalcInput(String(r)); setCalcPrev(String(r));
      } else setCalcPrev(calcInput);
      setCalcOp(val); setNewNum(true);
    } else if (val==='⌫') {
      if (calcInput.length>1) setCalcInput(calcInput.slice(0,-1));
      else { setCalcInput('0'); setNewNum(true); }
    } else if (val==='%') {
      const n = parseFloat(calcInput); if (!isNaN(n)) setCalcInput(String(n/100));
    } else if (val==='=') {
      if (calcOp && calcPrev) {
        const r = evaluate(calcPrev,calcInput,calcOp);
        setCalcInput(String(r)); setCalcPrev(null); setCalcOp(null); setNewNum(true);
      }
    } else if (val==='C') {
      setCalcInput('0'); setCalcPrev(null); setCalcOp(null); setNewNum(true);
    }
  };

  /* ---- Styles ---- */
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
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/" className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shrink-0 hover:opacity-90 transition-opacity">
              <span className="text-white dark:text-black text-sm font-bold">₺</span>
            </Link>
            <div className="hidden sm:flex items-center gap-1 bg-slate-100/50 dark:bg-neutral-900/50 p-1 rounded-lg">
              <Link href="/" className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all">Kokpit</Link>
              <Link href="/notes" className="px-3 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-neutral-800">Notlarım</Link>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setTheme(isDark?'light':'dark')} className={`p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors`}>
              {isDark?<Sun className="w-5 h-5"/>:<Moon className="w-5 h-5"/>}
            </button>
            <div className="relative">
              <button onClick={(e)=>{e.stopPropagation();setIsProfileOpen(p=>!p);}} className="flex p-1 rounded-full sm:rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-neutral-700 text-sm font-semibold" style={{background:sessionUser?.image?'transparent':'#e2e8f0'}}>
                  {sessionUser?.image ? <img src={sessionUser.image} alt="" className="w-8 h-8 rounded-full"/> : <span className="text-slate-600">{(sessionUser?.name||'U').charAt(0).toUpperCase()}</span>}
                </div>
              </button>
              {isProfileOpen && (
                <div onClick={e=>e.stopPropagation()} className={`absolute right-0 top-full mt-2 w-56 ${card} z-50 overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                    <p className={`text-sm font-semibold ${ttl} truncate`}>{sessionUser?.name||'Kullanıcı'}</p>
                    <p className={`text-xs ${muted} truncate`}>{sessionUser?.email||''}</p>
                  </div>
                  <button onClick={()=>signOut({callbackUrl:'/login'})} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium">
                    <Trash2 className="w-4 h-4"/> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-[1500px] mx-auto p-4 md:p-8">

        {/* Help bar */}
        <div className={`mb-5 px-4 py-3 ${card} flex items-start gap-3 text-sm`}>
          <Info className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0"/>
          <div className={`${muted} leading-relaxed`}>
            <b className={ttl}>Desteklenen formatlar: </b>
            <span className="font-mono text-xs bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded mx-1">23k kt mevcut / 9k taksit 5.6.Ay</span>
            <span className="font-mono text-xs bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded mx-1">mart 37k vergi borcu</span>
            <span className="font-mono text-xs bg-slate-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded mx-1">mart 35k + 7k = 42k</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* Left: Notepad + Breakdown */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">

            {/* Notepad */}
            <div className={`${card} flex flex-col overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/30 shrink-0">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-indigo-500"/>
                  <h2 className={`font-semibold text-sm ${ttl}`}>Hesaplama Defteri</h2>
                </div>
                <div className="flex items-center gap-3">
                  {notes.length > 0 && (
                    <button onClick={()=>setNotes('')} className={`text-xs ${muted} hover:text-rose-500 transition-colors`}>Temizle</button>
                  )}
                  {notes === '' && (
                    <button onClick={()=>setNotes(DEMO_NOTES)} className="text-xs font-medium text-indigo-500 hover:text-indigo-700 transition-colors">
                      ✦ Demo Yükle
                    </button>
                  )}
                  <span className={`text-xs ${muted}`}>Otomatik Kaydedilir</span>
                </div>
              </div>
              <textarea
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                placeholder={`Borç ve ödeme notlarınızı buraya yazın…\n\nÖrnek:\n23k kt mevcut / 9k taksit 5.6.Ay / 7k 7.8.9.ay\n34k ykb mevcut / 29k 5. / 19k 6.ay\n\nmart 37k vergi, emlak ve ito borcu\nmart 35k kalan + 7k nakit = 42k`}
                className="w-full resize-none p-5 bg-transparent text-slate-800 dark:text-neutral-200 outline-none leading-relaxed text-sm md:text-[15px] font-mono placeholder:text-slate-300 dark:placeholder:text-neutral-700"
                rows={12}
                spellCheck={false}
              />
            </div>

            {/* Monthly Breakdown */}
            {sortedMonths.length > 0 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/30 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500"/>
                  <h2 className={`font-semibold text-sm ${ttl}`}>Aylık Borç / Ödeme Özeti</h2>
                  <span className={`ml-auto text-xs ${muted}`}>{sortedMonths.length} ay tespit edildi</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-neutral-800 text-left">
                        <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${muted} w-28`}>Ay</th>
                        <th className={`px-5 py-3 text-xs font-semibold uppercase tracking-wide ${muted}`}>Kalem</th>
                        <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted}`}>Tutar</th>
                        <th className={`px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted} w-36`}>Aylık Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMonths.map(month => {
                        const entries = byMonth[month];
                        const monthTotal = entries.reduce((s,e) => s+(e.type==='income'?e.amount:-e.amount), 0);
                        const isCurrentMonth = month === NOW_MONTH;

                        return entries.map((entry, i) => (
                          <tr key={`${month}-${i}`}
                            className={`border-b border-slate-50 dark:border-neutral-900/40 hover:bg-slate-50/60 dark:hover:bg-neutral-900/30 transition-colors ${isCurrentMonth ? 'bg-amber-50/20 dark:bg-amber-500/5' : ''}`}>
                            {i === 0 && (
                              <td rowSpan={entries.length} className="px-5 py-3 align-middle">
                                <div className="flex flex-col items-start gap-1">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                                    monthTotal >= 0
                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                      : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                  }`}>
                                    {MONTH_LABEL[month] || `Ay ${month}`}
                                  </span>
                                  {isCurrentMonth && (
                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">● Bu Ay</span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                {entry.type === 'income'
                                  ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>
                                  : <TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0"/>}
                                <span className={`text-sm ${ttl}`}>{entry.label}</span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`text-sm font-medium tabular-nums ${entry.type==='income'?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                                {entry.type==='expense'?'-':'+'}₺{entry.amount.toLocaleString('tr-TR')}
                              </span>
                            </td>
                            {i === 0 && (
                              <td rowSpan={entries.length} className="px-5 py-3 text-right align-middle">
                                <span className={`text-base font-bold tabular-nums ${monthTotal>=0?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                                  {monthTotal>=0?'+':'-'}₺{Math.abs(monthTotal).toLocaleString('tr-TR')}
                                </span>
                              </td>
                            )}
                          </tr>
                        ));
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 dark:border-neutral-700 bg-slate-50/80 dark:bg-neutral-900/50">
                        <td colSpan={2} className={`px-5 py-3.5 text-sm font-bold ${ttl}`}>Genel Toplam</td>
                        <td className="px-5 py-3.5"/>
                        <td className="px-5 py-3.5 text-right">
                          {(() => {
                            const grand = allEntries.reduce((s,e) => s+(e.type==='income'?e.amount:-e.amount),0);
                            return <span className={`text-base font-bold tabular-nums ${grand>=0?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                              {grand>=0?'+':'-'}₺{Math.abs(grand).toLocaleString('tr-TR')}
                            </span>;
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {sortedMonths.length === 0 && notes.length > 10 && (
              <div className={`${card} p-6 text-center`}>
                <p className={`text-sm ${muted}`}>Henüz aylık veri tespit edilemedi.</p>
                <p className={`text-xs ${muted} mt-1`}>Ay belirtmek için <code className="bg-slate-100 dark:bg-neutral-800 px-1 rounded">mart 37k</code> veya <code className="bg-slate-100 dark:bg-neutral-800 px-1 rounded">5.6.Ay</code> gibi bir format ekleyin.</p>
              </div>
            )}
          </div>

          {/* Right: Calculator */}
          <div className="w-full lg:w-[290px] xl:w-[310px] shrink-0 self-start">
            <div className={`${card} overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 flex items-center gap-2 bg-slate-50/50 dark:bg-neutral-900/30">
                <Calculator className="w-4 h-4 text-emerald-500"/>
                <h2 className={`font-semibold text-sm ${ttl}`}>Hesap Makinesi</h2>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="bg-slate-100 dark:bg-[#18181b] rounded-xl px-4 py-3 flex flex-col items-end border border-slate-200 dark:border-neutral-800 min-h-[72px] justify-end">
                  <div className={`text-xs ${muted} h-4 self-start`}>{calcPrev&&calcOp?`${calcPrev} ${calcOp}`:''}</div>
                  <div className={`text-3xl font-bold ${ttl} break-all text-right mt-1`}>
                    {isNaN(parseFloat(calcInput))?'0':parseFloat(calcInput).toLocaleString('tr-TR',{maximumFractionDigits:4})}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['C','⌫','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','00','.','='].map((btn,i)=>{
                    const isOp=['÷','×','-','+','='].includes(btn);
                    const isClear=btn==='C';
                    const isAction=['⌫','%'].includes(btn);
                    return (
                      <button key={i} onClick={()=>handleCalcClick(btn)}
                        className={`h-11 font-semibold text-base rounded-lg transition-all active:scale-95 select-none focus:outline-none
                          ${isOp?'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm':
                            isClear?'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400':
                            isAction?'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-300':
                            'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-[#09090b] dark:border-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-900 shadow-sm'}`}>
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
    </div>
  );
}
