-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V019
-- 描述: 修复 translation_tasks UNIQUE 约束，支持多 FAQ 翻译
--       旧: UNIQUE(app_id, target_locale)
--       新: UNIQUE(source_table, source_id, target_locale)
-- 原因: 一个 app 有多个 FAQ，每个 FAQ 需要独立翻译任务
-- ============================================

-- 1. 删旧索引
DROP INDEX IF EXISTS idx_translation_tasks_status;
DROP INDEX IF EXISTS idx_translation_tasks_app;
DROP INDEX IF EXISTS idx_translation_tasks_source;

-- 2. 新建临时表（正确的约束）
CREATE TABLE translation_tasks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  source_table TEXT NOT NULL DEFAULT 'app_translations',
  source_id TEXT,
  source_locale TEXT NOT NULL,
  target_locale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'translating', 'done', 'failed')),
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(source_table, source_id, target_locale)
);

-- 3. 迁移数据（存量记录补全 source_id = app_id）
INSERT INTO translation_tasks_new
  (id, app_id, source_table, source_id, source_locale, target_locale,
   status, retry_count, last_error, created_at, updated_at)
SELECT id, app_id,
  COALESCE(source_table, 'app_translations'),
  COALESCE(source_id, app_id),
  source_locale, target_locale,
  status, retry_count, last_error, created_at, updated_at
FROM translation_tasks;

-- 4. 替换表
DROP TABLE translation_tasks;
ALTER TABLE translation_tasks_new RENAME TO translation_tasks;

-- 5. 重建索引
CREATE INDEX IF NOT EXISTS idx_translation_tasks_status
  ON translation_tasks(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_translation_tasks_app
  ON translation_tasks(app_id);

CREATE INDEX IF NOT EXISTS idx_translation_tasks_source
  ON translation_tasks(source_table, source_id, status);
