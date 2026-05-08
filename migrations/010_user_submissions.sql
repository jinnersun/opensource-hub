-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V010
-- 描述: 统一的用户提交审核表（替代前端 Mock 内存存储）
-- 创建日期: 2026-05-08
-- ============================================
--
-- 设计说明：
-- - 将「提交软件」与「提交需求」两个入口统一到一张表，由 source 字段区分
-- - 提交后不直接进入采集队列（raw_apps），需人工审核
-- - 审核通过后，通过独立动作将 source='software' 且 status='approved'
--   的记录注入 raw_apps（由管理端操作）
-- ============================================

CREATE TABLE IF NOT EXISTS user_submissions (
    id TEXT PRIMARY KEY,                                -- UUID
    source TEXT NOT NULL CHECK(source IN ('software', 'request')),

    -- 「提交软件」专属字段
    name TEXT,                                          -- 软件名称
    repo_url TEXT,                                      -- GitHub 仓库 URL

    -- 共享字段
    description TEXT NOT NULL,                          -- 描述 / 需求详情
    scenario TEXT,                                      -- 使用场景（request 专属）
    email TEXT,                                         -- 联系邮箱（可选）

    -- 审核状态机：pending → approved / rejected / duplicate
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'approved', 'rejected', 'duplicate')),
    review_notes TEXT,                                  -- 审核备注
    reviewed_at TIMESTAMP,
    reviewed_by TEXT,                                   -- 审核人标识

    -- 转化追踪：审核通过后，若已进入采集流水线，回写 raw_apps 的 repo_id
    raw_apps_repo_id INTEGER,

    -- 反滥用
    ip_hash TEXT,                                       -- 访客 IP 的哈希（SHA-256 截断）
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (raw_apps_repo_id) REFERENCES raw_apps(github_repo_id) ON DELETE SET NULL
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_submissions_status ON user_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_source ON user_submissions(source, status);
CREATE INDEX IF NOT EXISTS idx_submissions_repo ON user_submissions(repo_url);
CREATE INDEX IF NOT EXISTS idx_submissions_email ON user_submissions(email);

-- 触发器：自动更新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_submissions_updated
    AFTER UPDATE ON user_submissions
    FOR EACH ROW
BEGIN
    UPDATE user_submissions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
