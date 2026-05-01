-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V008
-- 描述: 为 raw_apps 表添加 source 字段，用于追踪数据来源
-- 创建日期: 2026-04-30
-- ============================================

-- 1. 添加 source 字段
ALTER TABLE raw_apps ADD COLUMN source TEXT;

-- 2. 添加索引优化按来源查询
CREATE INDEX IF NOT EXISTS idx_raw_apps_source ON raw_apps(source);

-- ============================================
-- 说明
-- ============================================
-- 
-- source 字段值示例:
--   'awesome'        - 从 awesome 列表提取的种子数据
--   'discovered'     - 自动发现的项目
--   'userSubmitted'  - 用户提交的项目
--   'trending'       - 从 GitHub Trending 发现的项目
--
-- 查询示例:
--   SELECT source, COUNT(*) FROM raw_apps GROUP BY source;
--   SELECT * FROM raw_apps WHERE source = 'awesome' LIMIT 10;
--
