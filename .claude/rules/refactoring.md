# 重构与跨文件改动规范

> 对应 Bug 类型 A：不完整重构

## 规则

当改动涉及以下任一情况时，必须在改第一处之前先 `grep`：

- SQL 片段/常量：如 `LOCALE_FALLBACK_SQL`、`TRANSLATION_JOIN`、表别名
- 组件引用：如 `LanguageToggle` → `LanguageSwitcher`
- 函数签名：如 `searchApps(db, params)` → `searchApps(db, params, env)`
- 接口字段：如 `AdminStats` 新增 `translation` 字段

## 操作步骤

```
1. grep -n "旧模式" -- "workers/**/*.ts" "web/**/*.tsx" "web/**/*.ts"
2. 列出所有匹配行
3. 每处逐一检查：是否需要同步修改
4. 改完后再次 grep 确认无残留
```

## 典型案例

| 改动 | 漏了什么 | 正确做法 |
|------|---------|---------|
| `t` → `t_req`/`t_zh` | `getHomeData` featured_score 还引用 `t.summary` | grep `t\.` 全量检查 |
| `LOCALE_FALLBACK_SQL` 替换 | 4 个端点只改了 1 个 | grep `LOCALE_FALLBACK` 确认 0 残留 |
| `AdminStats` 加字段 | Dashboard 用了新字段但接口没加 | grep 新字段名确认前后端一致 |
| `LanguageSwitcher` 写好 | Header 还在 import 旧的 `LanguageToggle` | grep 组件名确认无旧引用 |
