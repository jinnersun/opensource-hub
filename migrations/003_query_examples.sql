-- ============================================
-- OpenSource-Hub 常用查询示例
-- 供开发和参考使用
-- ============================================

-- 1. 获取所有活跃的推荐应用
SELECT name, description, category, stars_count, github_url
FROM apps
WHERE status = 'active' AND is_featured = 1
ORDER BY stars_count DESC;

-- 2. 按分类查询应用
SELECT a.name, a.description, a.stars_count, ac.summary
FROM apps a
LEFT JOIN app_ai_content ac ON a.id = ac.app_id
WHERE a.category = '#影音处理' AND a.status = 'active'
ORDER BY a.stars_count DESC;

-- 3. 获取应用的最新版本 (Windows 稳定版)
SELECT v.version, v.file_type, v.file_size, v.download_url, v.release_date
FROM app_versions v
WHERE v.app_id = 'app_001'
  AND v.os_type = 'windows'
  AND v.is_stable = 1
ORDER BY v.release_date DESC
LIMIT 1;

-- 4. 获取应用的完整信息 (详情页使用)
SELECT 
    a.name,
    a.description,
    a.github_url,
    a.license,
    a.stars_count,
    ac.summary,
    ac.what_it_does,
    ac.what_it_cant_do,
    ac.quick_start_guide,
    ac.is_portable,
    ac.requirements,
    ac.uninstall_guide,
    s.virustotal_url,
    s.audit_status
FROM apps a
LEFT JOIN app_ai_content ac ON a.id = ac.app_id
LEFT JOIN app_security s ON a.id = s.app_id
WHERE a.slug = 'obs-studio';

-- 5. 语义搜索 (基础版 - 使用关键词匹配)
-- 注意: 完整的语义搜索需要使用 Supabase pgvector
SELECT name, description, category, tags
FROM apps
WHERE status = 'active'
  AND (
    description LIKE '%录屏%'
    OR tags LIKE '%录屏%'
    OR name LIKE '%录屏%'
  )
ORDER BY stars_count DESC
LIMIT 20;

-- 6. 获取下载排行榜 (最近7天)
SELECT 
    a.name,
    a.slug,
    SUM(s.download_count) as total_downloads
FROM download_stats s
JOIN apps a ON s.app_id = a.id
WHERE s.stat_date >= date('now', '-7 days')
GROUP BY a.id
ORDER BY total_downloads DESC
LIMIT 10;

-- 7. 获取需要人工审核的 AI 内容
SELECT 
    a.name,
    a.github_url,
    ac.summary,
    ac.confidence_score,
    ac.needs_human_review
FROM app_ai_content ac
JOIN apps a ON ac.app_id = a.id
WHERE ac.needs_human_review = 1
ORDER BY ac.confidence_score ASC;

-- 8. 搜索无结果的关键词 (用于选品参考)
SELECT search_query, search_count
FROM search_analytics
WHERE has_results = 0
ORDER BY search_count DESC
LIMIT 20;

-- 9. 获取应用的所有下载链接 (按操作系统分组)
SELECT 
    v.os_type,
    v.arch,
    v.file_type,
    v.version,
    v.download_url,
    v.file_size
FROM app_versions v
WHERE v.app_id = 'app_001' AND v.is_stable = 1
ORDER BY 
    CASE v.os_type
        WHEN 'windows' THEN 1
        WHEN 'macos' THEN 2
        WHEN 'linux' THEN 3
    END,
    v.release_date DESC;

-- 10. 统计每个分类的应用数量
SELECT 
    category,
    COUNT(*) as app_count,
    SUM(stars_count) as total_stars
FROM apps
WHERE status = 'active'
GROUP BY category
ORDER BY app_count DESC;

-- 11. 获取最近更新的應用
SELECT name, description, last_updated, stars_count
FROM apps
WHERE status = 'active'
ORDER BY last_updated DESC
LIMIT 20;

-- 12. 分页查询 (第2页，每页20条)
SELECT name, description, category, stars_count
FROM apps
WHERE status = 'active'
ORDER BY stars_count DESC
LIMIT 20 OFFSET 20;  -- 第2页

-- 13. 获取应用的安全报告
SELECT 
    a.name,
    s.virustotal_url,
    s.virustotal_score,
    s.audit_status,
    s.scanned_at
FROM app_security s
JOIN apps a ON s.app_id = a.id
WHERE s.audit_status = 'passed'
ORDER BY s.scanned_at DESC;

-- 14. 更新下载计数
UPDATE app_versions
SET download_count = download_count + 1
WHERE id = 'ver_001';

-- 15. 记录搜索统计
INSERT INTO search_analytics (id, search_query, result_count, has_results, search_count, last_searched)
VALUES (
    'search_new',
    'AI绘图工具',
    0,
    0,
    1,
    CURRENT_TIMESTAMP
)
ON CONFLICT(search_query) DO UPDATE SET
    search_count = search_count + 1,
    last_searched = CURRENT_TIMESTAMP;
