-- ============================================
-- OpenSource-Hub D1 数据库迁移脚本
-- 版本: V020
-- 描述: raw_faqs 增强字段 — 评论 + Linked PR
-- ============================================

ALTER TABLE raw_faqs ADD COLUMN issue_comments TEXT;
  -- JSON: [{"body":"...", "author":"...", "reactions":{"+1":3, "heart":1}}]

ALTER TABLE raw_faqs ADD COLUMN linked_prs TEXT;
  -- JSON: [{"title":"Fix: adjust buffer size", "body":"..."}]
