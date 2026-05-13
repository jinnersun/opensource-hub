-- 013: apps 表新增 etl_processed_at 列，用于 Trending "今日新入库" 筛选
ALTER TABLE apps ADD COLUMN etl_processed_at TIMESTAMP;
-- 回填已有数据：用 created_at 作为首次处理时间
UPDATE apps SET etl_processed_at = created_at WHERE etl_processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apps_etl_processed ON apps(etl_processed_at DESC);
