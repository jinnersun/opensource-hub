-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V015
-- 描述: FAQ 系统表结构 (含 SEO/GEO 优化字段)
-- 创建日期: 2026-06-02
-- ============================================
--
-- 数据流:
--   存量数据: scripts/process-faq-backlog.ts (一次性脚本)
--     → GitHub Issues → AI 生成 (SEO优化) → app_faqs (英文)
--     → INSERT translation_tasks (source_table='app_faqs')
--     → Translator Worker → app_faq_translations (zh/ja/ko)
--     → UPDATE app_faqs.status = 'active'
--
--   增量数据: ETL Worker (scheduler.ts 改造)
--     → saveSuccess() 后自动触发 FAQ 生成
--     → 同上写入流程
--
-- 前端查询:
--   API Worker: GET /api/apps/{id}/faqs?lang=zh
--   → JOIN app_faqs + app_faq_translations (COALESCE 兜底英文)
--   → 返回 FAQPage JSON-LD 数据

-- ============================================
-- 1. 扩展 apps 表 (FAQ 状态追踪)
-- ============================================

ALTER TABLE apps ADD COLUMN faq_status TEXT DEFAULT 'pending';
  -- pending: 待处理
  -- processing: 处理中
  -- completed: 已完成
  -- skipped: 跳过 (无 Issues 或 Issues 不符合条件)

ALTER TABLE apps ADD COLUMN faq_processed_at TIMESTAMP;

ALTER TABLE apps ADD COLUMN faq_issue_count INTEGER DEFAULT 0;
  -- 处理的 Issue 数量

ALTER TABLE apps ADD COLUMN faq_active_count INTEGER DEFAULT 0;
  -- 生成的 active FAQ 数量

-- ============================================
-- 2. 扩展 apps_library 表 (FAQ 状态追踪)
-- ============================================

ALTER TABLE apps_library ADD COLUMN faq_status TEXT DEFAULT 'pending';
ALTER TABLE apps_library ADD COLUMN faq_processed_at TIMESTAMP;
ALTER TABLE apps_library ADD COLUMN faq_issue_count INTEGER DEFAULT 0;
ALTER TABLE apps_library ADD COLUMN faq_active_count INTEGER DEFAULT 0;

-- ============================================
-- 3. 扩展 translation_tasks 表 (支持 FAQ 翻译)
-- ============================================

ALTER TABLE translation_tasks ADD COLUMN source_table TEXT DEFAULT 'app_translations';
  -- 'app_translations': 现有项目内容翻译
  -- 'app_faqs': FAQ 翻译

ALTER TABLE translation_tasks ADD COLUMN source_id TEXT;
  -- source_table='app_translations' 时: source_id = app_id
  -- source_table='app_faqs' 时: source_id = faq_id

-- 更新现有记录 (向后兼容)
UPDATE translation_tasks 
SET source_table = 'app_translations', source_id = app_id 
WHERE source_table IS NULL;

-- ============================================
-- 4. 新建 app_faqs 表 (FAQ 主表,英文源)
-- ============================================

CREATE TABLE IF NOT EXISTS app_faqs (
  id TEXT PRIMARY KEY,                    -- faq_{app_id}_{issue_number}
  app_id TEXT NOT NULL,
  question_en TEXT NOT NULL,              -- 英文问题 (SEO优化)
  answer_en TEXT NOT NULL,                -- 英文回答 (结构化,含代码示例)
  source_issue_url TEXT,                  -- 原始 GitHub Issue URL
  source_issue_number INTEGER,            -- Issue 编号
  source_issue_title TEXT,                -- Issue 标题 (便于调试)
  source_lang TEXT DEFAULT 'en',          -- 原始 Issue 语言
  
  -- SEO/GEO 优化字段
  seo_keywords TEXT,                      -- JSON 数组: ["keyword1", "keyword2", "keyword3"]
  search_intent TEXT,                     -- how-to | troubleshooting | comparison | configuration
  
  confidence REAL DEFAULT 0,              -- AI 置信度 (0-1)
  status TEXT DEFAULT 'pending_translation',
    -- pending_translation: 等待翻译
    -- translating: 翻译中
    -- active: 前端展示
    -- outdated: 过期 (留存不删)
    -- hidden: 人工隐藏
  pinned BOOLEAN DEFAULT 0,               -- 人工置顶
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 5. 新建 app_faq_translations 表 (多语言译文)
-- ============================================

CREATE TABLE IF NOT EXISTS app_faq_translations (
  id TEXT PRIMARY KEY,                    -- faq_trans_{faq_id}_{locale}
  faq_id TEXT NOT NULL,
  locale TEXT NOT NULL,                   -- zh, ja, ko
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  translated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(faq_id, locale)
);

-- ============================================
-- 6. 新建 app_faq_reviews 表 (评审流水)
-- ============================================

CREATE TABLE IF NOT EXISTS app_faq_reviews (
  id TEXT PRIMARY KEY,                    -- review_{app_id}_{issue_number}
  app_id TEXT NOT NULL,
  issue_number INTEGER NOT NULL,
  kv_key TEXT,                            -- CF KV 中原始数据+各模型反馈的 key
  final_decision TEXT,                    -- passed | rejected | need_human
  reject_reason TEXT,
  reviewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引优化 (Indexes)
-- ============================================

-- apps 表 FAQ 相关索引
CREATE INDEX IF NOT EXISTS idx_apps_faq_status ON apps(faq_status);
CREATE INDEX IF NOT EXISTS idx_apps_faq_processed_at ON apps(faq_processed_at);

-- apps_library 表 FAQ 相关索引
CREATE INDEX IF NOT EXISTS idx_apps_library_faq_status ON apps_library(faq_status);
CREATE INDEX IF NOT EXISTS idx_apps_library_faq_processed_at ON apps_library(faq_processed_at);

-- app_faqs 表索引
CREATE INDEX IF NOT EXISTS idx_faqs_app_id ON app_faqs(app_id);
CREATE INDEX IF NOT EXISTS idx_faqs_status ON app_faqs(status);
CREATE INDEX IF NOT EXISTS idx_faqs_app_status ON app_faqs(app_id, status);
CREATE INDEX IF NOT EXISTS idx_faqs_confidence ON app_faqs(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_faqs_search_intent ON app_faqs(search_intent);

-- app_faq_translations 表索引
CREATE INDEX IF NOT EXISTS idx_faq_translations_faq_id ON app_faq_translations(faq_id);
CREATE INDEX IF NOT EXISTS idx_faq_translations_locale ON app_faq_translations(locale);
CREATE INDEX IF NOT EXISTS idx_faq_translations_faq_locale ON app_faq_translations(faq_id, locale);

-- app_faq_reviews 表索引
CREATE INDEX IF NOT EXISTS idx_faq_reviews_app_id ON app_faq_reviews(app_id);
CREATE INDEX IF NOT EXISTS idx_faq_reviews_reviewed_at ON app_faq_reviews(reviewed_at DESC);

-- translation_tasks 表扩展索引
CREATE INDEX IF NOT EXISTS idx_translation_tasks_source 
  ON translation_tasks(source_table, source_id, status);
