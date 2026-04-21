@echo off
REM OpenSource-Hub D1 数据库初始化脚本 (Windows)
REM 使用方法: scripts\init-db.bat

echo ========================================
echo OpenSource-Hub D1 数据库初始化
echo ========================================
echo.

REM 检查是否已安装 wrangler
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 wrangler CLI
    echo 请先安装: npm install -g wrangler
    pause
    exit /b 1
)

REM 检查是否已登录
echo [1/4] 检查 Cloudflare 登录状态...
wrangler whoami >nul 2>nul
if %errorlevel% neq 0 (
    echo [提示] 请先登录 Cloudflare
    wrangler login
)

REM 创建数据库
echo.
echo [2/4] 创建 D1 数据库...
wrangler d1 create opensource-hub-db

echo.
echo [3/4] 执行数据库迁移...
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql

if %errorlevel% neq 0 (
    echo [错误] 数据库迁移失败
    pause
    exit /b 1
)

REM 验证表结构
echo.
echo [4/4] 验证表结构...
wrangler d1 execute opensource-hub-db --command ".tables"

echo.
echo ========================================
echo 数据库初始化完成!
echo ========================================
echo.
echo 下一步:
echo   1. 查看数据库文档: type migrations\README.md
echo   2. 导入示例数据: wrangler d1 execute opensource-hub-db --file migrations\002_seed_data.sql
echo   3. 启动开发服务器: npm run dev
echo.
pause
