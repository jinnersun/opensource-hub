#!/usr/bin/env tsx
/**
 * 种子数据加载脚本
 *
 * 输入: data/repos.json （由 seed-from-awesome.ts 生成的 owner/repo 清单）
 * 输出: data/seed-repos.sql （可由 wrangler d1 execute --file 直接执行）
 *
 * 设计要点：
 *   - 仅写入占位记录 (full_name + source + etl_status + next_check_at)
 *   - github_repo_id 留空 (NULL)，由 ETL Worker 首次拉取后回填
 *   - 使用 INSERT OR IGNORE 防止重复（依赖 full_name UNIQUE 约束）
 *   - 单条多 VALUES 批量 INSERT，分批 500 条避免 SQL 过长
 *
 * 使用方法:
 *   tsx scripts/seed-load-to-d1.ts
 *   或
 *   npm run seed:load
 *
 * 后续手动执行：
 *   wrangler d1 execute opensource-hub-db --remote --file=data/seed-repos.sql
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

interface SeedRepo {
  owner: string
  repo: string
  category: string
  tags: string[]
  source: string
}

interface SeedFile {
  source: string
  lastUpdated: string
  description: string
  totalCount: number
  repos: SeedRepo[]
}

const BATCH_SIZE = 500

function escapeSQLString(s: string): string {
  return s.replace(/'/g, "''")
}

function buildInsertBatch(repos: SeedRepo[]): string {
  const valuesList = repos
    .map(r => {
      const fullName = escapeSQLString(`${r.owner}/${r.repo}`)
      const source = escapeSQLString(r.source || 'awesome')
      return `  (NULL, '${fullName}', '${source}', 'pending', CURRENT_TIMESTAMP)`
    })
    .join(',\n')

  return [
    'INSERT OR IGNORE INTO raw_apps',
    '  (github_repo_id, full_name, source, etl_status, next_check_at)',
    'VALUES',
    valuesList + ';'
  ].join('\n')
}

async function main() {
  const reposPath = join(__dirname, '../data/repos.json')
  const outputPath = join(__dirname, '../data/seed-repos.sql')

  console.log(`📂 读取种子清单: ${reposPath}`)
  const raw = await readFile(reposPath, 'utf-8')
  const data = JSON.parse(raw) as SeedFile

  if (!Array.isArray(data.repos) || data.repos.length === 0) {
    console.error('❌ repos.json 中未发现可用项目')
    process.exit(1)
  }

  // 去重保险（按 owner/repo 大小写不敏感）
  const seen = new Set<string>()
  const unique: SeedRepo[] = []
  for (const r of data.repos) {
    const key = `${r.owner}/${r.repo}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(r)
  }

  console.log(`📊 原始记录: ${data.repos.length}, 去重后: ${unique.length}`)

  // 分批生成 SQL
  const lines: string[] = [
    '-- ==========================================',
    '-- OpenSource-Hub 种子数据导入',
    `-- 来源: ${data.source} (${data.lastUpdated})`,
    `-- 项目数: ${unique.length}`,
    `-- 生成时间: ${new Date().toISOString()}`,
    '-- ==========================================',
    '',
    '-- 仅写入占位（full_name + source + etl_status + next_check_at）',
    '-- 真实仓库元数据由 ETL Worker 首次拉取后回填',
    ''
  ]

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE)
    lines.push(`-- 批次 ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} 条`)
    lines.push(buildInsertBatch(batch))
    lines.push('')
  }

  // 末尾提供快速校验语句
  lines.push('-- 校验:')
  lines.push("-- SELECT COUNT(*) AS total, source FROM raw_apps GROUP BY source;")
  lines.push('')

  await writeFile(outputPath, lines.join('\n'), 'utf-8')
  console.log(`💾 SQL 已生成: ${outputPath}`)
  console.log('')
  console.log('👉 下一步执行:')
  console.log('   wrangler d1 execute opensource-hub-db --remote --file=data/seed-repos.sql')
}

main().catch(err => {
  console.error('❌ 失败:', err)
  process.exit(1)
})
