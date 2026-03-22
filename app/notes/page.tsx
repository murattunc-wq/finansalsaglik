'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import {
  Moon, Sun, Calculator, FileEdit, Trash2, TrendingDown, TrendingUp,
  Sparkles, Info, Plus, X, ChevronDown, ChevronUp, Settings2, Eye, EyeOff, Lock, Wallet, Globe
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useLanguage } from '@/components/LanguageProvider';

/* ============================================================
   HELPERS
   ============================================================ */
function loadLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { 
    const raw = localStorage.getItem(key);
    if (typeof fallback === 'string' && raw !== null) return raw as unknown as T;
    return fallback; 
  }
}

/* ============================================================
   TYPES
   ============================================================ */
type RuleType = 'income' | 'expense' | 'pending' | 'upcoming';
interface CustomRule { id: string; keyword: string; type: RuleType; }

/* ============================================================
   CONSTANTS
   ============================================================ */
const NOW_MONTH = new Date().getMonth() + 1;

const MONTH_LABEL: Record<number, string> = {
  1:'Ocak',2:'Şubat',3:'Mart',4:'Nisan',5:'Mayıs',6:'Haziran',
  7:'Temmuz',8:'Ağustos',9:'Eylül',10:'Ekim',11:'Kasım',12:'Aralık'
};

const BUILTIN_INCOME_KW = ['gelir','getiri','maaş','maas','kira gelir','faiz','nakit gir','vadeli getiri'];

type ParsedEntry = { month: number; label: string; amount: number; type: RuleType };

/** Map pending/upcoming → expense for calculation purposes */
function calcType(t: RuleType): 'income' | 'expense' {
  return (t === 'income' || t === 'upcoming') ? 'income' : 'expense';
}

function STATUS_BADGE_MAP(key: string, t: (k: string) => string): { label: string; cls: string } | undefined {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: t('Ödenecek'),       cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' },
    upcoming: { label: t('Gelecek Ödeme'), cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
  };
  return map[key];
}

function RULE_TYPE_OPTIONS(t: (k: string) => string) {
  return [
    { value: 'income',   label: t('Gelir'),          active: 'bg-emerald-500 text-white' },
    { value: 'expense',  label: t('Gider'),           active: 'bg-rose-500 text-white' },
    { value: 'pending',  label: t('Ödenecek'),        active: 'bg-amber-500 text-white' },
    { value: 'upcoming', label: t('Gelecek Ödeme'),   active: 'bg-blue-500 text-white' },
  ] as const;
}

/* ============================================================
   PARSER FUNCTIONS
   ============================================================ */

/**
 * Parse amount strings with Turkish number formatting support:
 * "9k" → 9000, "9.500" → 9500 (Turkish thousands), "23000" → 23000, "37k" → 37000
 */
function parseAmt(str: string): number | null {
  const s = str.trim().toLowerCase();
  // k-suffix: "9k", "9.5k", "37k"
  const kMatch = s.match(/^(\d+(?:[.,]\d+)?)k$/);
  if (kMatch) {
    const n = parseFloat(kMatch[1].replace(',', '.'));
    return isNaN(n) ? null : n * 1000;
  }
  // Turkish thousands separator: "9.500" = 9500, "23.000" = 23000
  const trThou = s.match(/^(\d+)\.(\d{3})$/);
  if (trThou) return parseInt(trThou[1] + trThou[2], 10);
  // Plain number: "23000", "8000"
  const plain = parseFloat(s.replace(',', '.'));
  if (!isNaN(plain) && plain > 0) return plain;
  return null;
}

/**
 * Convert a word to a month number (1-12), returns null if not a month.
 * Handles Turkish characters and variations.
 */
function wordToMonth(word: string): number | null {
  const s = word.trim().toLowerCase()
    .replace(/[^a-zşğıüöçşğıüöç]/gi, '')
    .replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ı/g,'i')
    .replace(/ö/g,'o').replace(/ü/g,'u').replace(/ç/g,'c');
  const original = word.trim().toLowerCase().replace(/[^a-zşğıüöçA-ZŞĞIÜÖÇ]/gi,'');
  const lookup: Record<string, number> = {
    // Ocak
    'ocak':1,'oca':1,'jan':1,
    // Şubat
    'subat':2,'sbat':2,'sub':2,'feb':2,'subat2':2,
    // Mart
    'mart':3,'mar':3,
    // Nisan
    'nisan':4,'nis':4,'apr':4,
    // Mayıs
    'mayis':5,'mays':5,'may':5,
    // Haziran
    'haziran':6,'haz':6,'jun':6,
    // Temmuz
    'temmuz':7,'tem':7,'jul':7,
    // Ağustos
    'agustos':8,'austos':8,'agu':8,'aug':8,
    // Eylül
    'eylul':9,'eyll':9,'eyl':9,'sep':9,
    // Ekim
    'ekim':10,'eki':10,'oct':10,
    // Kasım
    'kasim':11,'kas':11,'kasm':11,'nov':11,
    // Aralık
    'aralik':12,'ara':12,'arlk':12,'dec':12,
  };
  return lookup[s] ?? lookup[original.toLowerCase()] ?? null;
}

/** Extract month numbers from a segment of text */
function findMonths(text: string): number[] {
  const lower = text.toLowerCase();
  const found: number[] = [];
  for (const w of lower.split(/[\s.,;]+/)) {
    const m = wordToMonth(w);
    if (m && !found.includes(m)) found.push(m);
  }
  if (found.length > 0) return found;
  if (/mevcut/.test(lower)) return [NOW_MONTH];
  // Numeric: "5.6.ay", "7.8.9.ay"
  const numPat = /\b(\d+(?:\.\d+)*)\s*\.?\s*(?:ay)?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = numPat.exec(lower)) !== null) {
    for (const p of m[1].split('.').filter(Boolean)) {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= 12 && !found.includes(n)) found.push(n);
    }
  }
  return found;
}

/** Determine income or expense — custom rules take highest priority */
function guessType(text: string, customRules: CustomRule[]): RuleType {
  const l = text.toLowerCase();
  for (const rule of [...customRules].sort((a,b) => b.keyword.length - a.keyword.length)) {
    if (l.includes(rule.keyword.toLowerCase())) return rule.type;
  }
  if (BUILTIN_INCOME_KW.some(kw => l.includes(kw))) return 'income';
  return 'expense';
}

/**
 * Check if a line is a standalone month section header.
 * Returns the month number, or null if it's not a header.
 */
function isMonthHeader(line: string): number | null {
  const clean = line.trim().replace(/[:\-–.]/g, '').trim();
  const words = clean.split(/\s+/);
  // Accept "Nisan" or "Nisan 2026" style headers (1-2 words, first must be a month)
  if (words.length === 0 || words.length > 2) return null;
  const m = wordToMonth(words[0]);
  if (!m) return null;
  // Make sure the rest (if any) is just a year or empty
  if (words.length === 2 && !/^\d{4}$/.test(words[1])) return null;
  return m;
}

/**
 * MAIN PARSER — supports all formats:
 * 1. Section headers: "Nisan\n  23000 kt\n  34000 ykb"
 * 2. Month-prefixed:  "mart 37k vergi borcu"
 * 3. Calc totals:     "mart 35k + 7k = 42k"
 * 4. Slash segments:  "23k kt mevcut / 9k taksit 5.6.Ay"
 * 5. Inline month:    "65k nisan"
 */
function parseNotes(text: string, customRules: CustomRule[]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const lines = text.split('\n');
  let contextMonth: number | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    const clean = line.replace(/[💰🎯✓✗→]/g, '').trim();

    // ── Is this a standalone month section header? ──
    const hdr = isMonthHeader(clean);
    if (hdr !== null) {
      contextMonth = hdr;
      continue;
    }

    // ── Calculation line: contains both + and = ──
    if (line.includes('+') && line.includes('=')) {
      const eqIdx = line.lastIndexOf('=');
      const afterEq = line.slice(eqIdx + 1).trim();
      const rMatch = afterEq.match(/^([\d.,]+\.?\d*k?)/i);
      if (rMatch) {
        const amt = parseAmt(rMatch[1]);
        if (amt !== null) {
          let month = contextMonth ?? NOW_MONTH;
          const fw = line.split(/\s+/)[0];
          const mFromWord = wordToMonth(fw);
          if (mFromWord) month = mFromWord;
          entries.push({ month, label: 'Nakit / Mevcut', amount: amt, type: 'income' });
          continue;
        }
      }
    }

    // ── Slash-segment line: "23k kt mevcut / 9k taksit 5.6.Ay" ──
    if (line.includes('/')) {
      const parts = line.split('/').map(p => p.trim()).filter(Boolean);
      const firstPart = parts[0];
      const entityLabel = firstPart
        .replace(/\d+(?:[.,]\d+)?\.?\d*k?/gi, '').replace(/mevcut|bakiye/gi, '')
        .trim().replace(/\s+/g, ' ') || 'Not';
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i];
        const amounts = (seg.match(/\d+(?:[.,]\d*)?\.?\d*k?/gi) ?? []).map(t => parseAmt(t)).filter((a): a is number => a !== null);
        if (!amounts.length) continue;
        let months: number[] = [];
        if (i === 0 && /mevcut/.test(seg.toLowerCase())) {
          months = [contextMonth ?? NOW_MONTH];
        } else {
          months = findMonths(seg);
          if (!months.length && i === 0 && contextMonth) months = [contextMonth];
        }
        if (!months.length) continue;
        const type = guessType(seg + ' ' + firstPart, customRules);
        for (const amt of amounts.slice(0,1)) {
          for (const m of months) entries.push({ month: m, label: entityLabel, amount: amt, type });
        }
      }
      continue;
    }

    // ── Month-prefixed: "mart 37k vergi borcu" ──
    const mpMatch = clean.match(/^([a-zşğıüöçA-ZŞĞIÜÖÇı]+)\s+([\d.,]+\.?\d*k?)\s*(.*)$/i);
    if (mpMatch) {
      const pMonth = wordToMonth(mpMatch[1]);
      if (pMonth !== null) {
        const amt = parseAmt(mpMatch[2]);
        if (amt !== null) {
          const desc = mpMatch[3].trim() || mpMatch[1];
          entries.push({ month: pMonth, label: desc, amount: amt, type: guessType(desc + ' ' + clean, customRules) });
          continue;
        }
      }
    }

    // ── Amount + label line (uses contextMonth) ──
    // e.g. "23000 kt", "34000 ykb", "37k vergi, emlak ve ito borcu"
    const alMatch = clean.match(/^([\d.,]+\.?\d*k?)\s*(.*)/i);
    if (alMatch) {
      const amt = parseAmt(alMatch[1]);
      if (amt !== null) {
        const rest = alMatch[2].trim();
        // Check if rest has an explicit month → use it
        const mInRest = findMonths(rest);
        const targetMonth = mInRest.length > 0 ? mInRest[0] : contextMonth;
        if (targetMonth !== null) {
          entries.push({ month: targetMonth, label: rest || 'Not', amount: amt, type: guessType(rest + ' ' + clean, customRules) });
          continue;
        }
        // No month context → skip (e.g., "100k kart harcama hedefi" without context)
      }
    }
  }

  return entries;
}

/* ============================================================
   DEMO NOTES — using new section-header format
   ============================================================ */
const DEMO_NOTES = `Nisan
23000 kt
34000 ykb
8000 vakıfbank
37k vergi, emlak ve ito borcu

Mayıs
9500 kt
29000 ykb
8000 vakıfbank

Haziran
9500 kt
19000 ykb

Temmuz
7000 kt

Ağustos
7000 kt

Eylül
9000 kt`.trim();

/* ============================================================
   COMPONENT
   ============================================================ */
export default function NotesPage() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const { t, locale, setLocale } = useLanguage();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notes, setNotes] = useState<string>(() => loadLS('fcv2_daily_notes', ''));
  const [customRules, setCustomRules] = useState<CustomRule[]>(() => loadLS('fcv2_notes_rules', []));
  const [rulesOpen, setRulesOpen] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [newKwType, setNewKwType] = useState<RuleType>('expense');

  const [calcInput, setCalcInput] = useState('0');
  const [calcPrev, setCalcPrev] = useState<string|null>(null);
  const [calcOp, setCalcOp] = useState<string|null>(null);
  const [newNum, setNewNum] = useState(false);

  // Privacy Mode
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => loadLS('fcv2_privacy_mode', false));
  const [savedPin, setSavedPin] = useState<string>(() => loadLS('fcv2_notes_pin', ''));
  const [pinAction, setPinAction] = useState<'set'|'unlock'|'remove'|null>(null); // Controls PIN Modals if needed
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fcv2_privacy_mode') setIsPrivacyMode(e.newValue === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => { if (mounted) localStorage.setItem('fcv2_daily_notes', JSON.stringify(notes)); }, [notes, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_notes_rules', JSON.stringify(customRules)); }, [customRules, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_notes_pin', JSON.stringify(savedPin)); }, [savedPin, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_privacy_mode', JSON.stringify(isPrivacyMode)); }, [isPrivacyMode, mounted]);

  // DB Sync Load
  useEffect(() => {
    if (sessionUser?.email) {
      fetch('/api/user/data')
        .then(r => r.json())
        .then(res => {
          if (res.data) {
            if (res.data.notes !== undefined && res.data.notes !== null) setNotes(res.data.notes);
            if (res.data.customRules && Array.isArray(res.data.customRules)) setCustomRules(res.data.customRules);
          }
        }).catch(err => console.error('Load sync fail', err));
    }
  }, [sessionUser?.email]);

  // DB Sync Save
  useEffect(() => {
    if (!mounted || !sessionUser?.email) return;
    const to = setTimeout(() => {
      fetch('/api/user/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, customRules })
      }).catch(console.error);
    }, 2000);
    return () => clearTimeout(to);
  }, [notes, customRules, sessionUser?.email, mounted]);

  const addRule = () => {
    const kw = newKw.trim().toLowerCase();
    if (!kw || customRules.some(r => r.keyword === kw)) return;
    setCustomRules(prev => [...prev, { id: Date.now().toString(), keyword: kw, type: newKwType }]);
    setNewKw('');
  };
  const removeRule = (id: string) => setCustomRules(prev => prev.filter(r => r.id !== id));

  const allEntries = useMemo(() => parseNotes(notes, customRules), [notes, customRules]);
  const byMonth = useMemo(() => {
    const map: Record<number, ParsedEntry[]> = {};
    for (const e of allEntries) {
      if (!map[e.month]) map[e.month] = [];
      map[e.month].push(e);
    }
    return map;
  }, [allEntries]);
  const sortedMonths = Object.keys(byMonth).map(Number).sort((a,b) => a-b);

  const evaluate = (a: string, b: string, op: string): number => {
    const A = parseFloat(a), B = parseFloat(b);
    if (isNaN(A)||isNaN(B)) return 0;
    switch(op) {
      case '+': return +(A+B).toFixed(4); case '-': return +(A-B).toFixed(4);
      case '×': return +(A*B).toFixed(4); case '÷': return B===0?0:+(A/B).toFixed(4);
      default: return B;
    }
  };
  const handleCalc = (val: string) => {
    if (/[0-9.]/.test(val)) {
      if (newNum) { setCalcInput(val); setNewNum(false); }
      else setCalcInput(calcInput==='0'&&val!=='.'?val:calcInput+val);
    } else if (['+','-','×','÷'].includes(val)) {
      if (calcOp&&calcPrev&&!newNum) { const r=evaluate(calcPrev,calcInput,calcOp); setCalcInput(String(r)); setCalcPrev(String(r)); }
      else setCalcPrev(calcInput);
      setCalcOp(val); setNewNum(true);
    } else if (val==='⌫') {
      if (calcInput.length>1) setCalcInput(calcInput.slice(0,-1)); else { setCalcInput('0'); setNewNum(true); }
    } else if (val==='%') {
      const n=parseFloat(calcInput); if(!isNaN(n)) setCalcInput(String(n/100));
    } else if (val==='=') {
      if (calcOp&&calcPrev) { const r=evaluate(calcPrev,calcInput,calcOp); setCalcInput(String(r)); setCalcPrev(null); setCalcOp(null); setNewNum(true); }
    } else if (val==='C') {
      setCalcInput('0'); setCalcPrev(null); setCalcOp(null); setNewNum(true);
    }
  };

  const bg    = "min-h-screen bg-[#fafafa] dark:bg-black text-slate-900 dark:text-neutral-50 transition-colors duration-200";
  const navBg = "bg-white dark:bg-black border-b border-slate-200 dark:border-neutral-800";
  const card  = "bg-white dark:bg-[#09090b] rounded-xl border border-slate-200 dark:border-neutral-800 shadow-sm";
  const muted = "text-slate-500 dark:text-neutral-400";
  const ttl   = "text-slate-900 dark:text-neutral-50";
  const isDark = mounted && theme === 'dark';
  
  const handleTogglePrivacy = () => {
    if (!isPrivacyMode) {
      setIsPrivacyMode(true); // Always freely lock
    } else {
      // Unlocking: if has PIN, ask for PIN. Else freely unlock
      if (savedPin) {
        setPinAction('unlock');
        setPinInput('');
      } else {
        setIsPrivacyMode(false);
      }
    }
  };

  const handlePinSubmit = () => {
    if (pinAction === 'unlock') {
      if (pinInput === savedPin) { setIsPrivacyMode(false); setPinAction(null); }
      else alert('Hatalı PIN.');
    } else if (pinAction === 'set') {
      if (pinInput.length >= 4) { setSavedPin(pinInput); setPinAction(null); }
      else alert('PIN en az 4 haneli olmalı.');
    } else if (pinAction === 'remove') {
      if (pinInput === savedPin) { setSavedPin(''); setPinAction(null); }
      else alert('Hatalı PIN.');
    }
  };

  const privacyClass = isPrivacyMode ? "filter blur-md select-none pointer-events-none transition-all duration-300" : "transition-all duration-300";

  if (!mounted) return null;

  return (
    <div className={`${bg} relative`} onClick={() => setIsProfileOpen(false)}>

      {/* PIN Modal Overlay */}
      {pinAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className={`${card} p-6 w-full max-w-sm flex flex-col gap-4 mx-4 shadow-xl`} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-indigo-500" />
              <h3 className={`text-lg font-bold ${ttl}`}>
                {pinAction==='unlock' ? 'Gizliliği Kaldır' : pinAction==='set' ? 'Yeni PIN Belirle' : 'PIN Kaldır'}
              </h3>
            </div>
            <p className={`text-sm ${muted}`}>
              {pinAction==='unlock' ? 'Verileri görmek için mevcut PIN kodunuzu girin.' : pinAction==='set' ? 'Gizlilik modunu açarken kullanılacak yeni bir PIN kodu belirleyin.' : 'Mevcut PIN kodunuzu girerek korumayı kaldırın.'}
            </p>
            <input type="password" placeholder="****" value={pinInput} maxLength={8} autoFocus
              onChange={e=>setPinInput(e.target.value.replace(/[^0-9]/g,''))}
              onKeyDown={e=>e.key==='Enter'&&handlePinSubmit()}
              className={`w-full px-4 py-3 text-2xl tracking-widest text-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 ${ttl} focus:outline-none focus:border-indigo-500`} />
            <div className="flex gap-2">
              <button onClick={()=>setPinAction(null)} className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors`}>İptal</button>
              <button onClick={handlePinSubmit} disabled={!pinInput} className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">Onayla</button>
            </div>
          </div>
        </div>
      )}

      {/* NAV */}
      <div className={`${navBg} sticky top-0 z-40`}>
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 shrink-0 flex-1 sm:flex-none">
            <div className="p-2 -ml-2 -mt-2 -mb-2 flex shrink-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center">
                <span className="text-white dark:text-black text-sm font-bold">₺</span>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-neutral-900/50 p-1 rounded-lg shrink-0 relative z-50">
              <Link href="/" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all select-none">{t('Kokpit')}</Link>
              <Link href="/notes" onClick={(e) => e.stopPropagation()} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-neutral-800 select-none">{t('Notlarım')}</Link>
            </div>

          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center gap-2">
              <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors`}>
                {isDark ? <Sun className="w-5 h-5"/> : <Moon className="w-5 h-5"/>}
              </button>
            </div>
            
            <div className="relative">
              <button 
                onClick={(e)=>{e.stopPropagation();setIsProfileOpen(p=>!p);}} 
                className={`flex items-center gap-2 rounded-full sm:rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 p-1 transition-colors outline-none focus:outline-none`}
              >
                <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border border-slate-300 dark:border-neutral-700 font-semibold text-sm overflow-hidden shrink-0 shadow-sm`} style={{background:sessionUser?.image?'transparent':'#e2e8f0'}}>
                  {sessionUser?.image?<img src={sessionUser.image} alt="avatar" className="w-full h-full object-cover"/>:<span className="text-slate-600 dark:text-neutral-300">{(sessionUser?.name||sessionUser?.email||'U').charAt(0).toUpperCase()}</span>}
                </div>
              </button>
              {isProfileOpen && (
                <div onClick={e=>e.stopPropagation()} className={`absolute right-0 top-full mt-2 w-72 ${card} rounded-xl shadow-xl border border-slate-100 dark:border-neutral-800 z-50 overflow-hidden transition-all`}>
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                    <p className={`text-sm font-semibold ${ttl} truncate`}>{sessionUser?.name||'Kullanıcı'}</p>
                    <p className={`text-xs ${muted} truncate`}>{sessionUser?.email||''}</p>
                  </div>

                  <div className="py-1 border-b border-slate-100 dark:border-neutral-800 sm:hidden">
                    <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors flex items-center gap-3`}>
                      {isDark ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>} 
                      {isDark ? 'Açık Tema' : 'Koyu Tema'}
                    </button>
                    <button onClick={handleTogglePrivacy} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${isPrivacyMode ? 'text-indigo-600 dark:text-indigo-400' : muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors flex items-center gap-3`}>
                      {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {isPrivacyMode ? 'Gizliliği Kapat' : 'Gizliliği Aç'}
                    </button>
                  </div>

                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className={`text-xs font-semibold ${ttl} uppercase tracking-wider`}>Bildirimler</h3>
                      <span className="text-[10px] font-medium bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-0.5 rounded-full">1 Yeni</span>
                    </div>
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${ttl}`}>Maaş yattı</p>
                        <p className={`text-xs ${muted} mt-0.5`}>Hesabınıza 130.000 TL transfer edildi.</p>
                      </div>
                    </div>
                  </div>

                  {savedPin ? (
                    <button onClick={() => { setPinAction('remove'); setPinInput(''); setIsProfileOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 transition-colors flex items-center gap-3`}>
                      <Lock className="w-4 h-4"/> PIN Kaldır
                    </button>
                  ) : (
                    <button onClick={() => { setPinAction('set'); setPinInput(''); setIsProfileOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 transition-colors flex items-center gap-3`}>
                      <Lock className="w-4 h-4"/> PIN Belirle
                    </button>
                  )}

                  <div className="px-4 py-3 text-sm font-medium border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between">
                    <span className={`flex items-center gap-3 ${muted}`}><Globe className="w-4 h-4" /> Dil / Language</span>
                    <div className="flex bg-slate-100 dark:bg-neutral-900 p-0.5 rounded-md">
                      <button onClick={(e) => { e.stopPropagation(); setLocale('tr'); }} className={`px-2 py-1 text-xs font-bold rounded min-w-[32px] transition-colors ${locale === 'tr' ? 'bg-white dark:bg-neutral-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>TR</button>
                      <button onClick={(e) => { e.stopPropagation(); setLocale('en'); }} className={`px-2 py-1 text-xs font-bold rounded min-w-[32px] transition-colors ${locale === 'en' ? 'bg-white dark:bg-neutral-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-white'}`}>EN</button>
                    </div>
                  </div>

                  <Link href="/faq" onClick={() => setIsProfileOpen(false)} className={`w-full text-left px-4 py-3 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 transition-colors flex items-center gap-3`}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    Yardım / SSS
                  </Link>

                  <button onClick={()=>signOut({callbackUrl:'/login'})} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium">
                    <Trash2 className="w-4 h-4"/> Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-[1500px] mx-auto p-4 md:p-8">
        <div className="flex flex-col lg:flex-row gap-6">

          {/* LEFT */}
          <div className="flex-1 flex flex-col gap-5 min-w-0">

            {/* Notepad */}
            <div className={`${card} flex flex-col overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/30 shrink-0">
                <div className="flex items-center gap-2">
                  <FileEdit className="w-4 h-4 text-indigo-500"/>
                  <h2 className={`font-semibold text-sm ${ttl}`}>{t('Hesaplama Defteri')}</h2>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handleTogglePrivacy} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${isPrivacyMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400' : `hover:bg-slate-200 dark:hover:bg-neutral-800 ${muted}`}`}>
                    {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    {isPrivacyMode ? t('Gizli') : t('Gizle')}
                  </button>
                  {notes.length>0 && <button onClick={()=>setNotes('')} className={`text-xs ${muted} hover:text-rose-500 transition-colors`}>{t('Temizle')}</button>}
                  {notes==='' && <button onClick={()=>setNotes(DEMO_NOTES)} className="text-xs font-medium text-indigo-500 hover:text-indigo-700">✦ Demo Yükle</button>}
                </div>
              </div>
              <textarea
                value={notes}
                onChange={e=>setNotes(e.target.value)}
                placeholder={`Nisan\n23000 kt\n34000 ykb\n8000 vakıfbank\n37k vergi borcu\n\nMayıs\n9500 kt\n29000 ykb`}
                className={`w-full resize-none p-5 bg-transparent text-slate-800 dark:text-neutral-200 outline-none leading-relaxed text-sm md:text-[15px] font-mono placeholder:text-slate-300 dark:placeholder:text-neutral-700 ${privacyClass}`}
                rows={14}
                spellCheck={false}
              />
            </div>

            {/* Format Rules */}
            <div className={`${card} overflow-hidden`}>
              <button onClick={()=>setRulesOpen(p=>!p)}
                className="w-full px-5 py-3.5 flex items-center justify-between border-b border-transparent hover:bg-slate-50/50 dark:hover:bg-neutral-900/30 transition-colors">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-slate-400"/>
                  <span className={`font-semibold text-sm ${ttl}`}>{t('Format Kuralları')}</span>
                  {customRules.length>0 && <span className="text-[10px] font-bold bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 px-2 py-0.5 rounded-full">{customRules.length} kural</span>}
                </div>
                {rulesOpen?<ChevronUp className="w-4 h-4 text-slate-400"/>:<ChevronDown className="w-4 h-4 text-slate-400"/>}
              </button>
              {rulesOpen && (
                <div className="p-5 border-t border-slate-100 dark:border-neutral-800 flex flex-col gap-4">
                  <div className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-neutral-900 rounded-lg">
                    <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5"/>
                    <p className={`text-xs ${muted} leading-relaxed`}>
                      Notlarınızdaki kelimelerin gelir mi gider mi sayılacağını tanımlayın.
                      Özel kurallar yerleşik kurallara göre önceliklidir.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" placeholder="anahtar kelime..." value={newKw}
                      onChange={e=>setNewKw(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addRule()}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#18181b] ${ttl} focus:outline-none focus:border-indigo-400 transition-colors`}/>
                    <div className="flex flex-wrap rounded-lg overflow-hidden border border-slate-200 dark:border-neutral-800 shrink-0 w-full sm:w-auto">
                      {RULE_TYPE_OPTIONS(t).map((opt, i) => (
                        <button key={opt.value} onClick={()=>setNewKwType(opt.value)}
                          className={`px-3 py-2 text-xs font-semibold transition-colors ${i>0?'border-l border-slate-200 dark:border-neutral-800':''} ${newKwType===opt.value ? opt.active : `bg-white dark:bg-[#18181b] ${muted}`}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={addRule} disabled={!newKw.trim()} className="px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg transition-colors"><Plus className="w-4 h-4"/></button>
                  </div>
                  {customRules.length>0 ? (
                    <div className="flex flex-col gap-2">
                      {customRules.map(rule=>(
                        <div key={rule.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800 group">
                          <div className="flex items-center gap-3">
                            <span className={`w-2 h-2 rounded-full ${rule.type==='income'?'bg-emerald-500':rule.type==='expense'?'bg-rose-500':rule.type==='pending'?'bg-amber-500':'bg-blue-500'}`}/>
                            <span className={`text-sm font-medium ${ttl} font-mono`}>{rule.keyword}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rule.type==='income'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400':rule.type==='expense'?'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400':(STATUS_BADGE_MAP(rule.type, t)?.cls ?? '')}`}>
                              {RULE_TYPE_OPTIONS(t).find(o=>o.value===rule.type)?.label}
                            </span>
                            <button onClick={()=>removeRule(rule.id)} className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 transition-opacity"><X className="w-3.5 h-3.5"/></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className={`text-xs ${muted} text-center py-2`}>Henüz özel kural eklenmedi</p>}
                  <div className="pt-2 border-t border-slate-100 dark:border-neutral-800">
                    <p className={`text-xs font-medium ${muted} mb-2`}>Yerleşik gelir kelimeleri:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {BUILTIN_INCOME_KW.map(kw=><span key={kw} className="text-[11px] font-mono bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">{kw}</span>)}
                    </div>
                  </div>
                  
                  {/* PIN Settings Area */}
                  <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex items-center justify-between mt-1">
                    <div>
                      <p className={`text-sm font-semibold ${ttl}`}>Gizlilik PIN Kodu</p>
                      <p className={`text-xs ${muted}`}>Ekranı kilitleyip kilidi açmak için</p>
                    </div>
                    {savedPin ? (
                      <button onClick={()=>{setPinAction('remove');setPinInput('');}} className="px-3 py-1.5 text-xs font-semibold bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/30 rounded transition-colors">PIN&apos;i Kaldır</button>
                    ) : (
                      <button onClick={()=>{setPinAction('set');setPinInput('');}} className="px-3 py-1.5 text-xs font-semibold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-400 dark:hover:bg-indigo-500/30 rounded transition-colors">PIN Belirle</button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Monthly Table */}
            {sortedMonths.length > 0 && (
              <div className={`${card} overflow-hidden`}>
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-900/30 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500"/>
                  <h2 className={`font-semibold text-sm ${ttl}`}>{t('Aylık Borç / Ödeme Özeti')}</h2>
                  <span className={`ml-auto text-xs ${muted}`}>{sortedMonths.length} {t('ay tespit edildi')}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-neutral-800 text-left">
                        <th className={`sticky left-0 z-20 bg-white dark:bg-[#09090b] px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wide ${muted} w-16 sm:w-28`}>{t('Ay')}</th>
                        <th className={`sticky left-16 sm:left-28 z-20 bg-white dark:bg-[#09090b] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] px-2 sm:px-5 py-3 text-xs font-semibold uppercase tracking-wide ${muted}`}>{t('Kalem')}</th>
                        <th className={`px-2 sm:px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted} min-w-[80px] sm:min-w-[120px]`}>{t('Tutar')}</th>
                        <th className={`px-2 sm:px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide ${muted} min-w-[80px] sm:min-w-[120px]`}>{t('Aylık Net')}</th>
                      </tr>
                    </thead>
                    <tbody className={privacyClass}>
                      {sortedMonths.map(month => {
                        const monthEntries = byMonth[month];
                        const total = monthEntries.reduce((s,e) => s+(calcType(e.type)==='income'?e.amount:-e.amount), 0);
                        const isCurrent = month === NOW_MONTH;
                        return monthEntries.map((entry,i) => (
                          <tr key={`${month}-${i}`}
                          className={`group border-b border-slate-100 dark:border-neutral-800/60 transition-colors ${isCurrent?'bg-amber-50 dark:bg-[#1f1a0d]':'bg-white dark:bg-[#09090b]'} hover:bg-slate-50 dark:hover:bg-neutral-900/50 ${i===0?'border-t-2 border-t-slate-200 dark:border-t-neutral-700':''}`}>
                            {i===0 && (
                              <td rowSpan={monthEntries.length} className={`sticky left-0 z-10 px-1 sm:px-5 py-3 align-middle bg-inherit`}>
                                <div className="flex flex-col items-center sm:items-start gap-1 w-14 sm:w-16 mx-auto sm:mx-0">
                                  <span className={`text-[10px] sm:text-xs font-bold px-1.5 sm:px-2.5 py-1 rounded-full whitespace-nowrap ${total>=0?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400':'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                    {MONTH_LABEL[month]||t(`Ay ${month}`)}
                                  </span>
                                  {isCurrent && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">● Bu Ay</span>}
                                </div>
                              </td>
                            )}
                            <td className={`sticky left-16 sm:left-28 z-10 px-2 sm:px-5 py-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] bg-inherit`}>
                              <div className="flex items-center gap-1 sm:gap-2 truncate max-w-[80px] sm:max-w-[200px]">
                                {calcType(entry.type)==='income'?<TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>:<TrendingDown className="w-3.5 h-3.5 text-rose-500 shrink-0"/>}
                                <span className={`text-sm ${ttl}`}>{entry.label}</span>
                                {STATUS_BADGE_MAP(entry.type, t) && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap ${STATUS_BADGE_MAP(entry.type, t)!.cls}`}>
                                    {STATUS_BADGE_MAP(entry.type, t)!.label}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`text-sm font-medium tabular-nums ${calcType(entry.type)==='income'?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                                {calcType(entry.type)==='expense'?'-':'+'}₺{entry.amount.toLocaleString('tr-TR')}
                              </span>
                            </td>
                            {i===0 && (
                              <td rowSpan={monthEntries.length} className="px-5 py-3 text-right align-middle">
                                <span className={`text-base font-bold tabular-nums ${total>=0?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                                  {total>=0?'+':'-'}₺{Math.abs(total).toLocaleString('tr-TR')}
                                </span>
                              </td>
                            )}
                          </tr>
                        ));
                      })}
                    </tbody>
                    <tfoot className={privacyClass}>
                      <tr className="border-t-2 border-slate-200 dark:border-neutral-700">
                        <td colSpan={2} className={`sticky left-0 z-20 bg-slate-50/80 dark:bg-neutral-900/50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] px-5 py-3.5 text-sm font-bold ${ttl}`}>{t('Genel Toplam')}</td>
                        <td className="px-5 py-3.5 bg-slate-50/80 dark:bg-neutral-900/50"/>
                        <td className="px-5 py-3.5 text-right bg-slate-50/80 dark:bg-neutral-900/50">
                          {(()=>{
                            const g = allEntries.reduce((s,e)=>s+(calcType(e.type)==='income'?e.amount:-e.amount),0);
                            return <span className={`text-base font-bold tabular-nums ${g>=0?'text-emerald-600 dark:text-emerald-400':'text-rose-600 dark:text-rose-400'}`}>
                              {g>=0?'+':'-'}₺{Math.abs(g).toLocaleString('tr-TR')}
                            </span>;
                          })()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {sortedMonths.length===0 && notes.length>10 && (
              <div className={`${card} p-6 text-center`}>
                <p className={`text-sm ${muted}`}>Henüz aylık veri tespit edilemedi.</p>
                <p className={`text-xs ${muted} mt-1`}>Ay adını ayrı bir satıra yazın: <code className="bg-slate-100 dark:bg-neutral-800 px-1 rounded">Nisan</code></p>
              </div>
            )}
          </div>

          {/* RIGHT: Calculator */}
          <div className="w-full lg:w-[290px] xl:w-[310px] shrink-0 self-start">
            <div className={`${card} overflow-hidden`}>
              <div className="px-5 py-3.5 border-b border-slate-100 dark:border-neutral-800 flex items-center gap-2 bg-slate-50/50 dark:bg-neutral-900/30">
                <Calculator className="w-4 h-4 text-emerald-500"/>
                <h2 className={`font-semibold text-sm ${ttl}`}>{t('Hesap Makinesi')}</h2>
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className={`bg-slate-100 dark:bg-[#18181b] rounded-xl px-4 py-3 flex flex-col items-end border border-slate-200 dark:border-neutral-800 min-h-[72px] justify-end ${privacyClass}`}>
                  <div className={`text-xs ${muted} h-4 self-start`}>{calcPrev&&calcOp?`${calcPrev} ${calcOp}`:''}</div>
                  <div className={`text-3xl font-bold ${ttl} break-all text-right mt-1`}>
                    {isNaN(parseFloat(calcInput))?'0':parseFloat(calcInput).toLocaleString('tr-TR',{maximumFractionDigits:4})}
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['C','⌫','%','÷','7','8','9','×','4','5','6','-','1','2','3','+','0','00','.','='].map((btn,i)=>{
                    const isOp=['÷','×','-','+','='].includes(btn);
                    const isClear=btn==='C';
                    const isAct=['⌫','%'].includes(btn);
                    return (
                      <button key={i} onClick={()=>handleCalc(btn)}
                        className={`h-11 font-semibold text-base rounded-lg transition-all active:scale-95 select-none focus:outline-none
                          ${isOp?'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm':
                            isClear?'bg-rose-100 text-rose-600 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-400':
                            isAct?'bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-neutral-800 dark:text-neutral-300':
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
