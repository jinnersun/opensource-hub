-- ==========================================
-- FAQ 系统: raw_faqs 表
-- 用途: 存储从 GitHub 抓取的原始 Issue 数据 (已通过文本质量过滤)
-- 日期: 2026-06-02
-- ==========================================

-- 创建 raw_faqs 表
CREATE TABLE IF NOT EXISTS raw_faqs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,          -- 关联 apps.id
  issue_number INTEGER NOT NULL,
  issue_title TEXT,
  issue_body TEXT,               -- 截断至 4000 字
  issue_state TEXT,              -- 'closed' | 'open'
  issue_labels TEXT,             -- JSON 数组
  comments_count INTEGER,
  issue_created_at TEXT,
  issue_updated_at TEXT,
  issue_url TEXT,
  fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  etl_status TEXT DEFAULT 'pending',  -- pending | processing | completed | rejected
  error_log TEXT,                     -- ETL 处理失败时的错误信息
  retry_count INTEGER DEFAULT 0,      -- ETL 重试次数
  UNIQUE(app_id, issue_number)
);

-- 性能索引
CREATE INDEX IF NOT EXISTS idx_raw_faqs_etl_status ON raw_faqs(etl_status, retry_count);
CREATE INDEX IF NOT EXISTS idx_raw_faqs_app ON raw_faqs(app_id);
CREATE INDEX IF NOT EXISTS idx_raw_faqs_updated ON raw_faqs(issue_updated_at);
