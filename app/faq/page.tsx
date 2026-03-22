'use client';

import React, { useState } from 'react';
import { useLanguage } from '@/components/LanguageProvider';
import { ChevronDown, ArrowLeft, Search, BookOpen, Shield, CreditCard, PenTool } from 'lucide-react';
import Link from 'next/link';

type FAQItem = {
  id: string;
  icon: React.ReactNode;
  q: { tr: string; en: string };
  a: { tr: string; en: string };
};

const FAQS: FAQItem[] = [
  {
    id: '1',
    icon: <CreditCard className="w-5 h-5 text-indigo-500" />,
    q: { 
      tr: "Kokpit'e nasıl yeni bir gelir veya gider eklerim?", 
      en: "How do I add a new income or expense to the Dashboard?" 
    },
    a: { 
      tr: "Sağ üst köşedeki '+ Yeni Kayıt' butonuna tıklayarak açılan pencereden işleminizin detaylarını, tutarını ve tarihini girebilirsiniz. Tek seferlik ödemeler Gerçek Zamanlı İşlemler tablosuna, Düzenli (Aylık) olanlar ise en alttaki Tekrarlayan Motor matrisine işlenir.", 
      en: "Click the '+ Yeni Kayıt' (New Record) button in the top right corner. Fill in the transaction details, amount, and date. One-time payments go to the Real-Time Transactions table, while Recurring (Monthly) ones are injected directly into the bottom Recurring Matrix." 
    }
  },
  {
    id: '2',
    icon: <PenTool className="w-5 h-5 text-emerald-500" />,
    q: { 
      tr: "Hesaplama Defteri (Notlarım) sayfası nasıl çalışır?", 
      en: "How does the Calculation Ledger (Notes) page work?" 
    },
    a: { 
      tr: "Notlarım sayfası, dağınık düz metin notlarınızı otomatik olarak finansal verilere dönüştürür. 'Nisan 3000 kira' yazdığınızda sistem 3000 değerini ve Nisan ayını algılayarak yandaki tabloda size kesin matematiksel analiz sunar.", 
      en: "The Notes page automatically converts unstructured text into financial data. If you type 'April 3000 rent', the system detects the value 3000 and the month of April, rendering an exact mathematical breakdown in the adjacent summary table." 
    }
  },
  {
    id: '3',
    icon: <Settings2 className="w-5 h-5 text-rose-500" />,
    q: { 
      tr: "Format Kuralları ne işe yarar?", 
      en: "What do Format Rules do?" 
    },
    a: { 
      tr: "Format Kuralları, Notlarım sayfasında yazdığınız rakamların 'Gelir' mi yoksa 'Gider' mi olduğunu belirler. Örneğin, 'nakit' kelimesine 'Gelir' kuralı atarsanız, not defterinize '1000 nakit' yazdığınız anca sistem bunu pozitif (+) bakiye olarak hesaplar.", 
      en: "Format Rules determine whether the numbers typed in the Notes page represent 'Income' or 'Expense'. For example, if you assign the 'Income' rule to the keyword 'cash', writing '1000 cash' will automatically append a positive (+) balance." 
    }
  },
  {
    id: '4',
    icon: <BookOpen className="w-5 h-5 text-amber-500" />,
    q: { 
      tr: "Yıl Sonu Odaklı Tekrarlayan Motor nedir?", 
      en: "What is the Year-End Focused Recurring Engine?" 
    },
    a: { 
      tr: "Tekrarlayan Motor, sabit gelir ve giderlerinizi yılın kalan aylarına yatay olarak projekte eder. Net Nakit Akışınızı aylar öncesinden görmenizi sağlar. Matris üzerindeki rakamlara tıklayarak gelecek ayların değerlerini anında değiştirebilirsiniz.", 
      en: "The Recurring Engine horizontally projects your fixed income and expenses across the remaining months of the year. This gives you foresight into Net Cash Flow. You can click on the numeric cells within the matrix to instantly edit future values." 
    }
  },
  {
    id: '5',
    icon: <Shield className="w-5 h-5 text-slate-500" />,
    q: { 
      tr: "Privacy (Gizlilik) modu nedir ve PIN nasıl ayarlanır?", 
      en: "What is Privacy mode and how is the PIN configured?" 
    },
    a: { 
      tr: "Gizlilik modu, etrafınızda biri varken ekrandaki finansal rakamlarınızı anında bulanıklaştırarak gizler. Profil menüsünden (Kullanıcı ikonu) 'PIN Belirle' seçeneğini kullanarak bu kilidi şifreleyebilirsiniz.", 
      en: "Privacy mode instantly blurs your financial figures on the screen, useful when someone is nearby. You can lock this feature with a password by selecting 'Set PIN' from the Profile menu (User icon)." 
    }
  }
];

function Settings2(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>
    </svg>
  );
}

export default function FAQPage() {
  const { locale, t } = useLanguage();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set(['1']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleAccordion = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFaqs = FAQS.filter(f => {
    if (!searchQuery) return true;
    const qstr = f.q[locale].toLowerCase();
    const astr = f.a[locale].toLowerCase();
    const s = searchQuery.toLowerCase();
    return qstr.includes(s) || astr.includes(s);
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0f0f10]/80 backdrop-blur-md border-b border-slate-200 dark:border-neutral-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity">
            <ArrowLeft className="w-4 h-4" />
            {locale === 'tr' ? 'Kokpit\'e Dön' : 'Back to Dashboard'}
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 -mr-2 -mt-2 -mb-2 flex shrink-0">
              <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-white flex items-center justify-center shadow-sm">
                <span className="text-white dark:text-black text-sm font-bold">₺</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <div className="bg-white dark:bg-[#0f0f10] border-b border-slate-200 dark:border-neutral-800 pb-16 pt-12">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-4">
            {locale === 'tr' ? 'Nasıl yardımcı olabiliriz?' : 'How can we help?'}
          </h1>
          <p className="text-lg text-slate-500 dark:text-neutral-400 mb-8 max-w-xl mx-auto">
            {locale === 'tr' 
              ? 'Temel özelliklerin kullanımı, veri girişi ve sıkça sorulan sorular hakkında rehber.' 
              : 'A guide to core features, data entry, and frequently asked questions.'}
          </p>
          
          <div className="relative max-w-xl mx-auto">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder={locale === 'tr' ? 'Sorunuzu arayın...' : 'Search for questions...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-full border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:bg-white dark:focus:bg-[#0f0f10] transition-all shadow-sm text-base"
            />
          </div>
        </div>
      </div>

      {/* ACCORDION LIST */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12">
        <h2 className="text-2xl font-bold mb-6">
          {locale === 'tr' ? 'Sıkça Sorulan Sorular' : 'Frequently Asked Questions'}
        </h2>
        
        {filteredFaqs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-neutral-500">
            {locale === 'tr' ? 'Sonuç bulunamadı...' : 'No results found...'}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFaqs.map((faq) => {
              const isOpen = openIds.has(faq.id);
              return (
                <div 
                  key={faq.id} 
                  className={`border border-slate-200 dark:border-neutral-800 rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? 'bg-white dark:bg-[#0f0f10] shadow-md' : 'bg-transparent hover:bg-white dark:hover:bg-[#0f0f10] hover:shadow-sm'}`}
                >
                  <button
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full text-left px-6 py-5 flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-xl flex-shrink-0 transition-colors ${isOpen ? 'bg-slate-100 dark:bg-neutral-900' : 'bg-white dark:bg-[#18181b]'}`}>
                        {faq.icon}
                      </div>
                      <span className="font-semibold text-[15px] pr-8">{faq.q[locale]}</span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <div 
                    className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                  >
                    <div className="pl-14 text-slate-600 dark:text-neutral-400 text-[15px] leading-relaxed">
                      {faq.a[locale]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-[#0f0f10] py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-slate-500 dark:text-neutral-500">
          © {new Date().getFullYear()} Finansal Kokpit. {locale === 'tr' ? 'Tüm hakları saklıdır.' : 'All rights reserved.'}
        </div>
      </footer>
    </div>
  );
}
