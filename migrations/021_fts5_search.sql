-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V021
-- 描述: FTS5 Trigram 全文搜索索引
-- ============================================

-- 1. Apps 搜索索引 (trigram tokenizer)
CREATE VIRTUAL TABLE IF NOT EXISTS apps_search_idx USING fts5(
  app_id UNINDEXED,
  name,
  summary,
  description,
  full_description,
  tags,
  tokenize='trigram'
);

-- 灌入存量数据
INSERT INTO apps_search_idx(app_id, name, summary, description, full_description, tags)
SELECT id, name,
  COALESCE((SELECT summary FROM app_translations WHERE app_id = apps.id AND locale = 'zh'), ''),
  COALESCE(description, ''),
  COALESCE(full_description, ''),
  COALESCE(tags, '')
FROM apps WHERE status = 'active';

-- 2. Library 搜索索引
CREATE VIRTUAL TABLE IF NOT EXISTS libs_search_idx USING fts5(
  lib_id UNINDEXED,
  name,
  summary,
  description,
  full_description,
  tags,
  tokenize='trigram'
);

INSERT INTO libs_search_idx(lib_id, name, summary, description, full_description, tags)
SELECT CAST(github_repo_id AS TEXT), name,
  COALESCE((SELECT summary FROM apps_library_translations WHERE library_id = apps_library.id AND locale = 'zh'), ''),
  COALESCE(description, ''),
  COALESCE(full_description, ''),
  COALESCE(tags, '')
FROM apps_library WHERE status = 'active';
