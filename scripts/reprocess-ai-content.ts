/**
 * 一次性脚本: DeepSeek 重生成 AI 内容 + m2m100 翻译
 * 结果写入 apps_staging / app_translations_staging (中间表)
 * 确认后手动执行迁移 SQL 同步到生产表
 *
 * 用法: cd scripts && npx tsx reprocess-ai-content.ts
 * 环境变量: DEEPSEEK_API_KEY, CF_API_TOKEN
 */

const DEEPSEEK_API = 'https://api.deepseek.com/chat_completions'
const CF_AI = (accountId: string) => `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`
const D1_API = (accountId: string, dbId: string) => `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || ''
const CF_ACCOUNT = process.env.CF_ACCOUNT_ID || '063b426850c4c65d45b0809040ec8a71'
const CF_TOKEN = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || ''
const D1_DB = process.env.D1_DATABASE_ID || '9989fa14-ca29-46ef-8c9f-9ab55f6b47d7'

const VALID_CATEGORIES = ['system','ai','video','privacy','clean-install','dev-tools','file-management','design','office']
const DELAY = 1500  // DeepSeek 调用间隔

// ========== 工具函数 ==========
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function d1Query(sql: string, params: any[] = []) {
  const r = await fetch(D1_API(CF_ACCOUNT, D1_DB), {
    method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const d = await r.json() as any
  if (!d.success) throw new Error(JSON.stringify(d.errors))
  return d.result[0]?.results || []
}

async function d1Exec(sql: string, params: any[] = []) {
  const r = await fetch(D1_API(CF_ACCOUNT, D1_DB), {
    method: 'POST', headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, params }),
  })
  const d = await r.json() as any
  if (!d.success) throw new Error(JSON.stringify(d.errors))
}

// ========== AI 校验 (从 workers/etl/src/ai.ts 复制) ==========
function toStringField(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(x => String(x)).join('\n')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
function toStringArray(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map(x => String(x))
  if (typeof v === 'string') return v.split(/\n|,/).map(s => s.trim()).filter(Boolean)
  return [String(v)]
}
function normalizeAIResult(r: any) {
  r.name = toStringField(r.name); r.slug = toStringField(r.slug)
  r.description = toStringField(r.description); r.fullDescription = toStringField(r.fullDescription)
  r.category = toStringField(r.category).toLowerCase().trim()
  r.license = toStringField(r.license); r.homepage = toStringField(r.homepage)
  r.summaryZh = toStringField(r.summaryZh); r.summaryEn = toStringField(r.summaryEn)
  r.descriptionEn = toStringField(r.descriptionEn); r.descriptionZh = toStringField(r.descriptionZh)
  r.fullDescriptionZh = toStringField(r.fullDescriptionZh); r.fullDescriptionEn = toStringField(r.fullDescriptionEn)
  r.uninstallGuideZh = toStringField(r.uninstallGuideZh); r.uninstallGuideEn = toStringField(r.uninstallGuideEn)
  r.caveatsZh = toStringField(r.caveatsZh); r.caveatsEn = toStringField(r.caveatsEn)
  r.modelVersion = toStringField(r.modelVersion) || 'deepseek-v4-flash'
  r.tags = toStringArray(r.tags)
  r.featuresZh = toStringArray(r.featuresZh); r.featuresEn = toStringArray(r.featuresEn)
  r.useCasesZh = toStringArray(r.useCasesZh); r.useCasesEn = toStringArray(r.useCasesEn)
  r.quickStartGuideZh = toStringArray(r.quickStartGuideZh); r.quickStartGuideEn = toStringArray(r.quickStartGuideEn)
  if (typeof r.qualityScore !== 'number') { const n = Number(r.qualityScore); r.qualityScore = Number.isFinite(n) ? n : 0.5 }
  r.qualityScore = Math.max(0, Math.min(1, r.qualityScore))
}
function validateAIResult(r: any): boolean {
  if (!r?.name || !r.slug || !r.category) return false
  if (!VALID_CATEGORIES.includes(r.category)) return false
  if (!r.summaryZh || !r.summaryEn) return false
  if (typeof r.qualityScore !== 'number') return false
  return true
}

// ========== Prompt ==========
const PROMPT = `你是一个专业的开源软件分析师。请分析以下 GitHub 项目并生成结构化双语内容。

项目: {name} | Stars: {stars} | 协议: {license} | README: {readme}

返回 JSON (必须全部包含, 不含 markdown 代码块):
{
  "name":"项目名", "slug":"url-friendly",
  "description":"English short desc (under 50 words)",
  "fullDescription":"English full desc (under 200 words)",
  "fullDescriptionZh":"中文完整描述(200字以内)",
  "category":"system|ai|video|privacy|clean-install|dev-tools|file-management|design|office (必须从这些值中选)",
  "tags":["tag1","tag2","tag3"],
  "license":"MIT etc",
  "homepage":"",
  "descriptionZh":"中文简短描述(50字以内)",
  "summaryZh":"一句话白话总结(中文30字内)",
  "featuresZh":["功能1","功能2","功能3"],
  "useCasesZh":["场景1","场景2"],
  "quickStartGuideZh":["步骤1：下载并双击运行","步骤2：按向导安装","步骤3：启动使用"],
  "uninstallGuideZh":"卸载说明",
  "caveatsZh":"避坑指南",
  "summaryEn":"One-sentence summary (English under 30 words)",
  "descriptionEn":"Short English desc",
  "featuresEn":["Feature 1","Feature 2"],
  "useCasesEn":["Use case 1"],
  "quickStartGuideEn":["Step 1: Download and run","Step 2: Follow wizard","Step 3: Launch"],
  "uninstallGuideEn":"Uninstall guide",
  "caveatsEn":"Caveats",
  "qualityScore":0.9,
  "modelVersion":"deepseek-v4-flash"
}

要求:
1. 内容通俗易懂，避免技术黑话
2. 突出核心卖点，以技术评测口吻指出相比同类工具的1-2个独特优势
3. 明确避坑
4. 中英双语都必须生成，中文地道中文，英文地道英文
5. category 必须从枚举值中精确选择一个(小写)
6. quickStartGuide 必须是字符串数组`

// ========== 核心函数 ==========
async function deepseekGenerate(repo: any, readme: string): Promise<any> {
  const prompt = PROMPT
    .replace('{name}', repo.name || repo.full_name || '')
    .replace('{stars}', String(repo.stargazers_count || 0))
    .replace('{license}', repo.license?.spdx_id || repo.license || 'Unknown')
    .replace('{readme}', (readme || '').slice(0, 8000))

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(DEEPSEEK_API, {
        method: 'POST',
        headers: { Authorization: `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'user', content: prompt }], temperature: 0.3 + attempt * 0.15, max_tokens: 2000 }),
        signal: AbortSignal.timeout(90000),
      })
      if (!r.ok) { const txt = await r.text().catch(()=>''); throw new Error(`HTTP ${r.status} ${txt.slice(0,100)}`) }
      const d = await r.json() as any
      const raw = d.choices?.[0]?.message?.content || ''
      const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      const result = JSON.parse(cleaned)
      normalizeAIResult(result)
      if (!validateAIResult(result)) throw new Error(`validation failed: category=${result.category}`)
      return result
    } catch (e) {
      const msg = (e as Error).message.slice(0, 100)
      console.warn(`  [attempt ${attempt+1}/3] ${msg}`)
      if (attempt < 2) await sleep(3000)
    }
  }
  throw new Error('all attempts failed')
}

async function translateText(text: string, source: string, target: string): Promise<string> {
  if (!text?.trim()) return text
  try {
    const r = await fetch(CF_AI(CF_ACCOUNT), {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source_lang: source, target_lang: target }),
    })
    const d = await r.json() as any
    return d.result?.translated_text || text
  } catch { return text }
}

// ========== 主流程 ==========
async function main() {
  if (!DEEPSEEK_KEY) { console.error('❌ 缺少 DEEPSEEK_API_KEY'); process.exit(1) }
  if (!CF_TOKEN) { console.error('❌ 缺少 CF_API_TOKEN'); process.exit(1) }

  // 获取所有待处理 app (从 raw_apps 取 README 和元数据)
  console.log('📡 获取 apps 列表...')
  const rows = await d1Query(
    `SELECT a.id, a.name, r.full_name, r.readme_content, r.raw_api_data
     FROM apps a JOIN raw_apps r ON r.github_repo_id = CAST(SUBSTR(a.id, 5) AS INTEGER)
     WHERE a.status = 'active' AND r.readme_content IS NOT NULL
     ORDER BY a.stars_count DESC`
  )
  console.log(`✅ ${rows.length} 个 app`)

  // 清空中间表
  await d1Exec(`DELETE FROM apps_staging`)
  await d1Exec(`DELETE FROM app_translations_staging`)

  let aiOk = 0, aiFail = 0
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as any
    const appId = row.id
    let repo: any = {}
    try { repo = JSON.parse(row.raw_api_data || '{}') } catch {}

    console.log(`\n[AI ${i+1}/${rows.length}] ${appId} (${row.name})`)
    try {
      const ai = await deepseekGenerate(repo, row.readme_content || '')
      // 写入 apps_staging
      await d1Exec(
        `INSERT OR REPLACE INTO apps_staging (id, name, slug, description, full_description, category, tags, license, homepage_url, stars_count, last_updated, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active')`,
        [appId, ai.name, ai.slug, ai.description, ai.fullDescription, ai.category,
         JSON.stringify(ai.tags), ai.license, ai.homepage || '', repo.stargazers_count || 0],
      )
      // 写入 zh + en 到 staging
      for (const loc of ['zh', 'en']) {
        const sum = loc === 'zh' ? ai.summaryZh : ai.summaryEn
        const desc = loc === 'zh' ? (ai.descriptionZh || ai.description) : (ai.descriptionEn || ai.description)
        const full = loc === 'zh' ? (ai.fullDescriptionZh || ai.fullDescription) : (ai.fullDescriptionEn || ai.fullDescription)
        const feat = loc === 'zh' ? ai.featuresZh : ai.featuresEn
        const usec = loc === 'zh' ? ai.useCasesZh : ai.useCasesEn
        const qs = loc === 'zh' ? ai.quickStartGuideZh : ai.quickStartGuideEn
        const uninst = loc === 'zh' ? ai.uninstallGuideZh : ai.uninstallGuideEn
        const cav = loc === 'zh' ? ai.caveatsZh : ai.caveatsEn
        await d1Exec(
          `INSERT OR REPLACE INTO app_translations_staging (id, app_id, locale, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats, translated_by, ai_model_version, quality_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', 'deepseek-v4-flash', ?)`,
          [`tr_${appId}_${loc}`, appId, loc, sum, desc, full, JSON.stringify(feat||[]), JSON.stringify(usec||[]), JSON.stringify(qs||[]), uninst||'', cav||'', ai.qualityScore||0.85],
        )
      }
      aiOk++
      console.log(`  ✅ category=${ai.category}`)
    } catch (e) {
      aiFail++
      console.error(`  ❌ ${(e as Error).message.slice(0, 120)}`)
    }
    await sleep(DELAY)
  }

  console.log(`\n📊 AI 重生成: ok=${aiOk} fail=${aiFail}`)

  // 翻译 zh 内容 → ja/ko/es/pt-BR
  console.log('\n🌐 翻译...')
  const zhRows = await d1Query(`SELECT app_id, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats FROM app_translations_staging WHERE locale='zh'`)
  console.log(`  ${zhRows.length} 条 zh 内容`)

  const locales = ['ja', 'ko', 'es', 'pt-BR']
  let tOk = 0, tFail = 0
  for (let i = 0; i < zhRows.length; i++) {
    const src = zhRows[i] as any
    for (const tl of locales) {
      try {
        const sum = await translateText(src.summary||'', 'zh', tl)
        const desc = await translateText(src.description||'', 'zh', tl)
        const full = await translateText(src.full_description||'', 'zh', tl)
        const feat = await translateText(src.features||'', 'zh', tl)
        const usec = await translateText(src.use_cases||'', 'zh', tl)
        const qs = await translateText(src.quick_start_guide||'', 'zh', tl)
        const uninst = await translateText(src.uninstall_guide||'', 'zh', tl)
        const cav = await translateText(src.caveats||'', 'zh', tl)
        await d1Exec(
          `INSERT OR REPLACE INTO app_translations_staging (id, app_id, locale, summary, description, full_description, features, use_cases, quick_start_guide, uninstall_guide, caveats, translated_by, ai_model_version, quality_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cf-m2m100', 'm2m100-1.2b', 0.85)`,
          [`tr_${src.app_id}_${tl}`, src.app_id, tl, sum, desc, full, feat, usec, qs, uninst, cav],
        )
        tOk++
      } catch { tFail++ }
      await sleep(100)
    }
    if ((i+1) % 10 === 0) console.log(`  翻译 ${i+1}/${zhRows.length}`)
  }

  console.log(`\n📊 翻译: ok=${tOk} fail=${tFail}`)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ 全部写入 apps_staging / app_translations_staging')
  console.log('')
  console.log('确认数据无误后，执行以下 SQL 同步到生产表:')
  console.log('')
  console.log("  DELETE FROM apps WHERE id IN (SELECT id FROM apps_staging);")
  console.log("  INSERT INTO apps SELECT * FROM apps_staging;")
  console.log("  DELETE FROM app_translations WHERE app_id IN (SELECT app_id FROM app_translations_staging);")
  console.log("  INSERT INTO app_translations SELECT * FROM app_translations_staging;")
  console.log("  DELETE FROM translation_tasks;")
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
