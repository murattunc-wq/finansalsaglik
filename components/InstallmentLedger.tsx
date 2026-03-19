'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, Clock, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

export type Installment = {
  id: string;
  source: string;
  description: string;
  totalAmount: number;
  remainingAmount: number;
  monthlyPayment: number;
  remainingMonths: number;
  nextDueDate: string;
  status: 'active' | 'completed';
};

export default function InstallmentLedger({ data, onManualAdd }: { data: Installment[], onManualAdd: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const itemsPerPage = 5;

  const filtered = data.filter(item => item.description.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const currentView = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm" onClick={() => setActiveDropdown(null)}>
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">Aylık Taksit & Düzenli Gider Dağılımları</h2>
          <p className="text-sm text-slate-500">Gelecek aylara sarkan tüm borçlarınızı (Kredi, Kasko, Vergi vb.) takip edin.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Ara..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-md h-9 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all shadow-sm"
            />
          </div>
          <button 
            onClick={onManualAdd}
            className="h-9 px-3 border border-slate-200 rounded-md bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center shadow-sm"
          >
            Manuel Ekle
          </button>
        </div>
      </div>

      <div className="w-full overflow-auto min-h-[300px]">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-5 py-4 font-medium flex items-center gap-1 cursor-pointer hover:text-slate-900 transition-colors">
                Açıklama <ArrowUpDown className="h-3 w-3" />
              </th>
              <th className="px-5 py-4 font-medium">Kaynak</th>
              <th className="px-5 py-4 font-medium text-right">Aylık Tutar</th>
              <th className="px-5 py-4 font-medium text-right">Kalan Borç</th>
              <th className="px-5 py-4 font-medium text-center">Sonraki Ödeme</th>
              <th className="px-5 py-4 font-medium text-center">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentView.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500">Gösterilecek kayıt bulunamadı.</td>
              </tr>
            ) : currentView.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50 transition-colors group text-slate-700">
                <td className="px-5 py-4 font-medium text-slate-900">
                  {item.description}
                  <div className="text-xs text-slate-500 mt-0.5 font-normal">
                    {item.remainingMonths} ay kaldı
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    {item.source}
                  </span>
                </td>
                <td className="px-5 py-4 text-right font-medium text-rose-600">
                  ₺{item.monthlyPayment.toLocaleString('tr-TR')}
                </td>
                <td className="px-5 py-4 text-right">
                  ₺{item.remainingAmount.toLocaleString('tr-TR')}
                  <div className="text-xs text-slate-500 mt-0.5 font-normal">
                    Toplam: ₺{item.totalAmount.toLocaleString('tr-TR')}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex justify-center items-center">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700 shadow-sm">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(item.nextDueDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric'})}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-4 text-center relative">
                   <button 
                     onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === item.id ? null : item.id); }}
                     className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                   >
                     <MoreHorizontal className="w-5 h-5" />
                   </button>
                   
                   {activeDropdown === item.id && (
                     <div className="absolute right-[4.5rem] top-1/2 -translate-y-1/2 mt-0 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1" onClick={e => e.stopPropagation()}>
                       <div className="px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-100">İşlemler</div>
                       <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors">Taksidi Düzenle</button>
                       <button className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors">Erken Ödeme</button>
                       <button className="w-full text-left px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors font-medium">Kaydı İptal Et</button>
                     </div>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-slate-200 flex justify-between items-center text-sm">
        <span className="text-slate-500">Toplam {filtered.length} kayıttan {filtered.length === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1} ile {Math.min(currentPage * itemsPerPage, filtered.length)} arası.</span>
        <div className="flex items-center gap-2">
           <button 
             disabled={currentPage === 1}
             onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
             className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
           >
             <ChevronLeft className="w-4 h-4" /> Önceki
           </button>
           <button 
             disabled={currentPage === totalPages}
             onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
             className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm transition-all"
           >
             Sonraki <ChevronRight className="w-4 h-4" />
           </button>
        </div>
      </div>

    </div>
  );
}
