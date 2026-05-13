/**
 * 一次性脚本: 用新 Prompt 重生成所有 app 的 AI 内容 + 调用 m2m100 翻译
 * 用法: cd scripts && npx tsx reprocess-ai-content.ts
 * 需要环境变量: DEEPSEEK_API_KEY, CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID
 */

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'
const CF_AI_API = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`
const D1_API = (accountId: string, dbId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`

// ========== 配置 ==========
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID || '063b426850c4c65d45b0809040ec8a71'
const CF_TOKEN = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
const D1_DB = process.env.D1_DATABASE_ID || '9989fa14-ca29-46ef-8c9f-9ab55f6b47d7'

const BATCH_SIZE = 3  // DeepSeek 并发限制
const DELAY_MS = 1000

// ========== AI Prompt ==========
const PROMPT = `你是一个专业的开源软件分析师。请分析以下 GitHub 项目并生成结构化双语内容。

项目: {name} | Stars: {stars} | 协议: {license} | README: {readme}

返回 JSON:
{
  "name":"项目名", "slug":"url-friendly",
  "description":"English short desc (under 50 words)",
  "fullDescription":"English full desc (under 200 words)",
  "fullDescriptionZh":"中文完整描述（200字以内）",
  "category":"system|ai|video|privacy|clean-install|dev-tools|file-management|design|office",
  "tags":["tag1","tag2"],
  "license":"MIT etc",
  "homepage":"",
  "descriptionZh":"中文简短描述（50字以内）",
  "summaryZh":"一句话白话总结（中文30字内）",
  "featuresZh":["功能1","功能2"],
  "useCasesZh":["场景1"],
  "quickStartGuideZh":["步骤1：下载并双击运行","步骤2：按向导安装","步骤3：启动使用"],
  "uninstallGuideZh":"卸载说明",
  "caveatsZh":"避坑指南",
  "summaryEn":"One-sentence summary (English under 30 words)",
  "descriptionEn":"Short English desc",
  "featuresEn":["Feature 1"],
  "useCasesEn":["Use case 1"],
  "quickStartGuideEn":["Step 1: Download and run","Step 2: Follow wizard","Step 3: Launch"],
  "uninstallGuideEn":"Uninstall guide",
  "caveatsEn":"Caveats",
  "qualityScore":0.9,
  "modelVersion":"deepseek-v4-flash"
}

要求:
1. 通俗易懂，避免技术黑话
2. 突出核心卖点
3. 明确避坑
4. 以技术评测口吻指出相比同类工具的1-2个独特优势，做简短对比
5. 中英双语都必须生成，中文地道中文，英文地道英文
6. 返回纯JSON，不要markdown代码块
7. quickStartGuide必须是字符串数组`

// ========== 工具函数 ==========
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

async function d1Query(sql: string, params: any[] = []) {
  const r = await fetch(D1_API(CF_ACCOUNT, D1_DB), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const d = await r.json() as any
  if (!d.success) throw new Error(JSON.stringify(d.errors))
  return d.result[0]?.results || []
}

async function deepseekGenerate(repo: any, readme: string): Promise<any> {
  const prompt = PROMPT
    .replace('{name}', repo.name || '')
    .replace('{stars}', String(repo.stargazers_count || 0))
    .replace('{license}', repo.license || 'Unknown')
    .replace('{readme}', (readme || '').slice(0, 8000))

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.3 + attempt * 0.15, max_tokens: 2000 }),
        signal: AbortSignal.timeout(60000),
      })
      if (!r.ok) { console.warn(`  DeepSeek HTTP ${r.status}`); await delay(2000); continue }
      const d = await r.json() as any
      const raw = d.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      return JSON.parse(cleaned)
    } catch (e) { console.warn(`  Attempt ${attempt + 1} failed:`, (e as Error).message); await delay(2000) }
  }
  throw new Error('DeepSeek failed after 3 attempts')
}

async function translateText(text: string, source: string, target: string): Promise<string> {
  if (!text?.trim()) return text
  try {
    const r = await fetch(CF_AI_API(CF_ACCOUNT), {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_lang: source, target_lang: target }),
    })
    const d = await r.json() as any
    return d.result?.translated_text || text
  } catch { return text }
}

async function writeTranslations(appId: string, locale: string, aiContent: any) {
  const sum = locale === 'zh' ? aiContent.summaryZh : aiContent.summaryEn
  const desc = locale === 'zh' ? (aiContent.descriptionZh || aiContent.description) : (aiContent.descriptionEn || aiContent.description)
  const full = locale === 'zh' ? (aiContent.fullDescriptionZh || aiContent.fullDescription) : (aiContent.fullDescriptionEn || aiContent.fullDescription)
  const feat = locale === 'zh' ? aiContent.featuresZh : aiContent.featuresEn
  const usec = locale === 'zh' ? aiContent.useCasesZh : aiContent.useCasesEn
  const qs = locale === 'zh' ? aiContent.quickStartGuideZh : aiContent.quickStartGuideEn
  const uninst = locale === 'zh' ? aiContent.uninstallGuideZh : aiContent.uninstallGuideEn
  const cav = locale === 'zh' ? aiContent.caveatsZh : aiContent.caveatsEn

  await d1Query(
    `INSERT OR REPLACE INTO app_translations (id, app_id, locale, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats, translated_by, ai_model_version, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', 'deepseek-v4-flash', ?)`,
    [`tr_${appId}_${locale}`, appId, locale, sum, desc, full, JSON.stringify(feat || []), JSON.stringify(usec || []), JSON.stringify(qs || []), uninst || '', cav || '', aiContent.qualityScore || 0.85],
  )
}

// ========== 主流程 ==========
async function main() {
  if (!DEEPSEEK_KEY) { console.error('❌ 缺少 DEEPSEEK_API_KEY'); process.exit(1) }
  if (!CF_TOKEN) { console.error('❌ 缺少 CF_API_TOKEN'); process.exit(1) }

  // 1. 获取所有需处理的 app
  console.log('📡 获取 apps 列表...')
  const rows = await d1Query(
    `SELECT a.id, a.name, r.full_name, r.readme_content, r.raw_api_data
     FROM apps a JOIN raw_apps r ON r.github_repo_id = CAST(SUBSTR(a.id, 5) AS INTEGER)
     WHERE a.status = 'active' AND r.readme_content IS NOT NULL
     ORDER BY a.stars_count DESC`
  )
  console.log(`✅ ${rows.length} 个 app 待处理`)

  let ok = 0, fail = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any
    const appId = row.id
    let repo: any = {}
    try { repo = JSON.parse(row.raw_api_data || '{}') } catch {}

    console.log(`[${i + 1}/${rows.length}] ${appId} (${row.name})`)
    try {
      // AI 生成
      const ai = await deepseekGenerate(repo, row.readme_content || '')
      // 更新 apps 主表
      await d1Query(
        `UPDATE apps SET description=?, full_description=?, category=?, tags=?, license=?, homepage_url=?, last_updated=CURRENT_TIMESTAMP WHERE id=?`,
        [ai.description || '', ai.fullDescription || '', ai.category || '', JSON.stringify(ai.tags || []), ai.license || '', ai.homepage || '', appId],
      )
      // 写入 zh + en 翻译
      await writeTranslations(appId, 'zh', ai)
      await writeTranslations(appId, 'en', ai)
      ok++
      console.log(`  ✅ ok`)
    } catch (e) {
      fail++
      console.error(`  ❌ ${(e as Error).message.slice(0, 100)}`)
    }
    await delay(DELAY_MS)
  }

  console.log(`\n📊 AI 重生成完成: ok=${ok} fail=${fail}`)

  // 2. 获取所有 app_translations 的 zh 内容并翻译为 ja/ko/es/pt-BR
  console.log('\n🌐 开始翻译为 ja/ko/es/pt-BR...')
  const zhRows = await d1Query(
    `SELECT app_id, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats
     FROM app_translations WHERE locale = 'zh' AND (summary IS NOT NULL OR full_description IS NOT NULL)`
  )
  console.log(`✅ ${zhRows.length} 条 zh 内容待翻译`)

  const locales = ['ja', 'ko', 'es', 'pt-BR']
  let tOk = 0, tFail = 0
  for (let i = 0; i < zhRows.length; i++) {
    const src = zhRows[i] as any
    for (const tl of locales) {
      try {
        const sum = await translateText(src.summary || '', 'zh', tl)
        const desc = await translateText(src.description || '', 'zh', tl)
        const full = await translateText(src.full_description || '', 'zh', tl)
        const feat = await translateText(src.features || '', 'zh', tl)
        const usec = await translateText(src.use_cases || '', 'zh', tl)
        const qs = await translateText(src.quick_start_guide || '', 'zh', tl)
        const uninst = await translateText(src.uninstall_guide || '', 'zh', tl)
        const cav = await translateText(src.caveats || '', 'zh', tl)
        await d1Query(
          `INSERT OR REPLACE INTO app_translations (id, app_id, locale, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats, translated_by, ai_model_version, quality_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cf-m2m100', 'm2m100-1.2b', 0.85)`,
          [`tr_${src.app_id}_${tl}`, src.app_id, tl, sum, desc, full, feat, usec, qs, uninst, cav],
        )
        tOk++
      } catch (e) {
        tFail++
        if (tFail <= 3) console.warn(`  ❌ ${src.app_id}→${tl}: ${(e as Error).message.slice(0, 80)}`)
      }
      await delay(200)
    }
    if ((i + 1) % 10 === 0) console.log(`  翻译进度: ${i + 1}/${zhRows.length}`)
  }

  // 3. 清理翻译任务表
  await d1Query(`DELETE FROM translation_tasks`)
  console.log(`\n📊 翻译完成: ok=${tOk} fail=${tFail}`)
  console.log('🎉 全部完成！可提交 sitemap 到 Google Search Console')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
