/**
 * SQL 共享常量
 * 用于多语言翻译的 LEFT JOIN 和 SELECT 字段
 */

// 双 LEFT JOIN 翻译回退：t_req=请求语言，t_zh=中文兜底
// 替代旧的相关子查询写法（D1/SQLite 对 JOIN ON 中相关子查询处理不稳定，会静默 fallback 导致翻译字段全 NULL）
// 安全要点：使用 ? 占位符，由调用方 bind(lang, ...) 传入，防 SQL 注入
export const TRANSLATION_JOIN =
  `LEFT JOIN app_translations t_req ON t_req.app_id = a.id AND t_req.locale = ?
   LEFT JOIN app_translations t_zh ON t_zh.app_id = a.id AND t_zh.locale = 'zh'`

export const TRANSLATION_SELECT =
  `COALESCE(t_req.summary, t_zh.summary) as summary,
   COALESCE(t_req.description, t_zh.description) as trans_desc,
   COALESCE(t_req.full_description, t_zh.full_description) as trans_full_desc,
   COALESCE(t_req.features, t_zh.features) as features,
   COALESCE(t_req.use_cases, t_zh.use_cases) as use_cases,
   COALESCE(t_req.quick_start_guide, t_zh.quick_start_guide) as quick_start_guide,
   COALESCE(t_req.uninstall_guide, t_zh.uninstall_guide) as uninstall_guide,
   COALESCE(t_req.caveats, t_zh.caveats) as caveats`
