# 路由与鉴权规范

> 对应 Bug 类型 B：新增功能忘改依赖配置
> 对应 Bug 类型 D：鉴权守卫逻辑范围错误

## 新增路由 Checklist

每次新增页面路由或 API 端点，逐项确认：

### 前端页面路由
```
[ ] routing.ts — locales 数组是否包含新 locale
[ ] middleware.ts — matcher 正则是否匹配新路径
[ ] i18n — 页面是否在 [locale]/ 目录下
[ ] 链接 — 导航是否使用 @/i18n/routing 的 Link（不是 <a href>）
[ ] 语言切换 — LanguageSwitcher 的 localeNames 是否包含
```

### API 端点
```
[ ] 路径注册 — 在 API Worker 的 GET/POST 路由分发中添加
[ ] 代理支持 — 如果新方法不是 GET，确认 /api/proxy 支持该方法
[ ] 鉴权 — admin 路由需要 adminAuth(request) 校验
[ ] 请求头 — 代理转发时是否保留了 Authorization 头
```

## 鉴权守卫规则

```
[ ] 登录页自身必须排除在鉴权检查之外
[ ] 公开 API 不加 adminAuth
[ ] adminAuth 检查：token === env.ADMIN_TOKEN && token.length > 0
[ ] 401 时前端清除 sessionStorage 并跳转登录页
```

## 代理转发规则

`/api/proxy` 当前支持的方法和请求头：
- 方法：GET、POST
- 请求头：Content-Type、Authorization
- 如需新增方法/请求头，改 `web/app/api/proxy/route.ts`

## 常见错误

| 错误 | 现象 |
|------|------|
| 忘改 middleware matcher | 整站 404 或构建失败 |
| 代理不支持 POST | admin 登录/审核返回 405/空响应 |
| 代理不转发 Authorization | admin 所有 API 401 |
| admin layout 对 login 页也鉴权 | 登录页无限重定向白屏 |
