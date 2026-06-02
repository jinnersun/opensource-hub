#!/bin/bash
# pre-commit hook: 语法检查 + 常见错误模式扫描
# 兼容 Windows (Git Bash) / macOS / Linux
# 安装: copy scripts\pre-commit.sh .git\hooks\pre-commit  (Windows)
#       cp scripts/pre-commit.sh .git/hooks/pre-commit      (macOS/Linux)

STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx)$')
if [ -z "$STAGED" ]; then exit 0; fi

ERRORS=0
echo ""
echo "=== pre-commit: 检查暂存文件 ==="

for f in $STAGED; do
  # 跳过无关目录
  case "$f" in
    node_modules/*|.next/*|.open-next/*) continue ;;
  esac

  # 确保文件存在（可能被删除）
  if [ ! -f "$f" ]; then continue; fi

  # 1. 单行无花括号 if/else (SWC 拒绝)
  # macOS/BSD grep 不支持 -P，用 -E 替代
  if grep -nE '^\s*if\s*\([^)]+\)\s+[a-zA-Z_]+.*\s+else\s+[a-zA-Z_]' "$f" 2>/dev/null; then
    echo "  ❌ $f: 单行无花括号 if/else (SWC 不兼容，请改为三元表达式或加 {})"
    ERRORS=$((ERRORS + 1))
  fi

  # 2. 花括号平衡检查
  OPEN=$(grep -c '{' "$f" 2>/dev/null || echo 0)
  CLOSE=$(grep -c '}' "$f" 2>/dev/null || echo 0)
  if [ "$OPEN" -ne "$CLOSE" ]; then
    echo "  ⚠️  $f: 花括号不平衡 (开:$OPEN 闭:$CLOSE) — 可能正常（JSX 模板表达式），请人工确认"
  fi
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "❌ 发现 $ERRORS 个语法问题，提交已阻止。"
  echo "   修复后重新: git add 文件 && git commit"
  exit 1
fi

echo "✅ 语法检查通过"
exit 0
