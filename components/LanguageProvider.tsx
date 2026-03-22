"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

type Locale = 'tr' | 'en';

const dictionary: Record<string, Record<Locale, string>> = {
  // Common
  "Ekle": { tr: "Ekle", en: "Add" },
  "İptal": { tr: "İptal", en: "Cancel" },
  "Kaydet": { tr: "Kaydet", en: "Save" },
  "Sil": { tr: "Sil", en: "Delete" },
  "Düzenle": { tr: "Düzenle", en: "Edit" },
  "Tamam": { tr: "Tamam", en: "OK" },
  "Tarih": { tr: "Tarih", en: "Date" },
  "Tutar": { tr: "Tutar", en: "Amount" },
  "Tür": { tr: "Tür", en: "Type" },
  "Gelir": { tr: "Gelir", en: "Income" },
  "Gider": { tr: "Gider", en: "Expense" },
  "Tümü": { tr: "Tümü", en: "All" },
  "Bugün": { tr: "Bugün", en: "Today" },
  
  // Navigation
  "Kokpit": { tr: "Kokpit", en: "Dashboard" },
  "Notlarım": { tr: "Notlarım", en: "Notes" },
  
  // Dashboard KPIS
  "Finansal Kokpit": { tr: "Finansal Kokpit", en: "Financial Dashboard" },
  "Toplam Bakiye": { tr: "Toplam Bakiye", en: "Total Balance" },
  "Net Nakit Akışı": { tr: "Net Nakit Akışı", en: "Net Cash Flow" },
  "Toplam Gider": { tr: "Toplam Gider", en: "Total Expense" },
  "Ödenmemiş Taksitler": { tr: "Ödenmemiş Taksitler", en: "Unpaid Instalments" },
  "Ödenmiş": { tr: "Ödenmiş", en: "Paid" },
  "Ödenmemiş": { tr: "Ödenmemiş", en: "Unpaid" },
  "Bekleyen": { tr: "Bekleyen", en: "Pending" },
  
  // Transactions
  "Gerçek Zamanlı İşlemler": { tr: "Gerçek Zamanlı İşlemler", en: "Real-Time Transactions" },
  "İşlem Adı": { tr: "İşlem Adı", en: "Transaction Name" },
  
  // Active Goals & Liabilities
  "Birikim Hedefi": { tr: "Birikim Hedefi", en: "Savings Goal" },
  "İlerleme": { tr: "İlerleme", en: "Progress" },
  "Aktif Taksitler & Giderler": { tr: "Aktif Taksitler & Giderler", en: "Active Liabilities & Expenses" },
  "Toplam": { tr: "Toplam", en: "Total" },
  "aktif yükümlülük": { tr: "aktif yükümlülük", en: "active liabilities" },
  "Düzenli": { tr: "Düzenli", en: "Recurring" },
  "Tek Seferlik": { tr: "Tek Seferlik", en: "One-Time" },
  "Ödendi İşaretle": { tr: "Ödendi İşaretle", en: "Mark as Paid" },
  "Tamamen Kaldır": { tr: "Tamamen Kaldır", en: "Remove Completely" },
  "Takvime Ekle": { tr: "Takvime Ekle", en: "Add to Calendar" },
  
  // Matrix
  "Yeni Tekrarlayan Motor (Yıl Sonu Odaklı)": { tr: "Yeni Tekrarlayan Motor (Yıl Sonu Odaklı)", en: "Recurring Engine (Year-End Focused)" },
  "Sabit gelir ve giderlerin ay bazında dağılımı. Rakama veya kural ismine tıklayarak düzenleyin.": { tr: "Sabit gelir ve giderlerin ay bazında dağılımı. Rakama veya kural ismine tıklayarak düzenleyin.", en: "Monthly distribution of fixed income and expenses. Click numbers or rule names to edit." },
  "Kural / İşlem": { tr: "Kural / İşlem", en: "Rule / Transaction" },
  "Arama sonucuna uygun düzenli gider/gelir bulunamadı.": { tr: "Arama sonucuna uygun düzenli gider/gelir bulunamadı.", en: "No recurring expenses/income matching the search." },
  "Kayıt bulunamadı.": { tr: "Kayıt bulunamadı.", en: "No records found." },
  "Aylık Net": { tr: "Aylık Net", en: "Monthly Net" },
  "Genel Toplam": { tr: "Genel Toplam", en: "Grand Total" },
  "Yeni Kayıt": { tr: "Yeni Kayıt", en: "New Record" },
  "Kümülatif Bakiye (Tahmini)": { tr: "Kümülatif Bakiye (Tahmini)", en: "Cumulative Balance (Est.)" },
  "Dönem Başı Nakit (Açılış)": { tr: "Dönem Başı Nakit (Açılış)", en: "Opening Cash Balance" },
  "Ara...": { tr: "Ara...", en: "Search..." },
  "Gelir Kaynakları": { tr: "Gelir Kaynakları", en: "Income Sources" },
  "Aylık Gider Eğilimi": { tr: "Aylık Gider Eğilimi", en: "Monthly Expense Trend" },
  "Gider Dağılımı": { tr: "Gider Dağılımı", en: "Expense Distribution" },
  "Seçili Aralık Geliri": { tr: "Seçili Aralık Geliri", en: "Selected Range Income" },
  "Seçilen zaman periyodu matrisi": { tr: "Seçilen zaman periyodu matrisi", en: "Selected time period matrix" },
  "Seçili Periyot Kategorileri": { tr: "Seçili Periyot Kategorileri", en: "Selected Period Categories" },
  "toplam": { tr: "toplam", en: "total" },
  "Kredi Kartı": { tr: "Kredi Kartı", en: "Credit Card" },
  "Vergi Yapılandırması": { tr: "Vergi Yapılandırması", en: "Tax Restructuring" },
  "Maaş": { tr: "Maaş", en: "Salary" },
  "Kira geliri": { tr: "Kira geliri", en: "Rent Income" },
  "Emekli Maaşı": { tr: "Emekli Maaşı", en: "Pension" },
  "Nakit": { tr: "Nakit", en: "Cash" },
  "Hatırlatıcı": { tr: "Hatırlatıcı", en: "Reminder" },
  "İşlem": { tr: "İşlem", en: "Transaction" },
  "Kalan": { tr: "Kalan", en: "Remaining" },
  "Kalem": { tr: "Kalem", en: "Item" },
  "Ay": { tr: "Ay", en: "Month" },
  "Ocak": { tr: "Ocak", en: "January" },
  "Şubat": { tr: "Şubat", en: "February" },
  "Mart": { tr: "Mart", en: "March" },
  "Nisan": { tr: "Nisan", en: "April" },
  "Mayıs": { tr: "Mayıs", en: "May" },
  "Haziran": { tr: "Haziran", en: "June" },
  "Temmuz": { tr: "Temmuz", en: "July" },
  "Ağustos": { tr: "Ağustos", en: "August" },
  "Eylül": { tr: "Eylül", en: "September" },
  "Ekim": { tr: "Ekim", en: "October" },
  "Kasım": { tr: "Kasım", en: "November" },
  "Aralık": { tr: "Aralık", en: "December" },
  
  // Profile Menu
  "Karanlık Mod": { tr: "Karanlık Mod", en: "Dark Mode" },
  "Bildirimler": { tr: "Bildirimler", en: "Notifications" },
  "Dil / Language": { tr: "Dil / Language", en: "Language / Dil" },
  "Profili Düzenle": { tr: "Profili Düzenle", en: "Edit Profile" },
  "Oturumu Kapat": { tr: "Oturumu Kapat", en: "Log Out" },
  "Aktif": { tr: "Aktif", en: "Active" },
  "Açık": { tr: "Açık", en: "On" },
  "Kapalı": { tr: "Kapalı", en: "Off" },
  
  // Notes Page
  "Hesaplama Defteri": { tr: "Hesaplama Defteri", en: "Calculation Ledger" },
  "Gizle": { tr: "Gizle", en: "Hide" },
  "Gizli": { tr: "Gizli", en: "Hidden" },
  "Temizle": { tr: "Temizle", en: "Clear" },
  "Format Kuralları": { tr: "Format Kuralları", en: "Format Rules" },
  "Notlarınızdaki kelimelerin gelir mi gider mi sayılacağını tanımlayın. Özel kurallar yerleşik kurallara göre önceliklidir.": { tr: "Notlarınızdaki kelimelerin gelir mi gider mi sayılacağını tanımlayın. Özel kurallar yerleşik kurallara göre önceliklidir.", en: "Define whether words in your notes are counted as income or expense. Custom rules override built-ins." },
  "kural": { tr: "kural", en: "rules" },
  "anahtar kelime...": { tr: "anahtar kelime...", en: "keyword..." },
  "Aylık Borç / Ödeme Özeti": { tr: "Aylık Borç / Ödeme Özeti", en: "Monthly Debt / Payment Summary" },
  "ay tespit edildi": { tr: "ay tespit edildi", en: "months detected" },
  "KALEM": { tr: "KALEM", en: "ITEM" },
  "AYLIK NET": { tr: "AYLIK NET", en: "MONTHLY NET" },
  "Notlar metninden herhangi bir finansal veri algılanamadı.": { tr: "Notlar metninden herhangi bir finansal veri algılanamadı.", en: "No financial data detected from the notes text." },
  "Hesap Makinesi": { tr: "Hesap Makinesi", en: "Calculator" },
  // Auth
  "Hesabınıza giriş yapın": { tr: "Hesabınıza giriş yapın", en: "Log in to your account" },
  "Google ile Giriş Yap": { tr: "Google ile Giriş Yap", en: "Log in with Google" },
  "veya": { tr: "veya", en: "or" },
  "E-posta": { tr: "E-posta", en: "Email" },
  "Şifre": { tr: "Şifre", en: "Password" },
  "E-posta veya şifre hatalı.": { tr: "E-posta veya şifre hatalı.", en: "Invalid email or password." },
  "Giriş yapılıyor...": { tr: "Giriş yapılıyor...", en: "Logging in..." },
  "Giriş Yap": { tr: "Giriş Yap", en: "Log In" },
  "Hesabınız yok mu?": { tr: "Hesabınız yok mu?", en: "Don't have an account?" },
  "Kayıt Ol": { tr: "Kayıt Ol", en: "Sign Up" },
  "Şifre en az 6 karakter olmalı.": { tr: "Şifre en az 6 karakter olmalı.", en: "Password must be at least 6 characters." },
  "Kayıt başarısız.": { tr: "Kayıt başarısız.", en: "Registration failed." },
  "Yeni hesap oluşturun": { tr: "Yeni hesap oluşturun", en: "Create a new account" },
  "Google ile Kayıt Ol": { tr: "Google ile Kayıt Ol", en: "Sign Up with Google" },
  "Ad Soyad": { tr: "Ad Soyad", en: "Full Name" },
  "(min. 6 karakter)": { tr: "(min. 6 karakter)", en: "(min. 6 chars)" },
  "Kayıt oluşturuluyor...": { tr: "Kayıt oluşturuluyor...", en: "Creating account..." },
  "Zaten hesabınız var mı?": { tr: "Zaten hesabınız var mı?", en: "Already have an account?" },

  // TransactionModal
  "Yeni": { tr: "Yeni", en: "New" },
  "Kaydı": { tr: "Kaydı", en: "Record" },
  "Transfer": { tr: "Transfer", en: "Transfer" },
  "Finansal hareketlerinizi detaylandırın.": { tr: "Finansal hareketlerinizi detaylandırın.", en: "Describe your financial transaction." },
  "İşlem Tutarı": { tr: "İşlem Tutarı", en: "Transaction Amount" },
  "Açıklama / Başlık": { tr: "Açıklama / Başlık", en: "Description / Title" },
  "Örn. Mac Studio Alımı, Kira Geliri vs.": { tr: "Örn. Mac Studio Alımı, Kira Geliri vs.", en: "e.g. MacBook Purchase, Rent Income, etc." },
  "İşlem Tipi & Sıklığı": { tr: "İşlem Tipi & Sıklığı", en: "Transaction Type & Frequency" },
  "Tek Sefer": { tr: "Tek Sefer", en: "One-Time" },
  "Sadece bu aya özel.": { tr: "Sadece bu aya özel.", en: "This month only." },
  "Aylık otomatik işler.": { tr: "Aylık otomatik işler.", en: "Repeats monthly automatically." },
  "Sadece Hatırlatıcı (Bakiye Etkilemez)": { tr: "Sadece Hatırlatıcı (Bakiye Etkilemez)", en: "Reminder Only (Doesn't Affect Balance)" },
  "Ödendi işaretlenene kadar bakiyeden düşmez.": { tr: "Ödendi işaretlenene kadar bakiyeden düşmez.", en: "Won't be deducted until marked as paid." },
  "İşlem Tarihi": { tr: "İşlem Tarihi", en: "Transaction Date" },
  "Şu Tarihe Kadar Tekrarla": { tr: "Şu Tarihe Kadar Tekrarla", en: "Repeat Until" },
  "Her Ayın Hangi Günü Ödenecek? (1-31)": { tr: "Her Ayın Hangi Günü Ödenecek? (1-31)", en: "Which Day of the Month is Due? (1-31)" },
  "Taksitlendir": { tr: "Taksitlendir", en: "Installments" },
  "Bu ödemeyi gelecek aylara dağıt.": { tr: "Bu ödemeyi gelecek aylara dağıt.", en: "Split this payment over future months." },
  "Taksit Sayısı (Ay)": { tr: "Taksit Sayısı (Ay)", en: "Installment Count (Months)" },
  "Bu işlem aylık": { tr: "Bu işlem aylık", en: "This transaction will appear as" },
  "olarak yansıyacaktır.": { tr: "olarak yansıyacaktır.", en: "per month." },
  "Kaydediliyor...": { tr: "Kaydediliyor...", en: "Saving..." },

  // Dashboard extra strings - widgets and counters
  "Arama sonucuna uygun aktif yükümlülük bulunamadı.": { tr: "Arama sonucuna uygun aktif yükümlülük bulunamadı.", en: "No active liabilities matching search." },
  "Aktif taksit veya gider yok.": { tr: "Aktif taksit veya gider yok.", en: "No active instalments or expenses." },
  "Uygula": { tr: "Uygula", en: "Apply" },
  "Tarih Seçin": { tr: "Tarih Seçin", en: "Select Date" },
  "PIN Belirle": { tr: "PIN Belirle", en: "Set PIN" },
  "PIN Kaldır": { tr: "PIN Kaldır", en: "Remove PIN" },
  "Profil": { tr: "Profil", en: "Profile" },
  "PIN Doğrulama": { tr: "PIN Doğrulama", en: "PIN Verification" },
  "Onayla": { tr: "Onayla", en: "Confirm" },
  "Gizlilik Modu": { tr: "Gizlilik Modu", en: "Privacy Mode" }
};

interface LanguageContextProps {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextProps | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('tr');

  // Load from LS on mount as base
  useEffect(() => {
    try {
      const stored = localStorage.getItem('fcv2_language') as Locale;
      if (stored === 'en' || stored === 'tr') setLocaleState(stored);
    } catch {}
  }, []);

  // Fetch true preference from DB if logged in
  useEffect(() => {
    fetch('/api/user/data')
      .then(r => r.json())
      .then(res => {
        if (res.data && res.data.language) {
          setLocaleState(res.data.language);
          localStorage.setItem('fcv2_language', res.data.language);
        }
      }).catch(() => {});
  }, []);

  const setLocale = (newLoc: Locale) => {
    setLocaleState(newLoc);
    localStorage.setItem('fcv2_language', newLoc);
    // Best-effort push to DB silently
    fetch('/api/user/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: newLoc })
    }).catch(() => {});
  };

  const t = (key: string): string => {
    const entry = dictionary[key];
    if (!entry) return key; // Fallback to key itself if not in dict
    return entry[locale];
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
