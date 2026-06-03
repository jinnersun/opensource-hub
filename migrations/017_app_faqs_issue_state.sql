-- ==========================================
-- FAQ 系统: 扩展 app_faqs 表
-- 用途: 新增 issue_state 字段区分已解决 FAQ 和已知 BUG 预警
-- 日期: 2026-06-02
-- ==========================================

-- 扩展 app_faqs 表 (新增 issue_state 字段)
-- 'closed' = 已解决 FAQ
-- 'open' = 已知 BUG 预警
ALTER TABLE app_faqs ADD COLUMN issue_state TEXT DEFAULT 'closed';
