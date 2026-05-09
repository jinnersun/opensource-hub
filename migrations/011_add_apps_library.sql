-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V011
-- 描述: 新增 apps_library (代码宝库) + apps_library_translations 表
--       用于收录 Trending 发现且 stars>=2000 但无 Release 的优质源码项目
-- 创建日期: 2026-05-08
-- ============================================
--
-- 背景:
--   现有 apps 表定位为 "可直接安装的开源软件"，门槛 no_installable_release。
--   Trending 上 90%+ 的项目是源码/框架/CLI，被该门槛挡住但本身优质。
--   方案 C: 独立表收录，独立页面展示，不污染主站 apps 语义。
--
-- 数据流:
--   raw_apps (source='trending', etl_status='skipped', error_log='no_installable_release',
--             stars>=2000)
--     → 轻量 ETL (AI 精简 prompt, 复用 categories 表)
--     → apps_library
--     → /[locale]/library 页面展示
--
-- 字段设计原则:
--   - 复用 categories 表 (category 字段存 slug, 与 apps 表保持一致)
--   - 不设 downloads / installation_guide / release 相关字段
--   - 新增 project_type 8 种固定枚举 + readme_preview (前 2000 字用于展示)
--   - 翻译独立表 apps_library_translations，与 app_translations 结构对齐
-- ============================================

-- 1. 主表：代码宝库项目
CREATE TABLE IF NOT EXISTS apps_library (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  github_repo_id INTEGER UNIQUE NOT NULL,       -- 关联 raw_apps.github_repo_id
  slug TEXT UNIQUE NOT NULL,                    -- URL 友好标识 (owner-repo 小写)
  name TEXT NOT NULL,                           -- 仓库名 (repo)
  full_name TEXT NOT NULL,                      -- owner/repo
  description TEXT,                             -- GitHub 原文 description (英文)
  summary TEXT,                                 -- AI 生成一句话摘要 (英文基线)
  full_description TEXT,                        -- AI 生成 3-5 句扩展描述 (英文基线)
  readme_preview TEXT,                          -- README 截前 2000 字 (去除图片/HTML)
  tags TEXT,                                    -- JSON array, 融合 GitHub topics + AI 标签
  language TEXT,                                -- 主编程语言
  project_type TEXT NOT NULL                    -- AI 分类，固定 8 种枚举
    CHECK (project_type IN (
      'framework',      -- 框架
      'library',        -- 库
      'cli-tool',       -- 命令行工具 (含 TUI)
      'application',    -- 应用程序
      'tutorial',       -- 教程/学习
      'awesome-list',   -- 资源汇总
      'dataset-model',  -- 数据集/模型
      'other'           -- 其他 (AI 兜底)
    )),
  category TEXT,                                -- 复用 categories.slug (例: cat_002=ai)
  stars_count INTEGER DEFAULT 0,
  html_url TEXT NOT NULL,                       -- GitHub 仓库地址
  homepage TEXT,                                -- 项目主页 (可选)
  license TEXT,                                 -- SPDX license id
  last_updated TIMESTAMP,                       -- GitHub pushed_at
  status TEXT DEFAULT 'active'                  -- active | archived | removed
    CHECK (status IN ('active', 'archived', 'removed')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 翻译表：结构与 app_translations 对齐
CREATE TABLE IF NOT EXISTS apps_library_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  library_id INTEGER NOT NULL,
  locale TEXT NOT NULL,                         -- 'zh' | 'en'
  summary TEXT,                                 -- 翻译后一句话摘要
  full_description TEXT,                        -- 翻译后扩展描述
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(library_id, locale),
  FOREIGN KEY (library_id) REFERENCES apps_library(id) ON DELETE CASCADE
);

-- 3. 索引
CREATE INDEX IF NOT EXISTS idx_library_stars       ON apps_library(stars_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_type        ON apps_library(project_type, status);
CREATE INDEX IF NOT EXISTS idx_library_lang        ON apps_library(language, stars_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_category    ON apps_library(category, status);
CREATE INDEX IF NOT EXISTS idx_library_status      ON apps_library(status, stars_count DESC);
CREATE INDEX IF NOT EXISTS idx_library_repo_id     ON apps_library(github_repo_id);
CREATE INDEX IF NOT EXISTS idx_library_tr_locale   ON apps_library_translations(library_id, locale);

-- ============================================
-- 后续 ETL 新增状态值 (无需建表，仅记录约定):
--   raw_apps.etl_status = 'library_imported'  表示该条已被 library 分支消化，
--   不再触发现有 apps 分支的 skip-退避循环。
-- ============================================
