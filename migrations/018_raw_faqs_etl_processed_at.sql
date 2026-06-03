-- 为 raw_faqs 表添加 ETL 处理时间字段
ALTER TABLE raw_faqs ADD COLUMN etl_processed_at TIMESTAMP;
