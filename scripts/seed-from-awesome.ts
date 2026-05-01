#!/usr/bin/env tsx
/**
 * 从 awesome 仓库提取种子项目
 * 来源：awesome-windows, awesome-mac, awesome-selfhosted
 */

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

interface GitHubRepo {
  owner: string
  repo: string
  category: string
  tags: string[]
  source: string
}

const AWESOME_SOURCES = [
  {
    name: 'awesome-windows',
    url: 'https://raw.githubusercontent.com/Awesome-Windows/Awesome/main/README.md',
    category: 'windows'
  },
  {
    name: 'awesome-mac',
    url: 'https://raw.githubusercontent.com/jaywcjlove/awesome-mac/master/README.md',
    category: 'mac'
  },
  {
    name: 'awesome-selfhosted',
    url: 'https://raw.githubusercontent.com/awesome-selfhosted/awesome-selfhosted/master/README.md',
    category: 'selfhosted'
  }
]

// 提取 GitHub 链接的正则
const GITHUB_REGEX = /https:\/\/github\.com\/([^\/\s]+)\/([^\/\s\)]+)/g

// 黑名单：排除 awesome 列表本身和明显不是软件的项目
const BLACKLIST = new Set([
  'awesome-windows', 'awesome-mac', 'awesome-selfhosted',
  'awesome', 'curated-list', 'list', 'lists',
  'jaywcjlove', 'Awesome-Windows'
])

async function fetchAwesomeReadme(url: string): Promise<string> {
  console.log(`📥 下载: ${url}`)
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'OpenSource-Hub-Seeder/1.0',
      'Accept': 'text/plain'
    }
  })
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  
  return response.text()
}

function extractRepos(markdown: string, sourceName: string): GitHubRepo[] {
  const repos: Map<string, GitHubRepo> = new Map()
  let match: RegExpExecArray | null
  
  // 重置正则
  GITHUB_REGEX.lastIndex = 0
  
  while ((match = GITHUB_REGEX.exec(markdown)) !== null) {
    const owner = match[1]
    const repo = match[2].replace(/\)$/, '') // 移除可能的尾部括号
    
    // 跳过黑名单
    if (BLACKLIST.has(repo) || BLACKLIST.has(owner)) continue
    
    // 跳过特定类型的仓库
    if (repo.toLowerCase().includes('awesome') || 
        repo.toLowerCase().includes('list') ||
        repo.toLowerCase().includes('guide')) continue
    
    const key = `${owner}/${repo}`
    if (!repos.has(key)) {
      repos.set(key, {
        owner,
        repo,
        category: sourceName,
        tags: [sourceName],
        source: 'awesome'
      })
    }
  }
  
  return Array.from(repos.values())
}

async function main() {
  const allRepos: GitHubRepo[] = []
  
  for (const source of AWESOME_SOURCES) {
    try {
      const markdown = await fetchAwesomeReadme(source.url)
      const repos = extractRepos(markdown, source.category)
      console.log(`✅ ${source.name}: 发现 ${repos.length} 个项目`)
      allRepos.push(...repos)
      
      // 速率限制：等待 1 秒
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      console.error(`❌ ${source.name} 失败:`, error)
    }
  }
  
  // 去重
  const uniqueRepos = Array.from(
    new Map(allRepos.map(r => [`${r.owner}/${r.repo}`, r])).values()
  )
  
  console.log(`\n📊 总计: ${uniqueRepos.length} 个唯一项目`)
  
  // 保存为 repos.json
  const output = {
    source: 'awesome-lists',
    lastUpdated: new Date().toISOString(),
    description: '从 awesome-windows, awesome-mac, awesome-selfhosted 提取的种子项目',
    totalCount: uniqueRepos.length,
    repos: uniqueRepos
  }
  
  const outputPath = join(__dirname, '../data/repos.json')
  await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')
  console.log(`\n💾 已保存: ${outputPath}`)
  
  // 同时生成 SQL 插入语句
  const sqlLines = [
    '-- 种子数据插入（从 awesome 列表提取）',
    `INSERT INTO raw_apps (github_repo_id, full_name, raw_api_data, readme_content, etl_status, next_check_at) VALUES`,
  ]
  
  const values = uniqueRepos.map(repo => 
    `  (NULL, '${repo.owner}/${repo.repo}', NULL, NULL, 'pending', datetime('now'))`
  ).join(',\n')
  
  await writeFile(
    join(__dirname, '../data/seed-repos.sql'),
    sqlLines.join('\n') + '\n' + values + ';',
    'utf-8'
  )
  console.log(`💾 SQL 已保存: data/seed-repos.sql`)
}

main().catch(console.error)
