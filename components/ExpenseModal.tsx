'use client';

import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

export default function ExpenseModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [amount, setAmount] = useState('');
  const [title, setTitle] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !amount) return;
    
    setIsSubmitting(true);
    
    try {
      const parsedAmount = parseFloat(amount.replace(/,/g, ''));
      
      const { data: expenseData, error: expenseError } = await supabase
        .from('expenses')
        .insert({
          title: title,
          total_amount: parsedAmount,
          date: new Date().toISOString(),
          is_installment: isInstallment,
          installment_count: isInstallment ? installmentCount : 1,
          user_id: 'CURRENT_USER_ID',
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      if (isInstallment && expenseData) {
        const monthlyAmount = parsedAmount / installmentCount;
        const installmentsToInsert = [];
        
        for (let i = 1; i <= installmentCount; i++) {
          const futureDate = new Date();
          futureDate.setMonth(futureDate.getMonth() + i);
          
          installmentsToInsert.push({
            expense_id: expenseData.id,
            user_id: 'CURRENT_USER_ID',
            amount: monthlyAmount,
            due_month: futureDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }

        const { error: installmentError } = await supabase
          .from('installments')
          .insert(installmentsToInsert);

        if (installmentError) throw installmentError;
      }

      setAmount('');
      setTitle('');
      setIsInstallment(false);
      onClose();

    } catch (error) {
      console.error("Error creating expense:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40 backdrop-blur-sm p-4 sm:p-0">
      <div className="bg-white dark:bg-neutral-900 w-full sm:max-w-md rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden transform transition-all">
        <div className="flex justify-between items-center p-6 pb-2">
          <h3 className="text-xl font-medium tracking-tight text-neutral-900 dark:text-neutral-100">
            New Transaction
          </h3>
          <button 
            onClick={onClose}
            className="p-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-full text-neutral-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 pt-4 space-y-6">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400 ml-1">Total Amount (₺)</label>
            <input 
              type="text"
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-transparent text-5xl font-semibold tracking-tight tabular-nums outline-none mt-2 text-neutral-900 dark:text-white placeholder-neutral-300 dark:placeholder-neutral-700 transition-colors"
            />
          </div>

          <div className="relative">
            <input 
              type="text"
              placeholder="What was this for? (e.g. Mac Studio)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-100 dark:bg-neutral-800/50 border border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 rounded-xl px-4 py-3.5 outline-none text-neutral-900 dark:text-neutral-100 transition-all font-medium placeholder-neutral-400"
            />
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/30 rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden transition-all duration-300">
            <div 
              className="px-4 py-4 flex items-center justify-between cursor-pointer active:bg-neutral-100 dark:active:bg-neutral-800/50"
              onClick={() => setIsInstallment(!isInstallment)}
            >
              <div>
                <p className="font-medium text-neutral-900 dark:text-neutral-100">Split into Installments</p>
                <p className="text-xs text-neutral-500 mt-0.5">Record as future liabilities</p>
              </div>
              <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ease-in-out flex items-center ${isInstallment ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-neutral-700'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ease-in-out ${isInstallment ? 'translate-x-6' : 'translate-x-0'}`} />
              </div>
            </div>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isInstallment ? 'max-h-32 opacity-100 border-t border-neutral-200 dark:border-neutral-800' : 'max-h-0 opacity-0'}`}>
              <div className="p-4 bg-neutral-100/50 dark:bg-neutral-800/50 flex space-x-2 overflow-x-auto">
                {[3, 6, 9, 12].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setInstallmentCount(num)}
                    className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors border ${
                      installmentCount === num 
                        ? 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-900 dark:text-white shadow-sm' 
                        : 'bg-transparent border-transparent text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                    }`}
                  >
                    {num} Months
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting || !title || !amount}
            className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 dark:bg-white dark:hover:bg-neutral-200 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-500 text-white dark:text-neutral-900 disabled:cursor-not-allowed py-4 rounded-2xl font-medium text-lg transition-colors mt-4"
          >
            {isSubmitting ? 'Saving...' : (
              <>
                <Check className="w-5 h-5" />
                Confirm Transaction
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
