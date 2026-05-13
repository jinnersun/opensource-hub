-- 014: AI 内容重生成中间表
CREATE TABLE IF NOT EXISTS apps_staging (
  id TEXT PRIMARY KEY,
  name TEXT, slug TEXT, description TEXT, full_description TEXT,
  category TEXT, tags TEXT, license TEXT, homepage_url TEXT,
  stars_count INTEGER, last_updated TIMESTAMP, status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS app_translations_staging (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  locale TEXT NOT NULL,
  summary TEXT, description TEXT, full_description TEXT,
  features TEXT, use_cases TEXT, quick_start_guide TEXT,
  uninstall_guide TEXT, caveats TEXT,
  translated_by TEXT, ai_model_version TEXT, quality_score REAL,
  UNIQUE(app_id, locale)
);
