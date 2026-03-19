-- Supabase SQL Editor'da çalıştırın (supabase.com → SQL Editor → New Query)

-- Kullanıcı tablosu
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  password_hash TEXT,
  provider      TEXT DEFAULT 'credentials',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Finansal veri tablosu (kullanıcı başına 1 satır, JSON)
CREATE TABLE IF NOT EXISTS financial_data (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data       JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;

-- Service role tüm işlemleri yapabilir
CREATE POLICY "service_all_users" ON users          FOR ALL USING (true);
CREATE POLICY "service_all_data"  ON financial_data FOR ALL USING (true);
