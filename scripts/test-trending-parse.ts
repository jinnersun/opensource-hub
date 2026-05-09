/**
 * 本地干跑：验证 GitHub Trending HTML 解析是否能正确抽取 owner/repo
 * 不写数据库、不调 GitHub API、不需要 Token
 * 运行：cd scripts && npx tsx test-trending-parse.ts
 */

function parseTrendingHtml(html: string): Array<{ owner: string; repo: string }> {
  const results: Array<{ owner: string; repo: string }> = []
  const seen = new Set<string>()
  const articleRe = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g
  const blacklistOwner = new Set(['search', 'explore', 'trending', 'topics', 'collections', 'marketplace', 'login', 'signup', 'sponsors'])

  let m: RegExpExecArray | null
  while ((m = articleRe.exec(html))) {
    const body = m[1]
    const linkRe = /<a[^>]*href="\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*?)"(?![^>]*\/stargazers)/g
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRe.exec(body))) {
      const owner = linkMatch[1]
      const repo = linkMatch[2]
      if (blacklistOwner.has(owner.toLowerCase())) continue
      if (repo.length < 1 || repo.length > 100) continue
      const key = `${owner}/${repo}`
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ owner, repo })
      break
    }
  }
  return results
}

async function main() {
  const windows = ['daily', 'weekly', 'monthly'] as const
  const aggregate = new Map<string, string[]>()

  for (const since of windows) {
    const url = `https://github.com/trending?since=${since}`
    console.log(`\n🔎 ${url}`)
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (OpenSource-Hub Trending Test)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      })
      if (!res.ok) {
        console.warn(`   HTTP ${res.status}`)
        continue
      }
      const html = await res.text()
      console.log(`   HTML size: ${(html.length / 1024).toFixed(1)} KB`)
      const articleCount = (html.match(/<article[^>]*class="[^"]*Box-row/g) || []).length
      console.log(`   原始 article.Box-row 数量: ${articleCount}`)
      const repos = parseTrendingHtml(html)
      console.log(`   解析出 ${repos.length} 个仓库`)
      console.log(`   前 5 个样本:`)
      repos.slice(0, 5).forEach((r, i) => console.log(`     ${i + 1}. ${r.owner}/${r.repo}`))

      for (const r of repos) {
        const key = `${r.owner}/${r.repo}`
        if (!aggregate.has(key)) aggregate.set(key, [])
        aggregate.get(key)!.push(since)
      }
    } catch (err) {
      console.error(`   抓取失败:`, (err as Error).message)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  console.log(`\n═════════════════ 汇总 ═════════════════`)
  console.log(`独立仓库总数: ${aggregate.size}`)
  const multi = [...aggregate.entries()].filter(([, wins]) => wins.length > 1)
  console.log(`多窗口重合: ${multi.length}`)
  multi.slice(0, 10).forEach(([k, w]) => console.log(`  ${k}  [${w.join(', ')}]`))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
