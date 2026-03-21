'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Search, Bell, Moon, Sun, User, ArrowUpRight, ArrowDownRight, 
  Plus, CalendarDays, Wallet, TrendingUp, FileText,
  MoreVertical, Trash2, Edit2, Download, Upload, Eye, EyeOff, Lock
} from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { DayPicker } from 'react-day-picker';
import { format, isWithinInterval, parseISO, parse, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { tr } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';
import TransactionModal, { TransactionPayload } from '@/components/TransactionModal';

/* ============================================================
   TYPES
   ============================================================ */
type RecurringItem = { id: string; type: 'income'|'expense'; category: string; name: string; amount: number; color: string; order?: number; dueDay?: number; date?: string; repeatUntil?: string; };
type InstallmentItem = { id: string; name: string; total: number; remaining: number; monthly: number; date: string; dueDay?: number };
type Transaction = { id: string; name: string; type: 'income'|'expense'|'transfer'; amount: number; date: string; isRecurringBase?: boolean; avatarPrefix: string };

/* ============================================================
   CONSTANTS
   ============================================================ */
const INIT_RECURRING: RecurringItem[] = [];

const INIT_INSTALLMENTS: InstallmentItem[] = [];

const INIT_TRANSACTIONS: Transaction[] = [];

const INIT_OVERRIDES: Record<string, number> = {};

const INIT_ORDERS: Record<string, number> = {};

const DONUT_COLORS      = ['#18181b', '#52525b', '#a1a1aa', '#e4e4e7'];
const DARK_DONUT_COLORS = ['#fafafa', '#a1a1aa', '#52525b', '#27272a'];
const MATRIX_MONTHS     = ['Nis 26','May 26','Haz 26','Tem 26','Ağu 26','Eyl 26','Eki 26','Kas 26','Ara 26'];

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
export default function FinanceDashboard() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const sessionUser = session?.user;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeTxnMenu,  setActiveTxnMenu]  = useState<string|null>(null);
  const [activeMatrixMenu, setActiveMatrixMenu] = useState<string|null>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const [txnFilter, setTxnFilter] = useState<'all'|'income'|'expense'>('all');

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>(() => {
    try {
      const stored = localStorage.getItem('fcv2_dateRange');
      if (stored) {
        const parsed = JSON.parse(stored);
        return { from: parsed.from ? new Date(parsed.from) : undefined, to: parsed.to ? new Date(parsed.to) : undefined };
      }
    } catch {}
    return { from: subMonths(new Date(), 2), to: endOfMonth(addMonths(new Date(), 3)) };
  });

  /* ---- Cell editing ---- */
  const [editingCell, setEditingCell] = useState<{ monthIdx: number; itemId: string; isRecurring?: boolean; txnType?: 'income'|'expense' }|null>(null);
  const [editValue,   setEditValue]   = useState('');

  /* ---- Rule name editing ---- */
  const [editingRuleId, setEditingRuleId] = useState<string|null>(null);
  const [ruleNameValue, setRuleNameValue] = useState('');

  /* ---- Goal editing ---- */
  const [isEditingGoal,   setIsEditingGoal]   = useState(false);
  const [goalInputValue,  setGoalInputValue]   = useState('');

  /* ---- Persisted data state ---- */
  const [baseCapital,   setBaseCapital]   = useState<number>(() => loadLS('fcv2_baseCapital',   0));
  const [savingGoal,    setSavingGoal]    = useState<number>(() => loadLS('fcv2_savingGoal',    0));
  const [recurring,     setRecurring]     = useState<RecurringItem[]>(() => loadLS('fcv2_recurring',     INIT_RECURRING));
  const [installments,  setInstallments]  = useState<InstallmentItem[]>(() => loadLS('fcv2_installments',  INIT_INSTALLMENTS));
  const [transactions,  setTransactions]  = useState<Transaction[]>(() => loadLS('fcv2_transactions',  INIT_TRANSACTIONS));
  const [overrides,     setOverrides]     = useState<Record<string,number>>(() => loadLS('fcv2_overrides', INIT_OVERRIDES));

  /* ---- Advanced feature states ---- */
  const [selectedTxns,        setSelectedTxns]        = useState<Set<string>>(new Set());
  const [hiddenProjections,   setHiddenProjections]   = useState<string[]>(() => loadLS('fcv2_hiddenProjections', []));
  const [paidStatus,          setPaidStatus]          = useState<Record<string, boolean>>(() => loadLS('fcv2_paidStatus', {}));
  const [customOrders,        setCustomOrders]        = useState<Record<string, number>>(() => loadLS('fcv2_customOrders', INIT_ORDERS));
  const [lastSyncTs,          setLastSyncTs]          = useState<number>(() => loadLS('fcv2_lastSync', 0));
  const [searchQuery,         setSearchQuery]         = useState('');
  
  /* ---- Privacy Mode states ---- */
  const [isPrivacyMode, setIsPrivacyMode] = useState<boolean>(() => loadLS('fcv2_privacy_mode', false));
  const [savedPin, setSavedPin] = useState<string>(() => loadLS('fcv2_notes_pin', ''));
  const [pinAction, setPinAction] = useState<'set'|'unlock'|'remove'|null>(null);
  const [pinInput, setPinInput] = useState('');

  // Base Capital Editor
  const [isEditingBase, setIsEditingBase] = useState(false);
  const [baseInput, setBaseInput] = useState('');

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fcv2_privacy_mode') setIsPrivacyMode(e.newValue === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  /* ---- Feedback Revision states ---- */
  const [editingDueDay, setEditingDueDay] = useState<{id:string, type:'installment'|'recurring'}|null>(null);
  const [dueDayEditValue, setDueDayEditValue] = useState<number>(1);
  const [draggedId, setDraggedId] = useState<string|null>(null);

  /* ---- Persist to localStorage on change ---- */
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_baseCapital',  JSON.stringify(baseCapital));  }, [baseCapital,  mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_savingGoal',   JSON.stringify(savingGoal));   }, [savingGoal,   mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_recurring',    JSON.stringify(recurring));    }, [recurring,    mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_installments', JSON.stringify(installments)); }, [installments, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_transactions', JSON.stringify(transactions)); }, [transactions, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_overrides',    JSON.stringify(overrides));    }, [overrides,    mounted]);
  
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_hiddenProjections', JSON.stringify(hiddenProjections)); }, [hiddenProjections, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_paidStatus',        JSON.stringify(paidStatus)); }, [paidStatus, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_customOrders',      JSON.stringify(customOrders)); }, [customOrders, mounted]);
  useEffect(() => { if (mounted && dateRange?.from) localStorage.setItem('fcv2_dateRange', JSON.stringify({ from: dateRange.from?.toISOString(), to: dateRange.to?.toISOString() })); }, [dateRange, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_notes_pin', JSON.stringify(savedPin)); }, [savedPin, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_privacy_mode', JSON.stringify(isPrivacyMode)); }, [isPrivacyMode, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem('fcv2_lastSync', JSON.stringify(lastSyncTs)); }, [lastSyncTs, mounted]);

  /* ---- Sync with DB ---- */
  const [isDataLoadedFromDB, setIsDataLoadedFromDB] = useState(false);
  const [dbFetchRan, setDbFetchRan] = useState(false);

  useEffect(() => {
    if (!sessionUser?.email || dbFetchRan) return;
    let isStale = false;
    fetch(`/api/user/data?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()).then(res => {
      if (isStale) return;
      if (res.data && Object.keys(res.data).length > 0) {
        const d = res.data;
        const dbTs = d.lastSync || 0;
        
        // Sadece veritabanındaki veri LOKAL veriden daha yeniyse (veya eşitse ama lokal boşsa) üzerine yaz.
        if (dbTs > lastSyncTs || (lastSyncTs === 0 && dbTs >= 0)) {
          if (d.baseCapital !== undefined) setBaseCapital(d.baseCapital);
          if (d.savingGoal !== undefined) setSavingGoal(d.savingGoal);
          if (d.recurring) setRecurring(d.recurring);
          if (d.installments) setInstallments(d.installments);
          if (d.transactions) setTransactions(d.transactions);
          if (d.overrides) setOverrides(d.overrides);
          if (d.hiddenProjections) setHiddenProjections(d.hiddenProjections);
          if (d.paidStatus) setPaidStatus(d.paidStatus);
          if (d.customOrders) setCustomOrders(d.customOrders);
          setLastSyncTs(dbTs);
        }
      }
      setIsDataLoadedFromDB(true);
      setDbFetchRan(true);
    }).catch(err => {
      console.error('Failed to load DB data', err);
      setIsDataLoadedFromDB(true);
      setDbFetchRan(true);
    });
    return () => { isStale = true; };
  }, [sessionUser?.email, dbFetchRan, lastSyncTs]);

  useEffect(() => {
    if (!isDataLoadedFromDB || !sessionUser?.email) return;
    const saveDataToDB = async () => {
      const nowTs = Date.now();
      setLastSyncTs(nowTs);
      const payload = {
        baseCapital, savingGoal, recurring, installments, transactions,
        overrides, hiddenProjections, paidStatus, customOrders,
        lastSync: nowTs
      };
      try {
        await fetch('/api/user/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error('Failed to sync to DB', err);
      }
    };
    const timer = setTimeout(saveDataToDB, 1500);
    return () => clearTimeout(timer);
  }, [
    baseCapital, savingGoal, recurring, installments, transactions,
    overrides, hiddenProjections, paidStatus, customOrders,
    isDataLoadedFromDB, sessionUser?.email
  ]);

  /* ============================================================
     HANDLERS
     ============================================================ */
  const handleTransactionSave = (payload: TransactionPayload) => {
    if (payload.isRecurring) {
      setRecurring(prev => [...prev, {
        id: `r-${Date.now()}`, type: payload.type === 'income' ? 'income' : 'expense',
        category: payload.description, name: payload.description, amount: payload.amount,
        color: payload.type === 'income' ? '#10b981' : '#f43f5e',
        dueDay: payload.dueDay
      }]);
    } else if (payload.isInstallment && payload.installmentCount) {
      setInstallments(prev => [...prev, {
        id: `i-${Date.now()}`, name: payload.description,
        total: payload.amount, remaining: payload.amount,
        monthly: payload.amount / payload.installmentCount!,
        date: new Date().toISOString(),
        dueDay: payload.dueDay
      }]);
    } else {
      setTransactions(prev => [{
        id: `t-${Date.now()}`, name: payload.description,
        type: payload.type as 'income'|'expense'|'transfer',
        amount: payload.amount, date: payload.date || new Date().toISOString(),
        avatarPrefix: payload.description.charAt(0).toUpperCase(),
      }, ...prev]);
    }
    setIsModalOpen(false);
  };

  const handleCellSave = () => {
    if (!editingCell) return;
    const val = Number(editValue.replace(/[^0-9.-]/g, ''));
    if (!isNaN(val)) {
      const mDate = parse(engineData.matrixColumns[editingCell.monthIdx], 'MMM yy', new Date(), { locale: tr });
      
      if (editingCell.isRecurring) {
        if (val >= 0) {
          const rawId = editingCell.itemId.startsWith('rec-') ? editingCell.itemId.replace('rec-', '') : editingCell.itemId;
          const projId = `proj-${rawId}-${format(mDate, 'yyyy-MM')}`;
          setOverrides(prev => ({ ...prev, [projId]: val }));
        }
      } else {
        const targetMonthStart = startOfMonth(mDate);
        const targetMonthEnd = endOfMonth(mDate);
        
        const rawName = editingCell.itemId.startsWith('one-') ? editingCell.itemId.replace('one-', '') : editingCell.itemId;
        
        setTransactions(prev => {
          let newTxns = prev.filter(t => {
            const td = parseISO(t.date);
            const matches = t.name === rawName && td >= targetMonthStart && td <= targetMonthEnd && !t.isRecurringBase;
            return !matches;
          });
          
          if (val > 0) {
            newTxns = [{
              id: `t-${Date.now()}`,
              name: rawName,
              type: editingCell.txnType || 'expense',
              amount: val,
              date: mDate.toISOString(),
              avatarPrefix: rawName.charAt(0).toUpperCase()
            }, ...newTxns];
          }
          return newTxns;
        });
      }
    }
    setEditingCell(null);
    setEditValue('');
  };

  const handleGoalSave = () => {
    const val = Number(goalInputValue.replace(/[^0-9.]/g, ''));
    if (!isNaN(val) && val > 0) setSavingGoal(val);
    setIsEditingGoal(false);
    setGoalInputValue('');
  };

  const handleTxnDelete = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setActiveTxnMenu(null);
  };

  const handleTxnDeleteByName = (name: string) => {
    setTransactions(prev => prev.filter(t => t.name !== name));
    setActiveMatrixMenu(null);
  };


  const handleRecurringDelete = (id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
    setActiveTxnMenu(null);
  };

  const handleRuleNameSave = () => {
    if (!editingRuleId) return;
    setRecurring(prev => prev.map(r => r.id === editingRuleId ? { ...r, name: ruleNameValue } : r));
    setEditingRuleId(null);
    setRuleNameValue('');
  };

  const handleBulkDelete = () => {
    const toHide: string[] = [];
    const manualIds: string[] = [];
    selectedTxns.forEach(id => {
      if (id.startsWith('rec-') || id.startsWith('inst-')) toHide.push(id);
      else manualIds.push(id);
    });
    if (toHide.length > 0) setHiddenProjections(prev => [...prev, ...toHide]);
    if (manualIds.length > 0) setTransactions(prev => prev.filter(t => !manualIds.includes(t.id)));
    setSelectedTxns(new Set());
  };

  const handleTogglePrivacy = () => {
    if (!isPrivacyMode) {
      setIsPrivacyMode(true);
    } else {
      if (savedPin) { setPinAction('unlock'); setPinInput(''); }
      else setIsPrivacyMode(false);
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

  /* ============================================================
     XML EXPORT / IMPORT
     ============================================================ */
  const handleExportXML = () => {
    const escape = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<FinancialData exportDate="${new Date().toISOString()}">`);
    lines.push(`  <Settings baseCapital="${baseCapital}" savingGoal="${savingGoal}" dateFrom="${dateRange?.from?.toISOString()||''}" dateTo="${dateRange?.to?.toISOString()||''}"/>`);
    lines.push('  <RecurringItems>');
    recurring.forEach(r => {
      lines.push(`    <Item id="${escape(r.id)}" type="${r.type}" category="${escape(r.category)}" name="${escape(r.name)}" amount="${r.amount}" color="${escape(r.color)}" dueDay="${r.dueDay||''}" date="${r.date||''}" repeatUntil="${r.repeatUntil||''}" order="${r.order??''}"/>`);
    });
    lines.push('  </RecurringItems>');
    lines.push('  <Installments>');
    installments.forEach(i => {
      lines.push(`    <Item id="${escape(i.id)}" name="${escape(i.name)}" total="${i.total}" remaining="${i.remaining}" monthly="${i.monthly}" date="${i.date}" dueDay="${i.dueDay||''}"/>`);
    });
    lines.push('  </Installments>');
    lines.push('  <Transactions>');
    transactions.forEach(t => {
      lines.push(`    <Item id="${escape(t.id)}" name="${escape(t.name)}" type="${t.type}" amount="${t.amount}" date="${t.date}" avatarPrefix="${escape(t.avatarPrefix)}" isRecurringBase="${t.isRecurringBase||false}"/>`);
    });
    lines.push('  </Transactions>');
    lines.push('  <Overrides>');
    Object.entries(overrides).forEach(([k,v]) => {
      lines.push(`    <Entry key="${escape(k)}" value="${v}"/>`);
    });
    lines.push('  </Overrides>');
    lines.push('  <PaidStatus>');
    Object.entries(paidStatus).forEach(([k,v]) => {
      lines.push(`    <Entry key="${escape(k)}" paid="${v}"/>`);
    });
    lines.push('  </PaidStatus>');
    lines.push('  <CustomOrders>');
    Object.entries(customOrders).forEach(([k,v]) => {
      lines.push(`    <Entry key="${escape(k)}" order="${v}"/>`);
    });
    lines.push('  </CustomOrders>');
    lines.push('  <HiddenProjections>');
    hiddenProjections.forEach(h => {
      lines.push(`    <Item id="${escape(h)}"/>`);
    });
    lines.push('  </HiddenProjections>');
    lines.push('</FinancialData>');
    const xml = lines.join('\n');
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finansal-kokpit-${format(new Date(),'yyyy-MM-dd')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportXML = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) { alert('Geçersiz XML dosyası!'); return; }
        // Settings
        const settings = doc.querySelector('Settings');
        if (settings) {
          const bc = Number(settings.getAttribute('baseCapital'));
          const sg = Number(settings.getAttribute('savingGoal'));
          if (bc) setBaseCapital(bc);
          if (sg) setSavingGoal(sg);
          const df = settings.getAttribute('dateFrom');
          const dt = settings.getAttribute('dateTo');
          if (df && dt) setDateRange({ from: new Date(df), to: new Date(dt) });
        }
        // Recurring
        const recItems = Array.from(doc.querySelectorAll('RecurringItems > Item'));
        if (recItems.length) {
          setRecurring(recItems.map(el => ({
            id: el.getAttribute('id')!,
            type: el.getAttribute('type') as 'income'|'expense',
            category: el.getAttribute('category')!,
            name: el.getAttribute('name')!,
            amount: Number(el.getAttribute('amount')),
            color: el.getAttribute('color')!,
            dueDay: el.getAttribute('dueDay') ? Number(el.getAttribute('dueDay')) : undefined,
            date: el.getAttribute('date') || undefined,
            repeatUntil: el.getAttribute('repeatUntil') || undefined,
            order: el.getAttribute('order') ? Number(el.getAttribute('order')) : undefined,
          })));
        }
        // Installments
        const instItems = Array.from(doc.querySelectorAll('Installments > Item'));
        if (instItems.length) {
          setInstallments(instItems.map(el => ({
            id: el.getAttribute('id')!,
            name: el.getAttribute('name')!,
            total: Number(el.getAttribute('total')),
            remaining: Number(el.getAttribute('remaining')),
            monthly: Number(el.getAttribute('monthly')),
            date: el.getAttribute('date')!,
            dueDay: el.getAttribute('dueDay') ? Number(el.getAttribute('dueDay')) : undefined,
          })));
        }
        // Transactions
        const txnItems = Array.from(doc.querySelectorAll('Transactions > Item'));
        if (txnItems.length) {
          setTransactions(txnItems.map(el => ({
            id: el.getAttribute('id')!,
            name: el.getAttribute('name')!,
            type: el.getAttribute('type') as 'income'|'expense'|'transfer',
            amount: Number(el.getAttribute('amount')),
            date: el.getAttribute('date')!,
            avatarPrefix: el.getAttribute('avatarPrefix')!,
            isRecurringBase: el.getAttribute('isRecurringBase') === 'true',
          })));
        }
        // Overrides
        const ov: Record<string,number> = {};
        doc.querySelectorAll('Overrides > Entry').forEach(el => { ov[el.getAttribute('key')!] = Number(el.getAttribute('value')); });
        setOverrides(ov);
        // PaidStatus
        const ps: Record<string,boolean> = {};
        doc.querySelectorAll('PaidStatus > Entry').forEach(el => { ps[el.getAttribute('key')!] = el.getAttribute('paid') === 'true'; });
        setPaidStatus(ps);
        // CustomOrders
        const co: Record<string,number> = {};
        doc.querySelectorAll('CustomOrders > Entry').forEach(el => { co[el.getAttribute('key')!] = Number(el.getAttribute('order')); });
        setCustomOrders(co);
        // HiddenProjections
        const hp = Array.from(doc.querySelectorAll('HiddenProjections > Item')).map(el => el.getAttribute('id')!);
        setHiddenProjections(hp);
        alert('Veriler başarıyla içe aktarıldı! ✓');
      } catch {
        alert('XML dosyası okunamadı. Lütfen doğru formatta bir dosya seçin.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAllData = () => {
    if (confirm('Tüm verilerinizi (sabit gelirler, giderler, bildirimler vs.) silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
      setBaseCapital(0);
      setSavingGoal(0);
      setRecurring([]);
      setInstallments([]);
      setTransactions([]);
      setOverrides({});
      setPaidStatus({});
      setCustomOrders({});
      setHiddenProjections([]);
      setDateRange({ from: undefined, to: undefined });
      
      // Force clear localStorage fallback
      if (typeof window !== 'undefined') {
        const keys = ['fcv2_baseCapital', 'fcv2_savingGoal', 'fcv2_recurring', 'fcv2_installments', 'fcv2_transactions', 'fcv2_overrides', 'fcv2_paidStatus', 'fcv2_customOrders', 'fcv2_hiddenProjections', 'fcv2_dateRange'];
        keys.forEach(k => localStorage.removeItem(k));
      }
      setActiveTxnMenu(null);

      // Force clear DB immediately
      if (sessionUser?.email) {
        fetch('/api/user/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            baseCapital: 0, savingGoal: 0, recurring: [], installments: [], transactions: [], overrides: {}, paidStatus: {}, customOrders: {}, hiddenProjections: []
          })
        }).catch(() => {});
      }
    }
  };

  const handleToggleTxnSelect = (id: string) => {
    setSelectedTxns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = (ids: string[]) => {
    if (selectedTxns.size === ids.length && ids.length > 0) {
      setSelectedTxns(new Set());
    } else {
      setSelectedTxns(new Set(ids));
    }
  };

  const handleOrderChange = (itemId: string, direction: 'up'|'down') => {
    setCustomOrders(prev => {
      const current = prev[itemId] || 0;
      return { ...prev, [itemId]: direction === 'up' ? current - 1 : current + 1 };
    });
    setActiveTxnMenu(null);
  };

  const handleMarkPaid = (id: string) => {
    const monthKey = format(new Date(), 'yyyy-MM');
    const statusKey = `${monthKey}-${id}`;
    setPaidStatus(prev => ({ ...prev, [statusKey]: true }));
    setActiveTxnMenu(null);
  };

  const handleDueDaySave = () => {
    if (!editingDueDay) return;
    if (editingDueDay.type === 'installment') {
      setInstallments(prev => prev.map(i => `inst-${i.id}` === editingDueDay.id ? { ...i, dueDay: dueDayEditValue } : i));
    } else {
      setRecurring(prev => prev.map(r => `rec-${r.id}` === editingDueDay.id ? { ...r, dueDay: dueDayEditValue } : r));
    }
    setEditingDueDay(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    
    // We simply swap or set orders for the entire visible array to match their visual placement
    // But since `customOrders` defines the weight, we can just grab the current matrixRows (which are already sorted),
    // find index of draggedId, index of targetId, and do a standard array splice then re-map customOrders!
    const activeRows = engineData.matrixRows;
    const dragIdx = activeRows.findIndex(r => r.id === draggedId);
    const dropIdx = activeRows.findIndex(r => r.id === targetId);
    if (dragIdx < 0 || dropIdx < 0) return;

    // Both must be of the same 'type' (income vs expense) to make logical sense, 
    // but we can just re-apply an absolute index order per item.
    const newArr = [...activeRows];
    const [moved] = newArr.splice(dragIdx, 1);
    newArr.splice(dropIdx, 0, moved);

    const newOrders = { ...customOrders };
    newArr.forEach((item, index) => {
      newOrders[item.id] = index;
    });
    setCustomOrders(newOrders);
    setDraggedId(null);
  };

  /* ============================================================
     ENGINE
     ============================================================ */
  const engineData = useMemo(() => {
    let totalIncome = 0, totalExpense = 0;
    const expenseCategories: Record<string,number> = {};
    const monthlyBarsUnpaid: Record<string,number>  = {};
    const monthlyBarsPaid:   Record<string,number>  = {};
    const monthlyIncome: Record<string,number>      = {};
    const incomeSources: Record<string,number>      = {};
    const netFlows: number[] = new Array(60).fill(0);
    
    // Projections & Transactions
    const allTxns: Transaction[] = [...transactions];
    const startD = dateRange?.from || new Date();
    const endD   = dateRange?.to   || new Date();
    let currentD = startOfMonth(startD);
    let loopCount = 0;

    // Dynamic Matrix Columns
    const matrixColumns: string[] = [];
    let cD = startOfMonth(startD);
    while (cD <= startOfMonth(endD) && matrixColumns.length < 60) {
      matrixColumns.push(format(cD, 'MMM yy', { locale: tr }).toUpperCase());
      cD = addMonths(cD, 1);
    }

    type MatrixCellData = { [mIdx: number]: number };
    const matrixRowsMap = new Map<string, { id: string, name: string, type: 'income'|'expense', isRecurring: boolean, baseItem?: any, cells: MatrixCellData, isSystemRow?: boolean }>();

    while (currentD <= startOfMonth(endD) && loopCount < 60) {
      const mk = format(currentD, 'MMM', { locale: tr });
      monthlyBarsUnpaid[mk] = monthlyBarsUnpaid[mk] || 0;
      monthlyBarsPaid[mk]   = monthlyBarsPaid[mk]   || 0;

      recurring.forEach(rec => {
        // Build projId accurately for the current month
        const projId = `proj-${rec.id}-${format(currentD, 'yyyy-MM')}`;
        const isAccountRow = rec.name.toLowerCase() === 'hesap' || rec.name.toLowerCase().includes('bakiye');
        
        const key = `${loopCount}-${rec.id}`; // legacy check fallback just in case
        
        const thisMonthNow = new Date();
        const isCurrentMonth = currentD.getMonth() === thisMonthNow.getMonth() && currentD.getFullYear() === thisMonthNow.getFullYear();
        
        // Accept manual overrides on Account rows ONLY for the current chronological month context
        const hasOverride = (!isAccountRow || isCurrentMonth) && (overrides[projId] !== undefined || overrides[key] !== undefined);
        const amt = hasOverride ? (overrides[projId] !== undefined ? overrides[projId] : overrides[key]) : rec.amount;
        
        const txnId = `rec-${rec.id}-${loopCount}`;
        const isHidden = hiddenProjections.includes(txnId);
        
        const recStart = rec.date ? startOfMonth(parseISO(rec.date)) : new Date(2000, 0, 1);
        const recEnd = rec.repeatUntil ? startOfMonth(parseISO(rec.repeatUntil)) : new Date(2050, 0, 1);
        const outOfBounds = currentD < recStart || currentD > recEnd;
        const effectivelyOutOfBounds = outOfBounds && !hasOverride;
        const mappedAmt = (isHidden || effectivelyOutOfBounds) ? 0 : amt;
        
        if (!matrixRowsMap.has(`rec-${rec.id}`)) {
          matrixRowsMap.set(`rec-${rec.id}`, { id: `rec-${rec.id}`, name: rec.name, type: rec.type, isRecurring: true, baseItem: rec, cells: {} });
        }
        
        const mStr = format(currentD, 'MMM yy', { locale: tr }).toUpperCase();
        const mIdx = matrixColumns.indexOf(mStr);
        if (mIdx !== -1) {
          matrixRowsMap.get(`rec-${rec.id}`)!.cells[mIdx] = mappedAmt;
        }

        if (!isHidden && !effectivelyOutOfBounds && mappedAmt > 0) {
          // Determine if this recurring expense is already paid this month (dueDay passed)
          const thisMonthNow = new Date();
          const isThisMonth = currentD.getMonth() === thisMonthNow.getMonth() && currentD.getFullYear() === thisMonthNow.getFullYear();
          const isPaidThisMonth = isThisMonth && rec.type === 'expense' && (rec.dueDay || 1) < thisMonthNow.getDate();
          
          if (rec.type === 'income') { 
            totalIncome += mappedAmt; 
            monthlyIncome[mk] = (monthlyIncome[mk]||0) + mappedAmt;
            incomeSources[rec.id] = (incomeSources[rec.id]||0) + mappedAmt;
            if (mIdx !== -1) netFlows[mIdx] += mappedAmt;
          }
          else if (isPaidThisMonth) {
            // Paid this month → track separately (shown as light gray in chart), NOT deducted from balance
            monthlyBarsPaid[mk] += mappedAmt;
          }
          else {
            // Unpaid → counts toward totalExpense and shown as dark bar
            totalExpense += mappedAmt;
            expenseCategories[rec.category] = (expenseCategories[rec.category]||0) + mappedAmt;
            monthlyBarsUnpaid[mk] += mappedAmt;
            if (mIdx !== -1) netFlows[mIdx] -= mappedAmt;
          }
          // Only push to transaction list if income OR not-yet-paid expense OR it's a non-current month
          if (rec.type === 'income' || !isPaidThisMonth || !isThisMonth) {
            allTxns.push({ id: txnId, name: rec.name, type: rec.type, amount: mappedAmt, date: currentD.toISOString(), isRecurringBase: true, avatarPrefix: rec.name.charAt(0) });
          }
        }
      });

      installments.forEach(inst => {
        const instStart = parseISO(inst.date);
        const monthsPassed = (currentD.getFullYear() - instStart.getFullYear()) * 12 + (currentD.getMonth() - instStart.getMonth());
        const totalInstallments = Math.ceil(inst.total / inst.monthly);
        
        const txnId = `inst-${inst.id}-${loopCount}`;
        if (monthsPassed >= 0 && monthsPassed < totalInstallments && !hiddenProjections.includes(txnId)) {
          const thisMonthNow = new Date();
          const isThisMonth = currentD.getMonth() === thisMonthNow.getMonth() && currentD.getFullYear() === thisMonthNow.getFullYear();
          const isPaidThisMonth = isThisMonth && (inst.dueDay || 1) < thisMonthNow.getDate();

          if (isPaidThisMonth) {
            monthlyBarsPaid[mk] += inst.monthly;
          } else {
            totalExpense += inst.monthly;
            expenseCategories['Taksitler'] = (expenseCategories['Taksitler']||0) + inst.monthly;
            monthlyBarsUnpaid[mk] += inst.monthly;
            const mStr = format(currentD, 'MMM yy', { locale: tr }).toUpperCase();
            const instMIdx = matrixColumns.indexOf(mStr);
            if (instMIdx !== -1) netFlows[instMIdx] -= inst.monthly;
          }

          if (!isPaidThisMonth || !isThisMonth) {
            allTxns.push({ id: txnId, name: `${inst.name} (Taksit)`, type: 'expense', amount: inst.monthly, date: currentD.toISOString(), isRecurringBase: true, avatarPrefix: inst.name.charAt(0) });
          }
        }
      });

      currentD = addMonths(currentD, 1);
      loopCount++;
    }

    const transactionsInRange: Transaction[] = [];
    transactions.forEach(t => {
      const td = parseISO(t.date);
      if (td >= startOfMonth(startD) && td <= endOfMonth(endD)) {
        transactionsInRange.push(t);
        const mk = format(td, 'MMM', { locale: tr });
        // Find month index for matrix
        let mIdx = -1;
        let dCheck = startOfMonth(startD);
        for(let i=0; i<matrixColumns.length; i++) {
          if (format(dCheck, 'MMM yy', { locale: tr }).toUpperCase() === format(td, 'MMM yy', { locale: tr }).toUpperCase()) { mIdx = i; break; }
          dCheck = addMonths(dCheck, 1);
        }

        if (t.type === 'income') {
          totalIncome += t.amount;
          if (monthlyIncome[mk] !== undefined) monthlyIncome[mk] += t.amount;
          incomeSources[t.id] = (incomeSources[t.id]||0) + t.amount;
          if (mIdx !== -1) netFlows[mIdx] += t.amount;
        }
        if (t.type === 'expense') {
          totalExpense += t.amount;
          expenseCategories['Tek Seferlik'] = (expenseCategories['Tek Seferlik']||0) + t.amount;
          if (monthlyBarsUnpaid[mk] !== undefined) monthlyBarsUnpaid[mk] += t.amount;
          if (mIdx !== -1) netFlows[mIdx] -= t.amount;
        }

        if (mIdx !== -1 && t.type !== 'transfer') {
          const mapKey = `one-${t.name}`;
          if (!matrixRowsMap.has(mapKey)) {
            matrixRowsMap.set(mapKey, { id: mapKey, name: t.name, type: t.type, isRecurring: false, cells: {} });
          }
          matrixRowsMap.get(mapKey)!.cells[mIdx] = (matrixRowsMap.get(mapKey)!.cells[mIdx] || 0) + (t.amount || 0); // Enforce number mapping properly
        }
      }
    });
    
    // Sort transactions
    allTxns.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const palette = mounted && theme === 'dark' ? DARK_DONUT_COLORS : DONUT_COLORS;
    const donutData = Object.keys(expenseCategories)
      .map((k,i) => ({ name: k, amount: expenseCategories[k], color: palette[i % palette.length] }))
      .sort((a,b) => b.amount - a.amount);
      
    // Convert matrix map and sort
    const matrixRows = Array.from(matrixRowsMap.values());
    matrixRows.sort((a,b) => {
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
      const orderA = customOrders[a.id] || 0;
      const orderB = customOrders[b.id] || 0;
      return orderA - orderB || a.name.localeCompare(b.name);
    });
    
    // --- DYNAMIC BALANCE ("HESAP") PROJECTION ---
    const accountRow = matrixRows.find(r => r.name.toLowerCase() === 'hesap' || r.name.toLowerCase().includes('bakiye'));
    if (accountRow && matrixColumns.length > 0) {
      let currentBalance = accountRow.cells[0] || baseCapital;
      
      // Cache original values before mutating so projection stays mathematically pure
      const originalAccountValues: Record<number, number> = {};
      for (const mIdx in accountRow.cells) {
        originalAccountValues[mIdx] = accountRow.cells[mIdx];
      }

      // Check if month 0 is the current month and was overridden
      const nowMap = format(new Date(), 'MMM yy', { locale: tr }).toUpperCase();
      if (matrixColumns[0] === nowMap && accountRow.baseItem && originalAccountValues[0] !== accountRow.baseItem.amount) {
        currentBalance = originalAccountValues[0];
        accountRow.cells[0] = currentBalance;
      }

      // We start projecting from month index 1 (the second month)
      for (let m = 1; m < matrixColumns.length; m++) {
        let flowForPrevMonth = netFlows[m - 1] || 0;
        let originalAccountValPrev = originalAccountValues[m - 1] || 0;
        
        currentBalance += (flowForPrevMonth - originalAccountValPrev);
        
        // Reset the milestone if this is the CURRENT real-world month and the user provided a manual override
        const isCurrentMonthCol = matrixColumns[m] === nowMap;
        if (isCurrentMonthCol && accountRow.baseItem && originalAccountValues[m] !== accountRow.baseItem.amount) {
          currentBalance = originalAccountValues[m];
        }

        accountRow.cells[m] = currentBalance;
      }
    }


    
    // Compute Active Liabilities for Sidebar
    const today = new Date();
    const currentDay = today.getDate();
    
    const activeList = [
      ...installments.map(i => ({ id: `inst-${i.id}`, name: i.name, amount: i.monthly, remaining: i.remaining, type: 'installment' as const, dueDay: i.dueDay || 1 })),
      ...recurring.filter(r=>r.type==='expense').map(r => ({ id: `rec-${r.id}`, name: r.name, amount: r.amount, type: 'recurring' as const, dueDay: r.dueDay || 1 }))
    ];
    activeList.sort((a, b) => {
      const aDiff = a.dueDay >= currentDay ? a.dueDay - currentDay : a.dueDay + 31 - currentDay;
      const bDiff = b.dueDay >= currentDay ? b.dueDay - currentDay : b.dueDay + 31 - currentDay;
      return aDiff - bDiff;
    });

    const activeListWithStatus = activeList.map(liab => {
      const monthKey = format(today, 'yyyy-MM');
      const manuallyPaid = paidStatus[`${monthKey}-${liab.id}`] || false;
      // Auto-detect: if dueDay already passed this month, treat as paid
      const autoPaid = liab.dueDay < currentDay;
      const isPaid = manuallyPaid || autoPaid;
      return { ...liab, isPaid };
    });

    const unpaidCount = activeListWithStatus.filter(l => !l.isPaid).length;
    const unpaidTotal = activeListWithStatus.filter(l => !l.isPaid).reduce((s,l) => s + l.amount, 0);
    
    // Build barData with paid/unpaid split for stacked bar chart
    const barData = Object.keys(monthlyBarsUnpaid).map(k => {
      const monthDate = parse(k, 'MMM', new Date(), { locale: tr });
      const isPast = monthDate.getMonth() < today.getMonth() || monthDate.getFullYear() < today.getFullYear();
      const isCurrent = monthDate.getMonth() === today.getMonth();
      return { 
        name: k, 
        unpaid: monthlyBarsUnpaid[k] || 0,
        paid: monthlyBarsPaid[k] || 0,
        // legacy value for maxMonthlyScale calc
        value: (monthlyBarsUnpaid[k] || 0) + (monthlyBarsPaid[k] || 0),
        isPast, isCurrent 
      };
    });

    const maxMonthlyScale = Math.max(...Object.values(monthlyIncome).concat(0), ...barData.map(d=>d.value));

    return {
      totalIncome, totalExpense, barData, donutData, allTxns, matrixRows, matrixColumns, activeList: activeListWithStatus, unpaidCount,
      totalPendingDebts: unpaidTotal, incomeSources, maxMonthlyScale, netFlows
    };
  }, [recurring, installments, transactions, overrides, dateRange, hiddenProjections, customOrders, paidStatus, theme, mounted]);

  const currentNetWorth = baseCapital + engineData.totalIncome - engineData.totalExpense;
  const progressPercent = Math.min((currentNetWorth / savingGoal) * 100, 100);

  /* ============================================================
     HYDRATION & DATA FETCH
     ============================================================ */
  useEffect(() => {
    setMounted(true);
    
    // Auto-heal corrupted transactions caused by the previous prefix mutation bug
    setTransactions(prev => {
      const clean = prev.filter(t => {
        const isCorruptPrefix = t.name.startsWith('one-');
        const isSystemLeak = t.name.toLowerCase() === 'hesap' || t.name.toLowerCase().includes('bakiye');
        return !isCorruptPrefix && !isSystemLeak;
      });
      if (clean.length !== prev.length) {
        localStorage.setItem('fcv2_transactions', JSON.stringify(clean));
        return clean;
      }
      return prev;
    });
  }, []);

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

  /* ============================================================
     FILTERED DATA FOR VIEW
     ============================================================ */
  const lowerQuery = searchQuery.toLowerCase();
  const searchFilter = (item: { name?: string }) => !lowerQuery || (item.name?.toLowerCase().includes(lowerQuery) ?? false);

  const filteredMatrixRows = engineData.matrixRows.filter(searchFilter);
  const filteredActiveList = engineData.activeList.filter(searchFilter);
  const baseFilteredTxns = engineData.allTxns.filter(searchFilter);
  const finalFilteredTxns = baseFilteredTxns.filter(t => txnFilter === 'all' || t.type === txnFilter);

  /* ============================================================
     JSX
     ============================================================ */
  return (
    <div className={bg} onClick={() => { setActiveTxnMenu(null); setIsCalendarOpen(false); setIsActionMenuOpen(false); setIsNotificationsOpen(false); setIsProfileOpen(false); }}>

      {/* PIN Modal Overlay */}
      {pinAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className={`${card} p-6 w-full max-w-sm flex flex-col gap-4 mx-4 shadow-xl`} onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-indigo-500" />
              <h3 className={`text-lg font-bold ${title}`}>
                {pinAction==='unlock' ? 'Gizliliği Kaldır' : pinAction==='set' ? 'Yeni PIN Belirle' : 'PIN Kaldır'}
              </h3>
            </div>
            <p className={`text-sm ${muted}`}>
              {pinAction==='unlock' ? 'Verileri görmek için mevcut PIN kodunuzu girin.' : pinAction==='set' ? 'Gizlilik modunu açarken kullanılacak en az 4 haneli bir PIN kodu belirleyin.' : 'Mevcut PIN kodunuzu girerek korumayı kaldırın.'}
            </p>
            <input type="password" placeholder="****" value={pinInput} maxLength={8} autoFocus
              onChange={e=>setPinInput(e.target.value.replace(/[^0-9]/g,''))}
              onKeyDown={e=>e.key==='Enter'&&handlePinSubmit()}
              className={`w-full px-4 py-3 text-2xl tracking-widest text-center rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 ${title} focus:outline-none focus:border-indigo-500`} />
            <div className="flex gap-2">
              <button onClick={()=>setPinAction(null)} className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors`}>İptal</button>
              <button onClick={handlePinSubmit} disabled={!pinInput} className="flex-1 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors">Onayla</button>
            </div>
          </div>
        </div>
      )}

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
               <Link href="/" className="px-3 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-[#18181b] text-slate-900 dark:text-white shadow-sm transition-all border border-slate-200 dark:border-neutral-800">
                 Kokpit
               </Link>
               <Link href="/notes" className="px-3 py-1.5 text-sm font-medium rounded-md text-slate-500 hover:text-slate-900 dark:text-neutral-400 dark:hover:text-white transition-all">
                 Notlarım
               </Link>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full max-w-[160px] sm:max-w-xs transition-all">
              <Search className={`absolute left-3 top-2.5 h-4 w-4 ${muted}`} />
              <input 
                placeholder="Ara..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 bg-slate-100 dark:bg-neutral-900 rounded-md text-sm ${title} focus:outline-none border border-transparent focus:border-slate-300 dark:focus:border-neutral-700 transition-colors`} 
              />
            </div>
          </div>

          {/* Right: Notifications, Theme, Profile */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsNotificationsOpen(prev => !prev); setIsActionMenuOpen(false); setIsCalendarOpen(false); }}
                className={`relative p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition-colors`}
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-black" />
              </button>
              
              {/* Notifications Dropdown */}
              {isNotificationsOpen && (
                <div 
                  onClick={e => e.stopPropagation()}
                  className={`absolute right-0 top-full mt-2 w-72 ${card} rounded-xl shadow-xl border border-slate-100 dark:border-neutral-800 overflow-hidden z-50`}
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-neutral-800 flex justify-between items-center">
                    <h3 className={`text-sm font-semibold ${title}`}>Bildirimler</h3>
                    <span className="text-[10px] font-medium bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 px-2 py-0.5 rounded-full">1 Yeni</span>
                  </div>
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex gap-3 items-start">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${title}`}>Maaş yattı</p>
                        <p className={`text-xs ${muted} mt-0.5`}>Hesabınıza 130.000 TL transfer edildi.</p>
                        <span className={`text-[10px] ${muted} mt-1 block`}>Az önce</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Privacy Toggle */}
            <button onClick={handleTogglePrivacy} className={`p-2 rounded-full transition-colors ${isPrivacyMode ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/20' : `${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white`}`}>
              {isPrivacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>

            <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={`p-2 rounded-full ${muted} hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-white transition-colors`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            {/* Profile dropdown */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen(prev => !prev); setIsNotificationsOpen(false); setIsActionMenuOpen(false); setIsCalendarOpen(false); }}
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
                  {savedPin ? (
                    <button onClick={() => { setPinAction('remove'); setPinInput(''); setIsProfileOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 transition-colors flex items-center gap-2`}>
                      <Lock className="w-4 h-4"/> PIN Kaldır
                    </button>
                  ) : (
                    <button onClick={() => { setPinAction('set'); setPinInput(''); setIsProfileOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-neutral-900 border-b border-slate-100 dark:border-neutral-800 transition-colors flex items-center gap-2`}>
                      <Lock className="w-4 h-4"/> PIN Belirle
                    </button>
                  )}
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`max-w-[1500px] mx-auto p-4 md:p-8 space-y-6 ${privacyClass}`}>

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-row items-center justify-between gap-4">
          <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${title}`}>Finansal Kokpit</h1>
          
          {/* Action Buttons Aligned Right */}
          <div className="flex items-center gap-2 justify-end">
            {/* ── COMPACT CALENDAR TRIGGER ── */}
            <div className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setIsCalendarOpen(prev => !prev); setIsActionMenuOpen(false); setIsNotificationsOpen(false); }}
                className={`flex items-center gap-1.5 px-3 py-2 ${card} text-sm ${muted} font-medium hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors rounded-md border border-slate-200 dark:border-neutral-800`}
              >
                <CalendarDays className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">
                  {dateRange.from && dateRange.to
                    ? `${format(dateRange.from,'dd MMM',{locale:tr})} – ${format(dateRange.to,'dd MMM yy',{locale:tr})}`
                    : 'Tarih Seçin'}
                </span>
              </button>

              {/* ── COMPACT CALENDAR DROPDOWN ── */}
              {isCalendarOpen && (
                <>
                  {/* Mobile Backdrop */}
                  <div 
                    className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[60] sm:hidden backdrop-blur-sm" 
                    onClick={(e) => { e.stopPropagation(); setIsCalendarOpen(false); }}
                  />
                  <div
                    onClick={e => e.stopPropagation()}
                    className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:translate-x-0 sm:translate-y-0 sm:absolute sm:top-full sm:left-0 sm:right-auto mt-0 sm:mt-2 z-[70] sm:z-50 ${card} shadow-2xl sm:shadow-xl rounded-xl border border-slate-100 dark:border-neutral-800`}
                    style={{ width: 310 }}
                  >
                  <style>{`
                    .fc-cal .rdp { margin: 0; font-size: 13px; }
                    .fc-cal .rdp-months { padding: 12px; }
                    .fc-cal .rdp-month { width: 100%; }
                    .fc-cal .rdp-table { width: 100%; table-layout: fixed; }
                    .fc-cal .rdp-cell, .fc-cal .rdp-head_cell { width: 36px; height: 32px; text-align: center; }
                    .fc-cal .rdp-day { width: 32px; height: 32px; font-size: 12px; border-radius: 6px; }
                    .fc-cal .rdp-caption_label { font-size: 13px; font-weight: 600; }
                    .fc-cal .rdp-caption { padding: 4px 0 8px; }
                    .fc-cal .rdp-day_selected { background: ${isDark ? '#fff' : '#18181b'} !important; color: ${isDark ? '#000' : '#fff'} !important; border-radius: 6px; }
                    .fc-cal .rdp-day_range_middle { background: ${isDark ? '#27272a' : '#f1f5f9'} !important; border-radius: 0; }
                    .fc-cal .rdp-nav_button { width: 28px; height: 28px; border-radius: 6px; }
                    .fc-cal .rdp-head_cell { font-size: 11px; color: ${isDark ? '#71717a' : '#94a3b8'}; font-weight: 500; }
                  `}</style>
                  <div className="fc-cal">
                    <DayPicker mode="range" selected={dateRange as any} onSelect={r => setDateRange(r || {})} locale={tr} showOutsideDays={false} />
                  </div>
                  <div className={`px-3 pb-3 flex justify-end border-t border-slate-100 dark:border-neutral-800 pt-2`}>
                    <button onClick={() => setIsCalendarOpen(false)} className={`px-4 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity`}>Uygula</button>
                  </div>
                </div>
                </>
              )}
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#18181b] text-white dark:bg-white dark:text-black rounded-md text-sm font-medium hover:opacity-90 transition-opacity whitespace-nowrap shadow-sm"
            >
              <Plus className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">Yeni Kayıt</span>
            </button>

            {/* Action Menu (Verileri Sıfırla, XML) */}
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsActionMenuOpen(prev => !prev); setIsCalendarOpen(false); setIsNotificationsOpen(false); }}
                className={`flex items-center justify-center p-2 h-[36px] w-[36px] ${card} border border-slate-200 dark:border-neutral-800 text-sm ${muted} font-medium hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors rounded-md shadow-sm`}
              >
                <MoreVertical className="w-4 h-4 shrink-0" />
              </button>

              {isActionMenuOpen && (
                <div 
                  onClick={e => e.stopPropagation()}
                  className={`absolute top-full right-0 mt-2 w-48 z-50 ${card} shadow-xl rounded-xl border border-slate-100 dark:border-neutral-800 overflow-hidden flex flex-col p-1`}
                >
                  <label className={`flex items-center gap-2 px-3 py-2.5 text-sm ${title} font-medium hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors cursor-pointer rounded-md`}>
                    <Upload className="w-4 h-4 shrink-0" /> XML Yükle
                    <input type="file" accept=".xml" className="hidden" onChange={(e) => { handleImportXML(e); setIsActionMenuOpen(false); }} />
                  </label>
                  <button onClick={() => { handleExportXML(); setIsActionMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-2.5 text-sm ${title} font-medium hover:bg-slate-50 dark:hover:bg-neutral-900 transition-colors rounded-md`}>
                    <Download className="w-4 h-4 shrink-0" /> XML İndir
                  </button>
                  <div className="h-px w-full bg-slate-100 dark:bg-neutral-800 my-1" />
                  <button onClick={() => { handleResetAllData(); setIsActionMenuOpen(false); }} className={`flex items-center gap-2 px-3 py-2.5 text-sm text-rose-500 font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors rounded-md`}>
                    <Trash2 className="w-4 h-4 shrink-0" /> Verileri Sıfırla
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ROW 1: KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Balance */}
          <div className={`${card} p-5 h-36 flex flex-col justify-between group/base`}>
            <div className={`flex items-center gap-2 ${muted}`}>
              <Wallet className="w-4 h-4" />
              <span className="text-sm font-medium">Toplam Bakiye</span>
              <button onClick={() => { setIsEditingBase(true); setBaseInput(baseCapital.toString()); }} className="opacity-0 group-hover/base:opacity-100 transition-opacity p-1 ml-auto hover:bg-slate-100 dark:hover:bg-neutral-800 rounded">
                 <Edit2 className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500" />
              </button>
            </div>
            <div className="flex items-baseline justify-between mt-auto">
              {isEditingBase ? (
                 <div className="flex flex-col">
                   <input 
                     autoFocus 
                     className={`text-2xl md:text-3xl font-bold bg-transparent border-b border-indigo-500 w-full focus:outline-none ${title} tracking-tight tabular-nums pb-1`}
                     value={baseInput}
                     onChange={e => setBaseInput(e.target.value.replace(/[^0-9-]/g, ''))}
                     onBlur={() => { setBaseCapital(Number(baseInput) || 0); setIsEditingBase(false); }}
                     onKeyDown={e => { if (e.key === 'Enter') { setBaseCapital(Number(baseInput) || 0); setIsEditingBase(false); } if (e.key === 'Escape') { setIsEditingBase(false); } }}
                   />
                   <span className="text-[10px] text-indigo-500 block">Başlangıç Nakit / Kasa</span>
                 </div>
              ) : (
                 <h2 className={`text-3xl font-bold tracking-tight ${title}`}>₺{currentNetWorth.toLocaleString('tr-TR',{maximumFractionDigits:0})}</h2>
              )}
              {!isEditingBase && <span className="flex items-center text-emerald-600 dark:text-emerald-500 text-sm font-semibold shrink-0 ml-2"><ArrowUpRight className="w-4 h-4"/>12.5%</span>}
            </div>
          </div>
          {/* Net Profit */}
          <div className={`${card} p-5 h-36 flex flex-col justify-between`}>
            <div className={`flex items-center gap-2 ${muted}`}><TrendingUp className="w-4 h-4" /><span className="text-sm font-medium">Net Nakit Akışı</span></div>
            <div className="flex items-baseline justify-between mt-auto">
              <h2 className={`text-3xl font-bold tracking-tight ${title}`}>₺{(engineData.totalIncome-engineData.totalExpense).toLocaleString('tr-TR',{maximumFractionDigits:0})}</h2>
              <span className="flex items-center text-emerald-600 dark:text-emerald-500 text-sm font-semibold"><ArrowUpRight className="w-4 h-4"/>8.5%</span>
            </div>
          </div>
          {/* Expenses */}
          <div className={`${card} p-5 h-36 flex flex-col justify-between`}>
            <div className={`flex items-center gap-2 ${muted}`}><span className="font-mono font-bold text-sm">₺</span><span className="text-sm font-medium">Toplam Gider</span></div>
            <div className="flex items-baseline justify-between mt-auto">
              <h2 className={`text-3xl font-bold tracking-tight ${title}`}>₺{engineData.totalExpense.toLocaleString('tr-TR',{maximumFractionDigits:0})}</h2>
              <span className="flex items-center text-rose-500 dark:text-rose-400 text-sm font-semibold"><ArrowDownRight className="w-4 h-4"/>5.5%</span>
            </div>
          </div>
          {/* Installments */}
          <div className={`${card} p-5 h-36 flex flex-col justify-between`}>
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${muted}`}><FileText className="w-4 h-4" /><span className="text-sm font-medium">Ödenmemiş Taksitler</span></div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${engineData.unpaidCount > 0 ? 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                {engineData.unpaidCount} bekleyen
              </span>
            </div>
            <h2 className={`text-3xl font-bold tracking-tight ${title} mt-2`}>₺{engineData.totalPendingDebts.toLocaleString('tr-TR',{maximumFractionDigits:0})}</h2>
            <div className={`text-xs font-semibold mt-1 ${engineData.unpaidCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              Bu ayki {engineData.unpaidCount > 0 ? 'ödemelerinizi unutmayın.' : 'tüm taksitleri ödediniz!'}
            </div>
          </div>
        </div>

        {/* ── ROW 2: CHARTS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

          {/* Income Sources */}
          <div className={`lg:col-span-3 ${card} p-6 flex flex-col`}>
            <div className="flex justify-between items-start mb-6">
              <h3 className={`font-semibold ${title}`}>Gelir Kaynakları</h3>
              <button className={`${muted} hover:text-slate-900 dark:hover:text-white`}><ArrowUpRight className="w-4 h-4"/></button>
            </div>
            <p className={`text-sm ${muted} mb-1`}>Seçili Aralık Geliri</p>
            <h2 className={`text-3xl font-bold tracking-tight ${title} mb-4`}>₺{engineData.totalIncome.toLocaleString('tr-TR',{maximumFractionDigits:0})}</h2>
            {/* Segmented bar */}
            <div className="h-2.5 w-full bg-slate-100 dark:bg-neutral-800 flex rounded-full overflow-hidden mb-6 gap-[1px]">
              {Object.entries(engineData.incomeSources).map(([id, amount], i) => {
                const s = recurring.find(r=>r.id===id) || transactions.find(t=>t.id===id);
                if (!s) return null;
                return <div key={i} title={s.name} style={{width:`${engineData.totalIncome?((amount/engineData.totalIncome)*100):0}%`,backgroundColor:(s as any).color||'#10b981'}}/>
              })}
            </div>
            <div className="space-y-3 lg:max-h-[300px] overflow-y-auto pr-2 custom-scroll">
              {Object.entries(engineData.incomeSources).map(([id, amount], i) => {
                const s = recurring.find(r=>r.id===id) || transactions.find(t=>t.id===id);
                if (!s) return null;
                return (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className={`flex items-center gap-2 ${muted}`}><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:(s as any).color||'#10b981'}}/>{s.name}</div>
                    <span className={`font-medium ${title}`}>₺{amount.toLocaleString('tr-TR')}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bar Chart */}
          <div className={`lg:col-span-5 ${card} p-5 flex flex-col`}>
            <h3 className={`font-semibold ${title}`}>Aylık Gider Eğilimi</h3>
            <p className={`text-sm ${muted} mb-4`}>Seçilen zaman periyodu matrisi</p>
            <div className="flex-1 min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={engineData.barData} margin={{top:0,right:0,left:0,bottom:0}} barCategoryGap="25%">
                  <YAxis hide domain={[0, 'auto']} />
                  <RechartsTooltip
                    cursor={{fill: isDark ? '#18181b' : '#f1f5f9'}}
                    contentStyle={{backgroundColor: isDark?'#09090b':'#fff', color: isDark?'#fff':'#000', borderRadius:'8px', border:`1px solid ${isDark?'#27272a':'#e2e8f0'}`}}
                    formatter={(val:any) => `₺${Number(val).toLocaleString('tr-TR',{maximumFractionDigits:0})}`}
                  />
                  {/* Unpaid expenses – dark/black bar (bottom of stack) */}
                  <Bar dataKey="unpaid" stackId="a" name="Ödenmemiş">
                    {engineData.barData.map((entry, index) => (
                      <Cell 
                        key={`unpaid-${index}`} 
                        fill={isDark ? '#fafafa' : '#18181b'}
                        // @ts-ignore
                        radius={entry.paid > 0 ? [0,0,8,8] : [8,8,8,8]} 
                      />
                    ))}
                  </Bar>
                  {/* Paid expenses – light gray bar (top of stack) */}
                  <Bar dataKey="paid" stackId="a" name="Ödenmiş">
                    {engineData.barData.map((entry, index) => (
                      <Cell 
                        key={`paid-${index}`} 
                        fill={isDark ? '#3f3f46' : '#e2e8f0'}
                        // @ts-ignore
                        radius={entry.unpaid > 0 ? [8,8,0,0] : [8,8,8,8]} 
                      />
                    ))}
                  </Bar>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#64748b',fontSize:12}} dy={10}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart – FIX: center label REMOVED, total shown in legend grid to avoid tooltip overlap */}
          <div className={`lg:col-span-4 ${card} p-5 flex flex-col`}>
            <h3 className={`font-semibold ${title}`}>Gider Dağılımı</h3>
            <p className={`text-sm ${muted} mb-2`}>Seçili Periyot Kategorileri</p>
            
            {/* Donut – no absolute overlay text, tooltip won't collide */}
            <div className="w-full h-[180px] mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={engineData.donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={82} paddingAngle={2} dataKey="amount" stroke="none"
                    label={({cx,cy,name,percent}:any)=>{
                      // Top label only for biggest slice
                      if(percent < 0.1) return null;
                      return null; // no inline labels, use grid below
                    }}
                  >
                    {engineData.donutData.map((e,i)=>(<Cell key={i} fill={e.color}/>))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{backgroundColor:isDark?'#09090b':'#fff',color:isDark?'#fff':'#000',borderRadius:'8px',border:`1px solid ${isDark?'#27272a':'#e2e8f0'}`,fontSize:'12px'}}
                    formatter={(val:any,name:any)=>[`₺${Number(val).toLocaleString('tr-TR',{maximumFractionDigits:0})}`,name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Total shown here instead of overlapping center */}
            <div className={`text-center -mt-2 mb-3`}>
              <span className={`text-xl font-bold ${title}`}>₺{(engineData.totalExpense/1000).toFixed(1)}k</span>
              <span className={`text-xs ${muted} ml-1`}>toplam</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {engineData.donutData.slice(0,4).map((cat,i)=>(
                <div key={i} className={`bg-slate-50 dark:bg-neutral-900/50 rounded-lg p-2 flex justify-between items-center`}>
                  <div className={`flex items-center gap-1.5 ${title} truncate mr-1`}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:cat.color}}/>
                    <span className="truncate text-xs font-medium">{cat.name}</span>
                  </div>
                  <span className={`text-xs ${muted} shrink-0`}>{Math.round((cat.amount/engineData.totalExpense)*100)||0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ROW 3: TRANSACTIONS + GOAL ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* Transactions Table – Bulk Actions */}
          <div className={`lg:col-span-8 ${card} p-0 flex flex-col`}>
            <div className="p-5 flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 dark:border-neutral-800">
              <h3 className={`font-bold text-lg tracking-tight ${title}`}>Gerçek Zamanlı İşlemler</h3>
              <div className="flex items-center gap-3">
                {/* Filter Tabs */}
                <div className="flex bg-slate-100 dark:bg-neutral-800/80 p-0.5 rounded-lg border border-slate-200/60 dark:border-neutral-700/50 hidden sm:flex">
                  <button onClick={()=>setTxnFilter('all')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${txnFilter==='all' ? 'bg-white dark:bg-[#18181b] shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-neutral-400 dark:hover:text-neutral-200'}`}>Tümü</button>
                  <button onClick={()=>setTxnFilter('income')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${txnFilter==='income' ? 'bg-white dark:bg-[#18181b] shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 hover:text-emerald-600 dark:text-neutral-400 dark:hover:text-emerald-400'}`}>Gelir</button>
                  <button onClick={()=>setTxnFilter('expense')} className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${txnFilter==='expense' ? 'bg-white dark:bg-[#18181b] shadow-sm text-rose-600 dark:text-rose-400' : 'text-slate-500 hover:text-rose-600 dark:text-neutral-400 dark:hover:text-rose-400'}`}>Gider</button>
                </div>
                {selectedTxns.size > 0 && (
                  <button 
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-md text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5"/> Seçili ({selectedTxns.size}) Kaydı Sil
                  </button>
                )}
              </div>
            </div>
            
            {/* Mobile filter view */}
            <div className="sm:hidden px-5 py-3 border-b border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-[#09090b]">
              <div className="flex bg-slate-200 dark:bg-neutral-800 p-1 rounded-lg w-full">
                <button onClick={()=>setTxnFilter('all')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${txnFilter==='all' ? 'bg-white dark:bg-[#18181b] shadow text-slate-900 dark:text-white' : 'text-slate-500'}`}>Tümü</button>
                <button onClick={()=>setTxnFilter('income')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${txnFilter==='income' ? 'bg-white dark:bg-[#18181b] shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>Gelir</button>
                <button onClick={()=>setTxnFilter('expense')} className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${txnFilter==='expense' ? 'bg-white dark:bg-[#18181b] shadow text-rose-600 dark:text-rose-400' : 'text-slate-500'}`}>Gider</button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[420px]">
              <table className="w-full text-sm text-left table-fixed">
                <thead className={`text-xs font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-neutral-800 sticky top-0 bg-white dark:bg-[#09090b] z-10`}>
                  <tr className="group">
                    <th className="px-4 py-3 w-8">
                      <input 
                        type="checkbox" 
                        className={`rounded border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-opacity ${selectedTxns.size>0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                        checked={selectedTxns.size === engineData.allTxns.length && engineData.allTxns.length > 0}
                        onChange={() => handleToggleSelectAll(engineData.allTxns.map(t=>t.id))}
                      />
                    </th>
                    <th className={`px-2 py-3 ${muted} w-5/12 sm:w-4/12`}>İşlem Adı</th>
                    <th className={`px-2 py-3 ${muted} w-4/12 sm:w-3/12`}>Tarih</th>
                    <th className={`hidden sm:table-cell px-5 py-3 ${muted} w-2/12`}>Tür</th>
                    <th className={`px-2 py-3 text-right ${muted} w-3/12`}>Tutar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/60">
                  {finalFilteredTxns.length === 0 && (
                    <tr><td colSpan={5} className={`px-5 py-8 text-center ${muted}`}>{searchQuery ? 'Arama sonucuna uygun işlem bulunamadı.' : 'Seçili filtreye uygun kayıt yok.'}</td></tr>
                  )}
                  {finalFilteredTxns.map(txn => (
                    <tr key={txn.id} className="hover:bg-slate-50/70 dark:hover:bg-neutral-900/40 transition-colors group">
                      <td className="px-4 py-3.5">
                        <input 
                          type="checkbox" 
                          className={`rounded border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-opacity ${selectedTxns.has(txn.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                          checked={selectedTxns.has(txn.id)}
                          onChange={() => handleToggleTxnSelect(txn.id)}
                        />
                      </td>
                      <td className="px-2 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${txn.type==='income'?'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400':'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                            {txn.avatarPrefix}
                          </div>
                          <div className="min-w-0 overflow-hidden">
                            <span className={`font-semibold ${title} block leading-tight truncate max-w-[90px] sm:max-w-full`}>{txn.name}</span>
                            {txn.isRecurringBase && <span className={`text-[10px] uppercase font-bold ${muted} tracking-wider`}>Sistem Oto.</span>}
                          </div>
                        </div>
                      </td>
                      <td className={`px-3 py-3.5 ${muted} text-xs font-medium whitespace-nowrap`}>{format(new Date(txn.date),'dd MMM yyyy',{locale:tr})}</td>
                      <td className={`hidden sm:table-cell px-5 py-3.5`}>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${txn.type==='income'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400':'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'}`}>
                          {txn.type==='income'?'Gelir':'Gider'}
                        </span>
                      </td>
                      <td className={`px-2 py-3.5 text-right font-semibold tabular-nums ${txn.type==='income'?'text-emerald-600 dark:text-emerald-400':title}`}>
                        <div className="flex items-center justify-end gap-1">
                          ₺{Math.abs(txn.amount).toLocaleString('tr-TR',{maximumFractionDigits:0})}
                          
                          {/* ⋮ menu – opacity-0 by default, visible on row hover */}
                          <div className="relative ml-1">
                            <button
                              onClick={e => { e.stopPropagation(); setActiveTxnMenu(activeTxnMenu===txn.id?null:txn.id); }}
                              className={`p-1 rounded-md ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100`}
                            >
                              <MoreVertical className="w-3.5 h-3.5"/>
                            </button>
                            {activeTxnMenu===txn.id && (
                              <div className="absolute right-7 top-0 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 overflow-hidden min-w-[100px]">
                                <button
                                  onClick={e => { 
                                    e.stopPropagation(); 
                                    if(txn.isRecurringBase) setHiddenProjections(prev=>[...prev, txn.id]);
                                    else handleTxnDelete(txn.id);
                                    setActiveTxnMenu(null);
                                  }}
                                  className="px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 w-full text-left font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5"/> Sil
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Goals + Installments */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Goal – editable */}
            <div className={`${card} p-6 flex flex-col`}>
              <div className="flex justify-between items-start mb-1">
                <div>
                  <h3 className={`font-bold text-base tracking-tight ${title}`}>Birikim Hedefi</h3>
                  <p className={`text-sm ${muted} font-medium`}>%{progressPercent.toFixed(1)} İlerleme</p>
                </div>
                <button onClick={()=>{setIsEditingGoal(true);setGoalInputValue(savingGoal.toString());}} className={`${muted} hover:text-slate-900 dark:hover:text-white`}><Edit2 className="w-3.5 h-3.5"/></button>
              </div>
              <div className="mt-4 mb-4">
                {isEditingGoal ? (
                  <div className="flex items-center gap-2">
                    <span className={muted}>₺</span>
                    <input autoFocus type="number" value={goalInputValue}
                      onChange={e=>setGoalInputValue(e.target.value)}
                      onFocus={e=>e.target.select()}
                      onBlur={handleGoalSave}
                      onKeyDown={e=>{if(e.key==='Enter')handleGoalSave();if(e.key==='Escape')setIsEditingGoal(false);}}
                      className={`w-[160px] bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-700 rounded-md px-2 py-1 text-sm font-bold ${title} focus:outline-none focus:border-indigo-500`}
                    />
                  </div>
                ) : (
                  <h2 className={`text-3xl font-bold tracking-tight ${title} flex items-baseline gap-2 cursor-pointer`} onClick={()=>{setIsEditingGoal(true);setGoalInputValue(savingGoal.toString());}}>
                    ₺{(currentNetWorth/1000).toLocaleString('tr-TR',{maximumFractionDigits:1})}k
                    <span className={`text-sm ${muted} font-medium`}>/ {(savingGoal/1000).toLocaleString('tr-TR',{maximumFractionDigits:0})}k</span>
                  </h2>
                )}
              </div>
              <div className="h-3 w-full bg-slate-200 dark:bg-neutral-800 rounded-full overflow-hidden shadow-inner">
                <div className="h-full bg-[#18181b] dark:bg-white transition-all duration-700" style={{width:`${progressPercent}%`}}/>
              </div>
            </div>

            {/* Installments and Liabilities Sync */}
            <div className={`${card} p-6 flex-1 flex flex-col`}>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className={`font-bold text-base tracking-tight ${title}`}>Aktif Taksitler & Giderler</h3>
                  <p className={`text-sm ${muted} mt-0.5`}>Toplam {engineData.activeList.length} aktif yükümlülük</p>
                </div>
                <button onClick={()=>setIsModalOpen(true)} className={`flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-neutral-700 rounded-md text-xs font-medium ${title} hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors`}>
                  <Plus className="w-3.5 h-3.5"/> Ekle
                </button>
              </div>
              <div className="space-y-3">
                {filteredActiveList.length === 0 && <p className={`text-center py-4 text-sm ${muted}`}>{searchQuery ? 'Arama sonucuna uygun aktif yükümlülük bulunamadı.' : 'Aktif taksit veya gider yok.'}</p>}
                
                {filteredActiveList.map(item => (
                  <div key={item.id} className={`group flex justify-between items-center p-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors cursor-pointer ${item.isPaid ? 'opacity-40 grayscale' : ''}`}>
                    <div className="min-w-0 pr-2">
                      <p className={`font-semibold tracking-tight text-sm truncate ${item.isPaid ? muted : title}`}>
                        {editingDueDay?.id === item.id ? (
                          <input 
                            autoFocus type="number" min="1" max="31"
                            value={dueDayEditValue}
                            onChange={e=>setDueDayEditValue(Number(e.target.value))}
                            onBlur={handleDueDaySave}
                            onKeyDown={e=>{if(e.key==='Enter')handleDueDaySave();if(e.key==='Escape')setEditingDueDay(null);}}
                            className="inline-block mr-2 w-8 h-5 text-center text-[10px] leading-5 font-bold rounded border border-indigo-500 focus:outline-none bg-white dark:bg-neutral-900 [&::-webkit-inner-spin-button]:appearance-none [appearance:textfield]"
                          />
                        ) : (
                          <span 
                            title="Ödeme gününü değiştirmek için tıklayın"
                            onClick={(e)=>{e.stopPropagation();setEditingDueDay({id:item.id, type:item.type as any});setDueDayEditValue(item.dueDay||1);}}
                            className={`inline-block mr-2 w-5 h-5 text-center text-[10px] leading-5 font-bold rounded cursor-pointer hover:ring-1 hover:ring-indigo-500 transition-all ${item.isPaid ? 'bg-slate-100 text-slate-400 dark:bg-neutral-900 dark:text-neutral-500' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'}`}>
                            {item.dueDay}
                          </span>
                        )}
                        {item.name}
                      </p>
                      <p className={`text-xs text-rose-500 font-bold mt-0.5 ml-7`}>₺{item.amount.toLocaleString('tr-TR',{maximumFractionDigits:0})} {item.type==='installment'?'/ ay':''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        {item.type==='installment' ? (
                          <>
                            <p className={`text-sm font-bold ${title}`}>₺{item.remaining?.toLocaleString('tr-TR',{maximumFractionDigits:0})}</p>
                            <p className={`text-xs ${muted} mt-0.5`}>Kalan</p>
                          </>
                        ) : (
                          <>
                            <p className={`text-sm font-bold ${title}`}>Düzenli</p>
                            <p className={`text-xs ${muted} mt-0.5`}>Tür</p>
                          </>
                        )}
                      </div>
                      <div className="relative">
                        <button onClick={(e)=>{e.stopPropagation();setActiveTxnMenu(activeTxnMenu===item.id?null:item.id);}} className={`p-1 rounded-md ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity`}>
                          <MoreVertical className="w-3.5 h-3.5"/>
                        </button>
                        {activeTxnMenu===item.id && (
                          <div className="absolute right-0 top-7 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 overflow-hidden w-[160px]">
                            {!item.isPaid && (
                              <button onClick={()=>{handleMarkPaid(item.id);}} className="px-4 py-2.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-2 w-full font-medium">
                                <FileText className="w-3.5 h-3.5"/> Ödendi İşaretle
                              </button>
                            )}
                            <button onClick={()=>{
                              if(item.type==='installment') setInstallments(prev=>prev.filter(i=>`inst-${i.id}`!==item.id));
                              else setRecurring(prev=>prev.filter(r=>`rec-${r.id}`!==item.id));
                              setActiveTxnMenu(null);
                            }} className="px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 w-full font-medium border-t border-slate-100 dark:border-neutral-800">
                              <Trash2 className="w-3.5 h-3.5"/> Tamamen Kaldır
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── ROW 4: RECURRING MATRIX ── */}
        <div className={`${card} overflow-hidden`}>
          <div className="p-6 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/30 dark:bg-transparent">
            {/* Header Size increased to text-lg instead of text-sm */}
            <h2 className={`text-lg font-bold tracking-tight ${title}`}>Yeni Tekrarlayan Motor (Yıl Sonu Odaklı)</h2>
            <p className={`text-xs ${muted} mt-0.5`}>Sabit gelir ve giderlerin ay bazında dağılımı. Rakama veya kural ismine tıklayarak düzenleyin.</p>
          </div>
          <div className="overflow-x-auto">
            {/* table-fixed and min-w to prevent cells from resizing wildly */}
            <table className="w-full text-sm text-left whitespace-nowrap table-fixed min-w-[1200px]">
              <thead className={`text-[11px] uppercase tracking-wider ${muted} border-b border-slate-100 dark:border-neutral-800`}>
                <tr>
                  <th className="sticky left-0 z-20 bg-white dark:bg-[#09090b] px-5 py-3 font-semibold w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)]">Kural / İşlem</th>
                  {engineData.matrixColumns.map(m => <th key={m} className="px-4 py-3 font-semibold text-right w-[110px]">{m}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-neutral-800/60">
                
                {filteredMatrixRows.length === 0 && (
                  <tr>
                    <td colSpan={engineData.matrixColumns.length + 1} className={`px-4 py-8 text-center ${muted}`}>
                      {searchQuery ? 'Arama sonucuna uygun düzenli gider/gelir bulunamadı.' : 'Kayıt bulunamadı.'}
                    </td>
                  </tr>
                )}
                {/* Unified Matrix Rows (Recurring & One-Time Sorted) */}
                {filteredMatrixRows.map(item => (
                  <tr key={item.id} 
                    draggable={!item.isSystemRow}
                    onDragStart={(e) => { if(!item.isSystemRow) handleDragStart(e, item.id); }}
                    onDragOver={(e) => { if(!item.isSystemRow) handleDragOver(e); }}
                    onDrop={(e) => { if(!item.isSystemRow) handleDrop(e, item.id); }}
                    className={`${item.isSystemRow ? 'bg-slate-50 dark:bg-neutral-900/40 border-t-2 border-slate-200 dark:border-neutral-800' : 'hover:bg-slate-50/60 dark:hover:bg-neutral-900/30'} transition-colors group ${!item.isSystemRow ? 'cursor-grab active:cursor-grabbing' : ''} ${draggedId === item.id ? 'opacity-50 grayscale bg-slate-100 dark:bg-neutral-800' : ''}`}
                  >
                    <td className={`sticky left-0 z-10 ${item.isSystemRow ? 'bg-slate-50 dark:bg-neutral-900/40' : 'bg-white dark:bg-[#09090b]'} px-5 py-4 font-medium ${item.isSystemRow ? 'text-slate-900 dark:text-white font-bold' : title} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] ${!item.isSystemRow ? 'group-hover:bg-slate-50/60 dark:group-hover:bg-neutral-900/30' : ''} transition-colors`}>
                      <div className="flex items-center gap-2 group/name">
                        {item.type==='income'
                          ? <ArrowUpRight className={`w-3.5 h-3.5 ${item.isSystemRow ? 'text-indigo-500' : 'text-emerald-500'} shrink-0`}/>
                          : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 shrink-0"/>}
                        
                        {/* Editable Rule Names (only for recurring base) */}
                        {item.isRecurring && editingRuleId === item.baseItem.id ? (
                          <input autoFocus value={ruleNameValue}
                            onChange={e=>setRuleNameValue(e.target.value)}
                            onBlur={handleRuleNameSave}
                            onKeyDown={e=>{if(e.key==='Enter')handleRuleNameSave();if(e.key==='Escape'){setEditingRuleId(null);}}}
                            className="bg-white dark:bg-neutral-900 border border-indigo-500 rounded px-2 py-0.5 w-[140px] text-sm focus:outline-none"
                          />
                        ) : (
                          <span 
                            onClick={()=>{if(item.isRecurring){setEditingRuleId(item.baseItem.id);setRuleNameValue(item.name);}}} 
                            className={`transition-colors truncate block ${item.isRecurring ? 'cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400' : ''}`}
                          >
                            {item.name}
                          </span>
                        )}

                        {/* Actions: Move Up, Move Down, Delete */}
                        {!item.isSystemRow && (
                          <div className="relative">
                            <button onClick={e=>{e.stopPropagation();setActiveMatrixMenu(activeMatrixMenu===item.id?null:item.id);}} className={`p-0.5 rounded ${muted} hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity`}>
                              <MoreVertical className="w-3.5 h-3.5"/>
                            </button>
                            {activeMatrixMenu===item.id && (
                              <div className="absolute left-6 top-0 bg-white dark:bg-[#09090b] border border-slate-200 dark:border-neutral-800 rounded-lg shadow-lg z-50 overflow-hidden w-[140px]">
                                <button onClick={()=>handleOrderChange(item.id, 'up')} className="px-3 py-2 text-xs text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center w-full font-medium whitespace-nowrap">
                                  <span>↑ Yukarı Taşı</span>
                                </button>
                                <button onClick={()=>handleOrderChange(item.id, 'down')} className="px-3 py-2 text-xs text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 flex items-center w-full font-medium whitespace-nowrap border-b border-slate-100 dark:border-neutral-800">
                                  <span>↓ Aşağı Taşı</span>
                                </button>
                                {item.isRecurring ? (
                                  <button onClick={()=>handleRecurringDelete(item.baseItem.id)} className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 w-full font-medium whitespace-nowrap">
                                    <Trash2 className="w-3.5 h-3.5"/> Sil
                                  </button>
                                ) : (
                                  <button onClick={()=>handleTxnDeleteByName(item.name)} className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 w-full font-medium whitespace-nowrap">
                                    <Trash2 className="w-3.5 h-3.5"/> Sil
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Matrix Data Cells */}
                    {engineData.matrixColumns.map((month, idx) => {
                      const val = item.cells[idx];
                      // Check if this is the current month column
                      const colDate = parse(month, 'MMM yy', new Date(), { locale: tr });
                      const now = new Date();
                      const isCurrentMonthCol = colDate.getMonth() === now.getMonth() && colDate.getFullYear() === now.getFullYear();
                      const isPastMonth = colDate.getFullYear() < now.getFullYear() || (colDate.getFullYear() === now.getFullYear() && colDate.getMonth() < now.getMonth());
                      
                      // If it's a recurring expense and dueDay already passed this month → treat as paid/locked
                      const isCurrentMonthPaid = item.isRecurring && item.type === 'expense' && isCurrentMonthCol && (item.baseItem?.dueDay || 1) < now.getDate();
                      const isEditing = !isCurrentMonthPaid && editingCell?.monthIdx===idx && editingCell?.itemId===(item.isRecurring ? item.baseItem.id : item.name);
                      return (
                        <td key={month} className={`px-4 py-4 text-right ${isPastMonth ? 'opacity-50' : ''}`}>
                          <div className="relative h-6 flex justify-end items-center">
                            {isEditing ? (
                              <input autoFocus type="text"
                                className={`w-[80px] bg-white dark:bg-[#18181b] border border-indigo-500 rounded px-2 py-0.5 text-xs text-right focus:outline-none`}
                                value={editValue}
                                onChange={e=>setEditValue(e.target.value)}
                                onBlur={handleCellSave}
                                onKeyDown={e=>{if(e.key==='Enter')handleCellSave();if(e.key==='Escape')setEditingCell(null);}}
                              />
                            ) : (
                              <span 
                                onClick={(e) => {
                                  if (item.isSystemRow) return;
                                  const isAccountRow = item.name.toLowerCase() === 'hesap' || item.name.toLowerCase().includes('bakiye');
                                  if (isAccountRow && !isCurrentMonthCol) return; // Only allow editing Account balance on CURRENT month
                                  if (isCurrentMonthPaid) return;
                                  
                                  e.stopPropagation();
                                  setIsCalendarOpen(false); 
                                  setIsActionMenuOpen(false);
                                  setActiveTxnMenu(null);
                                  setActiveMatrixMenu(null);
                                  setEditingCell({ 
                                    monthIdx: idx, 
                                    itemId: item.isRecurring ? item.baseItem.id : item.name, 
                                    isRecurring: item.isRecurring, 
                                    txnType: item.type 
                                  });
                                  setEditValue(val?.toString() || '');
                                }}
                                className={`rounded px-1.5 py-0.5 -mr-1.5 transition-colors ${item.isSystemRow ? 'pointer-events-none' : ''} ${
                                  isCurrentMonthPaid
                                    ? 'text-slate-400 dark:text-neutral-600 line-through cursor-default'
                                    : val !== undefined
                                      ? 'font-medium cursor-pointer hover:bg-slate-200 dark:hover:bg-neutral-800'
                                      : 'text-slate-300 dark:text-neutral-700 hover:text-slate-400 cursor-pointer'
                                }`}
                              >
                                {val !== undefined 
                                  ? `₺${val.toLocaleString('tr-TR')}` 
                                  : <span className="opacity-30">-</span>}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 dark:border-neutral-800 bg-slate-50/80 dark:bg-neutral-900/50">
                <tr>
                  <td className={`sticky left-0 z-10 bg-slate-50/80 dark:bg-neutral-900/50 px-5 py-3.5 font-bold ${title} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)]`}>
                    Aylık Net
                  </td>
                  {engineData.matrixColumns.map((m, idx) => {
                    const v = engineData.netFlows[idx] || 0;
                    return (
                      <td key={`net-${m}`} className={`px-4 py-3.5 text-right font-bold tracking-tight ${v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {v >= 0 ? '+' : '-'}₺{Math.abs(v).toLocaleString('tr-TR', {maximumFractionDigits:0})}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className={`sticky left-0 z-10 bg-slate-50/80 dark:bg-neutral-900/50 px-5 py-3.5 font-bold ${title} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] border-t border-slate-200/60 dark:border-neutral-800/60`}>
                    Dönem Başı Nakit (Açılış)
                  </td>
                  {engineData.matrixColumns.map((m, idx) => {
                    let opening = baseCapital;
                    for (let i = 0; i < idx; i++) opening += (engineData.netFlows[i] || 0);
                    return (
                      <td key={`open-${m}`} className={`px-4 py-3.5 text-right font-medium text-slate-500 dark:text-neutral-400 border-t border-slate-200/60 dark:border-neutral-800/60`}>
                        ₺{opening.toLocaleString('tr-TR', {maximumFractionDigits:0})}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className={`sticky left-0 z-10 bg-slate-50/80 dark:bg-neutral-900/50 px-5 py-3.5 font-bold ${title} shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] dark:shadow-[2px_0_5px_-2px_rgba(255,255,255,0.02)] border-t border-slate-200/60 dark:border-neutral-800/60`}>
                    Kümülatif Bakiye (Tahmini)
                  </td>
                  {engineData.matrixColumns.map((m, idx) => {
                    let cumulative = baseCapital;
                    for (let i = 0; i <= idx; i++) cumulative += (engineData.netFlows[i] || 0);
                    return (
                      <td key={`cum-${m}`} className={`px-4 py-3.5 text-right font-bold ${title} border-t border-slate-200/60 dark:border-neutral-800/60`}>
                        ₺{cumulative.toLocaleString('tr-TR', {maximumFractionDigits:0})}
                      </td>
                    );
                  })}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      </div>

      <TransactionModal isOpen={isModalOpen} onClose={()=>setIsModalOpen(false)} onSave={handleTransactionSave}/>
    </div>
  );
}
