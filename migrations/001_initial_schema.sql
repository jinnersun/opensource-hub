-- ============================================
-- OpenSource-Hub D1 数据库表结构
-- 版本: V1.0
-- 创建日期: 2026-04-20
-- ============================================

-- 1. 软件主表 (Apps)
-- 存储开源软件的基本信息
CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,                          -- 应用唯一标识 (UUID)
    name TEXT NOT NULL,                           -- 应用名称
    slug TEXT UNIQUE NOT NULL,                    -- URL 友好的标识符
    description TEXT,                             -- 简短描述
    full_description TEXT,                        -- 完整描述
    category TEXT NOT NULL,                       -- 主分类 (slug: system, ai, video, privacy, ...)
    tags TEXT,                                    -- 场景标签 (JSON 数组)
    github_url TEXT NOT NULL,                     -- GitHub 仓库地址
    github_owner TEXT,                            -- GitHub 用户名/组织
    github_repo TEXT,                             -- 仓库名称
    license TEXT,                                 -- 开源协议 (MIT, Apache-2.0, GPL-3.0 等)
    homepage_url TEXT,                            -- 官方主页
    documentation_url TEXT,                       -- 文档地址
    is_featured INTEGER DEFAULT 0,                -- 是否推荐 (0/1)
    status TEXT DEFAULT 'active',                 -- 状态: active, archived, pending_review
    stars_count INTEGER DEFAULT 0,                -- GitHub Stars
    last_updated TIMESTAMP,                       -- 最后更新时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 应用版本与下载链接 (App Versions)
-- 存储不同操作系统和架构的安装包信息
CREATE TABLE IF NOT EXISTS app_versions (
    id TEXT PRIMARY KEY,                          -- 版本唯一标识
    app_id TEXT NOT NULL,                         -- 关联 apps.id
    version TEXT NOT NULL,                        -- 版本号 (如: 1.2.3)
    os_type TEXT NOT NULL,                        -- 操作系统: windows, macos, linux
    arch TEXT DEFAULT 'x64',                      -- 架构: x64, arm64, universal
    file_type TEXT NOT NULL,                      -- 文件类型: exe, dmg, msi, deb, rpm, zip, tar.gz
    file_name TEXT,                               -- 文件名
    file_size INTEGER,                            -- 文件大小 (字节)
    download_url TEXT NOT NULL,                   -- 下载链接 (GitHub Releases)
    mirror_url TEXT,                              -- 镜像链接 (可选)
    sha256 TEXT,                                  -- 文件 SHA-256 校验码
    release_notes TEXT,                           -- 版本更新说明
    release_date TIMESTAMP,                       -- 发布日期
    is_stable INTEGER DEFAULT 1,                  -- 是否稳定版 (0=beta/rc, 1=stable)
    download_count INTEGER DEFAULT 0,             -- 下载次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- 3. AI 生成的结构化内容 (AI Content)
-- 存储 LLM 处理后的白话说明书
CREATE TABLE IF NOT EXISTS app_ai_content (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    summary TEXT,                                 -- 一句话白话总结 (核心卖点)
    what_it_does TEXT,                            -- 能帮你做什么 (功能列表)
    what_it_cant_do TEXT,                         -- 不能做什么/避坑指南
    use_cases TEXT,                               -- 适用场景 (JSON 数组)
    quick_start_guide TEXT,                       -- 一分钟上手指南
    is_portable INTEGER DEFAULT 0,                -- 是否绿色版/便携版 (0/1)
    requirements TEXT,                            -- 运行库依赖 (如: .NET 6, VC++ Redist)
    requirement_links TEXT,                       -- 依赖下载链接 (JSON)
    uninstall_guide TEXT,                         -- 卸载清理说明
    has_registry_residual INTEGER DEFAULT 0,      -- 卸载是否残留注册表 (0/1)
    ai_model_version TEXT,                        -- 使用的 AI 模型版本
    confidence_score REAL DEFAULT 0.0,            -- AI 置信度评分 (0-1)
    needs_human_review INTEGER DEFAULT 0,         -- 是否需要人工审核 (0/1)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- 4. 安全审计信息 (Security Audit)
-- 存储安全扫描结果和信任背书
CREATE TABLE IF NOT EXISTS app_security (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    version_id TEXT,                              -- 关联的版本 (可选)
    sha256 TEXT,                                  -- 文件哈希
    virustotal_url TEXT,                          -- VirusTotal 报告链接
    virustotal_score INTEGER,                     -- VirusTotal 评分 (检测数/总数)
    virustotal_report TEXT,                       -- 详细报告 (JSON)
    audit_status TEXT DEFAULT 'pending',          -- 审核状态: pending, passed, flagged, failed
    audit_notes TEXT,                             -- 审核备注
    scanned_at TIMESTAMP,                         -- 扫描时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE
);

-- 5. 下载统计 (Download Stats)
-- 存储每日下载统计数据
CREATE TABLE IF NOT EXISTS download_stats (
    id TEXT PRIMARY KEY,
    app_id TEXT NOT NULL,
    version_id TEXT,                              -- 可选: 精确到版本
    stat_date DATE NOT NULL,                      -- 统计日期
    download_count INTEGER DEFAULT 0,             -- 当日下载次数
    unique_visitors INTEGER DEFAULT 0,            -- 独立访客数
    os_breakdown TEXT,                            -- 操作系统分布 (JSON)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (app_id) REFERENCES apps(id) ON DELETE CASCADE,
    UNIQUE(app_id, stat_date)                     -- 每天一条记录
);

-- 6. 搜索热词统计 (Search Analytics)
-- 用于分析用户搜索行为，优化选品
CREATE TABLE IF NOT EXISTS search_analytics (
    id TEXT PRIMARY KEY,
    search_query TEXT NOT NULL,                   -- 搜索关键词
    result_count INTEGER DEFAULT 0,               -- 返回结果数
    has_results INTEGER DEFAULT 0,                -- 是否有结果 (0/1)
    search_count INTEGER DEFAULT 0,               -- 搜索次数
    last_searched TIMESTAMP,                      -- 最后搜索时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(search_query)                          -- 关键词唯一
);

-- 7. 分类与标签字典 (Categories & Tags)
-- 预定义的场景分类和标签
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                    -- 分类名称
    slug TEXT NOT NULL UNIQUE,                    -- URL 标识
    description TEXT,                             -- 分类描述
    icon TEXT,                                    -- 图标
    sort_order INTEGER DEFAULT 0,                 -- 排序权重
    is_active INTEGER DEFAULT 1,                  -- 是否启用
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,                    -- 标签名称
    slug TEXT NOT NULL UNIQUE,                    -- URL 标识
    category TEXT,                                -- 所属分类
    usage_count INTEGER DEFAULT 0,                -- 使用次数
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. 系统配置表 (System Config)
-- 存储系统级配置和元数据
CREATE TABLE IF NOT EXISTS system_config (
    id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL UNIQUE,              -- 配置键
    config_value TEXT,                            -- 配置值 (JSON 字符串)
    description TEXT,                             -- 配置说明
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 索引优化 (Indexes)
-- ============================================

-- apps 表索引
CREATE INDEX IF NOT EXISTS idx_apps_category ON apps(category);
CREATE INDEX IF NOT EXISTS idx_apps_status ON apps(status);
CREATE INDEX IF NOT EXISTS idx_apps_featured ON apps(is_featured);
CREATE INDEX IF NOT EXISTS idx_apps_stars ON apps(stars_count DESC);
CREATE INDEX IF NOT EXISTS idx_apps_updated ON apps(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_apps_created ON apps(created_at DESC);

-- app_versions 表索引
CREATE INDEX IF NOT EXISTS idx_versions_app_id ON app_versions(app_id);
CREATE INDEX IF NOT EXISTS idx_versions_os ON app_versions(os_type);
CREATE INDEX IF NOT EXISTS idx_versions_stable ON app_versions(is_stable);

-- app_ai_content 表索引
CREATE INDEX IF NOT EXISTS idx_ai_content_app_id ON app_ai_content(app_id);
CREATE INDEX IF NOT EXISTS idx_ai_content_review ON app_ai_content(needs_human_review);

-- app_security 表索引
CREATE INDEX IF NOT EXISTS idx_security_app_id ON app_security(app_id);
CREATE INDEX IF NOT EXISTS idx_security_status ON app_security(audit_status);

-- download_stats 表索引
CREATE INDEX IF NOT EXISTS idx_stats_app_date ON download_stats(app_id, stat_date DESC);

-- search_analytics 表索引
CREATE INDEX IF NOT EXISTS idx_search_count ON search_analytics(search_count DESC);
CREATE INDEX IF NOT EXISTS idx_search_no_results ON search_analytics(has_results);

-- ============================================
-- 触发器 (Triggers) - 自动更新 updated_at
-- ============================================

CREATE TRIGGER IF NOT EXISTS update_apps_updated_at 
AFTER UPDATE ON apps
BEGIN
    UPDATE apps SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_ai_content_updated_at 
AFTER UPDATE ON app_ai_content
BEGIN
    UPDATE app_ai_content SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_search_analytics_updated_at 
AFTER UPDATE ON search_analytics
BEGIN
    UPDATE search_analytics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- ============================================
-- 初始数据 (Seed Data)
-- ============================================

-- 插入默认分类 (slug 与 apps.category 对齐，前端 data.ts 也使用同一 slug)
INSERT OR IGNORE INTO categories (id, name, slug, description, icon, sort_order) VALUES
    ('cat_001', '系统调优', 'system', '系统优化和调校工具', '⚙️', 1),
    ('cat_002', 'AI 生产力', 'ai', 'AI 辅助办公和创作工具', '🤖', 2),
    ('cat_003', '影音处理', 'video', '音视频编辑、转换和下载工具', '🎬', 3),
    ('cat_004', '纯净装机', 'clean-install', '系统安装和精简工具', '💻', 4),
    ('cat_005', '开发工具', 'dev-tools', '开发者实用工具', '🛠️', 5),
    ('cat_006', '隐私保护', 'privacy', '隐私保护和网络安全', '🔒', 6),
    ('cat_007', '文件管理', 'file-management', '文件管理和同步工具', '📁', 7),
    ('cat_008', '设计工具', 'design', '图片编辑和 UI 设计工具', '🎨', 8),
    ('cat_009', '办公提效', 'office', '文档处理和效率工具', '📄', 9);

-- 插入系统配置
INSERT OR IGNORE INTO system_config (id, config_key, config_value, description) VALUES
    ('cfg_001', 'site_name', '"OpenSource-Hub"', '网站名称'),
    ('cfg_002', 'max_apps_per_page', '20', '每页显示应用数'),
    ('cfg_003', 'cache_ttl_seconds', '3600', '缓存过期时间(秒)'),
    ('cfg_004', 'ai_model', '"gpt-4o-mini"', '默认 AI 模型'),
    ('cfg_005', 'vector_dimension', '384', '向量维度');
