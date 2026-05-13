# 编码风格规范

> 参考 everything-claude-code rules/common/coding-style.md
> 覆盖 Bug 类型 F：JS 语法兼容 + 通用规范

## 强制规则

### 禁止单行无花括号 if/else
```typescript
// ❌ SWC 会报 Syntax Error
if (x) doA() else doB()

// ✅ 正确
x ? doA() : doB()
// 或
if (x) { doA() } else { doB() }
```

### 不变性
- 始终创建新对象/数组，不修改原值
- React state 用 spread 或 filter 返回新引用
- `Set` 在 React 中可能导致渲染问题，优先用数组

### 错误处理
- 所有 try/catch 必须输出 `console.error` 或 `console.warn`
- UI 层错误要给用户可理解的提示
- 后台静默失败必须加注释说明原因

### 命名
- 变量/函数：camelCase
- 组件/接口：PascalCase
- 常量：UPPER_SNAKE_CASE
- 布尔：is/has/should 前缀

## 代码质量

- 函数 < 50 行
- 文件 < 800 行
- 嵌套 < 4 层
- 用命名常量替代魔法数字
- 优先早返回，避免深层嵌套

## 提交前检查

```
[ ] 无单行无花括号 if/else
[ ] 无 console.log（用 console.error/warn）
[ ] 无硬编码密钥/Token
[ ] 所有 SQL 参数化（用 ? 占位符）
[ ] 前端 API 返回值有判空
[ ] 内部链接用 i18n Link
```
