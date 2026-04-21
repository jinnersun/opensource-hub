#!/bin/bash

# OpenSource-Hub D1 数据库初始化脚本
# 使用方法: bash scripts/init-db.sh

echo "🚀 开始初始化 Cloudflare D1 数据库..."

# 检查是否已安装 wrangler
if ! command -v wrangler &> /dev/null; then
    echo "❌ 错误: 未找到 wrangler CLI"
    echo "请先安装: npm install -g wrangler"
    exit 1
fi

# 检查是否已登录
echo "📝 检查 Cloudflare 登录状态..."
wrangler whoami &> /dev/null
if [ $? -ne 0 ]; then
    echo "🔐 请先登录 Cloudflare:"
    wrangler login
fi

# 创建数据库
echo "📦 创建 D1 数据库..."
DATABASE_INFO=$(wrangler d1 create opensource-hub-db 2>&1)
echo "$DATABASE_INFO"

# 提取 database_id
DATABASE_ID=$(echo "$DATABASE_INFO" | grep -o '"database_id": "[^"]*"' | cut -d'"' -f4)

if [ -z "$DATABASE_ID" ]; then
    echo "⚠️  数据库可能已存在，尝试获取现有数据库信息..."
    DATABASE_ID=$(wrangler d1 list 2>&1 | grep "opensource-hub-db" | awk '{print $2}')
fi

if [ -n "$DATABASE_ID" ]; then
    echo "✅ 数据库 ID: $DATABASE_ID"
    
    # 更新 wrangler.toml
    echo "📝 更新 wrangler.toml 配置..."
    sed -i "s/database_id = \"your-database-id\"/database_id = \"$DATABASE_ID\"/" wrangler.toml
    
    echo "✅ wrangler.toml 已更新"
else
    echo "❌ 无法获取数据库 ID，请手动更新 wrangler.toml"
    exit 1
fi

# 执行迁移
echo "🔧 执行数据库迁移..."
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql

if [ $? -eq 0 ]; then
    echo "✅ 数据库迁移成功!"
else
    echo "❌ 数据库迁移失败"
    exit 1
fi

# 验证表结构
echo "🔍 验证表结构..."
wrangler d1 execute opensource-hub-db --command ".tables"

echo ""
echo "🎉 数据库初始化完成!"
echo ""
echo "📋 下一步:"
echo "  1. 查看数据库文档: cat migrations/README.md"
echo "  2. 导入示例数据: wrangler d1 execute opensource-hub-db --file migrations/002_seed_data.sql"
echo "  3. 启动开发服务器: npm run dev"
echo ""
