-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V007
-- 描述: 创建原始数据表 raw_apps 和 ETL 状态机
-- 创建日期: 2026-04-29
-- ============================================

-- 1. 创建原始数据表 (raw_apps)
-- 用于存储 GitHub API 采集的原始数据，等待 ETL Worker 异步处理
CREATE TABLE IF NOT EXISTS raw_apps (
    -- 使用 GitHub 的真实 repo_id 作为主键，防止重复采集
    github_repo_id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL UNIQUE,         -- 例如 "facebook/react"
    
    -- 原始数据
    raw_api_data TEXT,                      -- GitHub API 返回的完整 JSON
    readme_content TEXT,                    -- README.md 原始内容
    readme_length INTEGER DEFAULT 0,        -- README 长度（用于质量评估）
    
    -- 采集元信息
    has_releases INTEGER DEFAULT 0,         -- 是否有 Release
    release_count INTEGER DEFAULT 0,        -- Release 数量
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- ETL 状态机（核心）
    etl_status TEXT DEFAULT 'pending',      -- 'pending' | 'processing' | 'completed' | 'failed' | 'rate_limited' | 'skipped'
    retry_count INTEGER DEFAULT 0,          -- 已重试次数
    max_retries INTEGER DEFAULT 3,          -- 最大重试次数
    error_log TEXT,                         -- 错误信息（最多 500 字符）
    last_processed_at TIMESTAMP,            -- 最后处理时间
    processing_started_at TIMESTAMP,        -- 本次处理开始时间（用于超时检测）
    
    -- 数据质量指标
    quality_score REAL DEFAULT 0.0          -- ETL 处理后的质量评分
);

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS idx_raw_apps_etl_status ON raw_apps(etl_status, retry_count);
CREATE INDEX IF NOT EXISTS idx_raw_apps_collected ON raw_apps(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_raw_apps_full_name ON raw_apps(full_name);

-- 3. 为 apps 表添加来源关联字段（可选）
-- ALTER TABLE apps ADD COLUMN source_raw_id INTEGER REFERENCES raw_apps(github_repo_id);

-- 4. 插入测试数据（可选，用于验证）
-- INSERT OR IGNORE INTO raw_apps (github_repo_id, full_name, raw_api_data, readme_content, etl_status) 
-- VALUES (123456, 'test/repo', '{"id": 123456, "name": "test"}', '# Test Repo', 'pending');

-- ============================================
-- 说明
-- ============================================
-- 
-- ETL 状态机流转：
--   pending → processing → completed
--                     ↓
--                   failed → (retry < max) → pending
--                          → (retry >= max) → skipped
--                     ↓
--               rate_limited → wait 1h → pending
--
-- 超时检测机制：
--   processing 状态超过 30 分钟自动回退到可重试状态
--
-- 查询待处理数据：
--   SELECT * FROM raw_apps 
--   WHERE (
--     etl_status = 'pending' 
--     OR (etl_status = 'processing' AND processing_started_at < datetime('now', '-30 minutes'))
--     OR (etl_status = 'failed' AND retry_count < max_retries)
--     OR (etl_status = 'rate_limited' AND retry_count < max_retries AND last_processed_at < datetime('now', '-1 hour'))
--   )
--   ORDER BY collected_at ASC 
--   LIMIT 5
--
