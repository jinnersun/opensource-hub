-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V009
-- 描述: 为 raw_apps 增加 ETag/活跃度调度相关字段，
--       支持基于 If-None-Match 的零成本检查与动态退避更新策略
-- 创建日期: 2026-04-30
-- ============================================
--
-- 注意：本文件中的 ALTER TABLE 部分已在 D1 Console 手动执行完成。
--       此处保留为版本归档与新环境重放参考。
--       若在新数据库初始化时执行，请按顺序运行整段脚本。
--

-- 1. 新增字段（首次部署时执行；若已存在请注释掉对应行）
-- ALTER TABLE raw_apps ADD COLUMN github_etag TEXT;
-- ALTER TABLE raw_apps ADD COLUMN last_pushed_at DATETIME;
-- ALTER TABLE raw_apps ADD COLUMN next_check_at DATETIME;
-- ALTER TABLE raw_apps ADD COLUMN is_archived BOOLEAN DEFAULT 0;

-- 2. 调度相关索引（IF NOT EXISTS 安全可重复执行）
CREATE INDEX IF NOT EXISTS idx_raw_apps_next_check
    ON raw_apps(next_check_at);

CREATE INDEX IF NOT EXISTS idx_raw_apps_status_next
    ON raw_apps(etl_status, next_check_at);

CREATE INDEX IF NOT EXISTS idx_raw_apps_archived
    ON raw_apps(is_archived);

-- ============================================
-- 字段说明
-- ============================================
--
-- github_etag       GitHub API 响应头中的 ETag，用于下次请求 If-None-Match
--                   命中 304 时可零成本（不计入 5000/h 限流）跳过 AI/DB 写入
--
-- last_pushed_at    GitHub repo 的真实最后 push 时间，用于计算活跃度
--
-- next_check_at     下次允许 ETL 处理的时间。ETL 调度器查询条件：
--                     SELECT * FROM raw_apps
--                     WHERE next_check_at IS NULL
--                        OR next_check_at <= CURRENT_TIMESTAMP
--                     LIMIT 50
--                   退避策略（详见 ETL Worker 实现）：
--                     - 1 个月内有 push → +1 天
--                     - 6 个月内有 push → +7 天
--                     - 1 年内有 push   → +14 天
--                     - 超过 1 年       → +30 天
--                     - is_archived = 1 → +90 天
--
-- is_archived       原作者是否已归档仓库；归档项目大幅延长检查周期
--

-- ============================================
-- 常用调度查询示例
-- ============================================
--
-- A. 待处理（含首次种子 + 到期项目）：
--   SELECT github_repo_id, full_name, github_etag
--   FROM raw_apps
--   WHERE (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)
--     AND etl_status NOT IN ('processing', 'skipped')
--     AND retry_count < max_retries
--   ORDER BY next_check_at ASC NULLS FIRST
--   LIMIT 50;
--
-- B. 高频活跃项目监控：
--   SELECT full_name, last_pushed_at, next_check_at
--   FROM raw_apps
--   WHERE last_pushed_at >= datetime('now', '-30 days')
--   ORDER BY last_pushed_at DESC;
--
-- C. 归档项目清单：
--   SELECT full_name, last_pushed_at FROM raw_apps WHERE is_archived = 1;
--
