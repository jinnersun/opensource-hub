-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V012
-- 描述: 新增 translation_tasks 表，用于翻译管道任务队列
-- 创建日期: 2026-05-12
-- ============================================
--
-- 数据流:
--   ETL saveSuccess → INSERT translation_tasks (status='pending')
--   Translator Worker (cron) → SELECT pending → CF AI 翻译 → INSERT app_translations
--     → UPDATE status='done' OR DELETE
--
-- 支持的目标语言: ja(日语), ko(韩语), es(西班牙语), pt-BR(葡萄牙语-巴西)

CREATE TABLE IF NOT EXISTS translation_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,              -- apps.id (如 app_123456) 或 apps_library 用 lib_ 前缀
  source_locale TEXT NOT NULL,       -- 翻译来源语言 (当前固定 'zh')
  target_locale TEXT NOT NULL,       -- 目标语言: ja, ko, es, pt-BR
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'translating', 'done', 'failed')),
  retry_count INTEGER DEFAULT 0,     -- 重试次数
  last_error TEXT,                    -- 最近一次失败原因
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(app_id, target_locale)      -- 同一 app 的同一目标语言只存在一条任务
);

CREATE INDEX IF NOT EXISTS idx_translation_tasks_status
  ON translation_tasks(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_translation_tasks_app
  ON translation_tasks(app_id);
