'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, ChevronRight, CalendarDays, WalletCards, ArrowRightLeft, Repeat, Coins, Bell } from 'lucide-react';
import { useLanguage } from '@/components/LanguageProvider';

export type TransactionPayload = {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  description: string;
  isRecurring: boolean;
  repeatUntil?: string;
  isInstallment: boolean;
  installmentCount?: number;
  dueDay?: number;
  date?: string;
  isReminder?: boolean;
};

export default function TransactionModal({ 
  isOpen, 
  onClose, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSave: (data: TransactionPayload) => void;
}) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'expense' | 'income' | 'transfer'>('expense');
  const [paymentType, setPaymentType] = useState<'one-time' | 'recurring'>('one-time');
  const [isReminder, setIsReminder] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // Recurring state
  const [repeatUntil, setRepeatUntil] = useState('');
  
  // Installment state
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);
  
  const [dueDay, setDueDay] = useState<number>(1);
  const [transactionDate, setTransactionDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    setIsSaving(true);
    onSave({
      type: activeTab,
      amount: parseFloat(amount),
      description,
      isRecurring: paymentType === 'recurring',
      repeatUntil: paymentType === 'recurring' ? repeatUntil : undefined,
      isInstallment: paymentType === 'one-time' && isInstallment && activeTab === 'expense',
      installmentCount: (paymentType === 'one-time' && isInstallment && activeTab === 'expense') ? installmentCount : undefined,
      dueDay: (activeTab === 'expense' && (paymentType === 'recurring' || isInstallment)) ? dueDay : undefined,
      date: paymentType === 'one-time' ? new Date(transactionDate).toISOString() : undefined,
      isReminder: isReminder
    });
    setIsSaving(false);
    
    // Reset state for next open
    setAmount('');
    setDescription('');
    setIsInstallment(false);
    setIsReminder(false);
    setPaymentType('one-time');
    setDueDay(1);
    const d = new Date();
    setTransactionDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  const isSaveDisabled = isSaving || !amount || !description || (paymentType === 'recurring' && !repeatUntil);

  const tabLabel = activeTab === 'expense' ? t('Gider') : activeTab === 'income' ? t('Gelir') : t('Transfer');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {t('Yeni')} {tabLabel} {t('Kaydı')}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">{t('Finansal hareketlerinizi detaylandırın.')}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto">
          {/* Main Transaction Tabs */}
          <div className="px-5 pt-5 pb-2">
            <div className="flex p-1 bg-slate-100 rounded-lg border border-slate-200">
              {[{id: 'expense', label: t('Gider'), icon: <WalletCards className="w-4 h-4" />}, 
                {id: 'income', label: t('Gelir'), icon: <CheckCircle2 className="w-4 h-4" />}, 
                {id: 'transfer', label: t('Transfer'), icon: <ArrowRightLeft className="w-4 h-4" />}]
                .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id as any); setIsInstallment(false); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-sm font-medium rounded-md transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200' 
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-5">
            
            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 leading-none">
                {t('İşlem Tutarı')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-medium">₺</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-8 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700 leading-none">
                {t('Açıklama / Başlık')}
              </label>
              <input 
                type="text" 
                placeholder={t('Örn. Mac Studio Alımı, Kira Geliri vs.')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 transition-colors shadow-sm"
              />
            </div>

            {/* Recurrence Type Toggle */}
            <div className="space-y-1.5 pt-2">
               <label className="text-sm font-medium text-slate-700 leading-none block mb-2">{t('İşlem Tipi & Sıklığı')}</label>
               <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div 
                    onClick={() => { setPaymentType('one-time'); setRepeatUntil(''); setIsInstallment(false); }}
                    className={`cursor-pointer border rounded-lg p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 transition-all ${paymentType === 'one-time' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                     <Coins className={`w-4 h-4 sm:w-5 sm:h-5 ${paymentType === 'one-time' ? 'text-indigo-600' : 'text-slate-400'}`} />
                     <div>
                       <p className={`text-xs sm:text-sm font-medium leading-none ${paymentType === 'one-time' ? 'text-indigo-900' : 'text-slate-700'}`}>{t('Tek Sefer')}</p>
                       <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{t('Sadece bu aya özel.')}</p>
                     </div>
                  </div>
                  <div 
                    onClick={() => { setPaymentType('recurring'); setIsInstallment(false); }}
                    className={`cursor-pointer border rounded-lg p-2.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 transition-all ${paymentType === 'recurring' ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-slate-300'}`}
                  >
                     <Repeat className={`w-4 h-4 sm:w-5 sm:h-5 ${paymentType === 'recurring' ? 'text-indigo-600' : 'text-slate-400'}`} />
                     <div>
                       <p className={`text-xs sm:text-sm font-medium leading-none ${paymentType === 'recurring' ? 'text-indigo-900' : 'text-slate-700'}`}>{t('Düzenli')}</p>
                       <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{t('Aylık otomatik işler.')}</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Reminder Toggle */}
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-lg overflow-hidden transition-all duration-300">
               <div 
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-amber-100/30"
                  onClick={() => setIsReminder(!isReminder)}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-md text-amber-600 border border-amber-200 shadow-sm">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-900">{t('Sadece Hatırlatıcı (Bakiye Etkilemez)')}</p>
                      <p className="text-xs text-amber-700/70 mt-0.5">{t('Ödendi işaretlenene kadar bakiyeden düşmez.')}</p>
                    </div>
                  </div>
                  <div className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 ${isReminder ? 'bg-amber-500' : 'bg-slate-300'}`}>
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${isReminder ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
               </div>
            </div>

            {/* Conditional: Date Target for One-Time */}
            {paymentType === 'one-time' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 pt-2">
                <label className="text-sm font-medium text-slate-700 leading-none">
                  {t('İşlem Tarihi')}
                </label>
                <input 
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-sm"
                />
              </div>
            )}

            {/* Conditional: Repeat Until Date */}
            {paymentType === 'recurring' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                <label className="text-sm font-medium text-slate-700 leading-none">
                  {t('Şu Tarihe Kadar Tekrarla')} <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="date" 
                  value={repeatUntil}
                  onChange={(e) => setRepeatUntil(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-sm"
                />
              </div>
            )}

            {/* Conditional: Due Date for Liabilities (Recurring Expense or Installment) */}
            {((paymentType === 'recurring' && activeTab === 'expense') || (paymentType === 'one-time' && isInstallment && activeTab === 'expense')) && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 pt-2">
                <label className="text-sm font-medium text-slate-700 leading-none">
                  {t('Her Ayın Hangi Günü Ödenecek? (1-31)')}
                </label>
                <input 
                  type="number" 
                  min="1" max="31"
                  value={dueDay}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= 31) setDueDay(val);
                    else if (e.target.value === '') setDueDay(1);
                  }}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-sm"
                />
              </div>
            )}

            {/* Conditional: Installments (Only if Expense and One-Time) */}
            {paymentType === 'one-time' && activeTab === 'expense' && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden transition-all duration-300 animate-in fade-in">
                 <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                    onClick={() => setIsInstallment(!isInstallment)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white rounded-md text-slate-700 border border-slate-200 shadow-sm">
                        <CalendarDays className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{t('Taksitlendir')}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t('Bu ödemeyi gelecek aylara dağıt.')}</p>
                      </div>
                    </div>
                    <div className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 ${isInstallment ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${isInstallment ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                 </div>

                 <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isInstallment ? 'max-h-40 border-t border-slate-200 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 space-y-3">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('Taksit Sayısı (Ay)')}</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[3, 6, 9, 12].map(num => (
                          <button 
                            key={num}
                            onClick={() => setInstallmentCount(num)}
                            className={`h-9 rounded-md text-sm font-medium transition-colors border shadow-sm ${
                              installmentCount === num 
                              ? 'bg-indigo-600 text-white border-indigo-600' 
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {num}
                          </button>
                        ))}
                      </div>
                      {isInstallment && amount && !isNaN(parseFloat(amount)) && (
                        <p className="text-xs text-slate-500 mt-3">
                          {t('Bu işlem aylık')} <span className="text-indigo-600 font-medium">₺{(parseFloat(amount)/installmentCount).toFixed(2)}</span> {t('olarak yansıyacaktır.')}.
                        </p>
                      )}
                    </div>
                 </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 mt-auto">
          <button 
            onClick={onClose}
            className="h-9 px-4 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-200 transition-all border border-transparent"
          >
            {t('İptal')}
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="h-9 px-4 rounded-md text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isSaving ? t('Kaydediliyor...') : t('Kaydet')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
