/**
 * OpenSource-Hub Translator Worker
 * 定时扫描 translation_tasks，用 DeepSeek-v4-flash 翻译软件内容
 * 触发: cron 每 5 分钟 (见 wrangler.toml)
 *
 * Secrets (wrangler secret put):
 *   AI_GATEWAY_ACCOUNT — CF Account ID
 *   AI_GATEWAY_TOKEN   — CF AI Gateway Access Token
 */

export interface Env {
  DB: D1Database
  AI: Ai
  BATCH_SIZE: string
  TARGET_LOCALES: string
  TRIGGER_TOKEN?: string
  AI_GATEWAY_ACCOUNT?: string
  AI_GATEWAY_TOKEN?: string
}

const TARGET_LOCALES = ['ja', 'ko', 'es', 'pt-BR']
const BATCH_SIZE = 5

// m2m100 语言代码 (fallback)
const LANG_MAP: Record<string, string> = { zh: 'zh', en: 'en', ja: 'ja', ko: 'ko', es: 'es', 'pt-BR': 'pt' }

const LANG_NAMES: Record<string, string> = {
  zh: 'Simplified Chinese', en: 'English', ja: 'Japanese',
  ko: 'Korean', es: 'Spanish', 'pt-BR': 'Brazilian Portuguese',
}

interface Task {
  id: number
  app_id: string
  source_table: string
  source_id: string | null
  source_locale: string
  target_locale: string
  retry_count: number
}

interface Translation {
  app_id: string
  locale: string
  summary: string | null
  description: string | null
  full_description: string | null
  features: string | null
  use_cases: string | null
  quick_start_guide: string | null
  uninstall_guide: string | null
  caveats: string | null
}

async function translateText(env: Env, text: string, sourceLang: string, targetLang: string): Promise<string> {
  if (!text || text.trim().length === 0) return text

  // DeepSeek-v4-flash 翻译 (via AI Gateway)
  if (env.AI_GATEWAY_ACCOUNT && env.AI_GATEWAY_TOKEN) {
    try {
      const sourceName = LANG_NAMES[sourceLang] || sourceLang
      const targetName = LANG_NAMES[targetLang] || targetLang
      const systemPrompt = 'Translate the following text from ' + sourceName + ' to ' + targetName + '. Keep technical terms (API names, CLI flags, error codes, version numbers, file paths, brand names) in their original form. Output ONLY the translated text, no explanations, no markdown.'

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      try {
        const url = 'https://gateway.ai.cloudflare.com/v1/' + env.AI_GATEWAY_ACCOUNT + '/deepseek/deepseek/v1/chat/completions'
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-aig-authorization': 'Bearer ' + env.AI_GATEWAY_TOKEN,
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: 'deepseek-v4-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text },
            ],
            temperature: 0.1, max_tokens: 4000,
          }),
        })
        if (!resp.ok) throw new Error('DS ' + resp.status)
        const data = await resp.json() as any
        const translated = data?.choices?.[0]?.message?.content?.trim()
        if (translated && translated.length > text.length * 0.1) return translated
        throw new Error('Empty or too-short translation')
      } finally { clearTimeout(timer) }
    } catch (err) {
      console.warn('[translate] DeepSeek failed:', (err as Error).message)
      throw err
    }
  }

  // Fallback: m2m100
  try {
    const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text,
      source_lang: LANG_MAP[sourceLang] || 'zh',
      target_lang: LANG_MAP[targetLang] || 'ja',
    }) as { translated_text?: string }
    return result?.translated_text || text
  } catch (err) {
    console.warn('[translate] m2m100 fallback failed:', (err as Error).message)
    throw err
  }
}

async function fetchPendingTasks(db: D1Database): Promise<Task[]> {
  const { results } = await db.prepare(
    `SELECT id, app_id, source_table, source_id, source_locale, target_locale, retry_count
     FROM translation_tasks
     WHERE status = 'pending' AND retry_count < 3
     ORDER BY created_at ASC
     LIMIT ?`,
  ).bind(BATCH_SIZE).all<Task>()
  return results || []
}

async function lockTask(db: D1Database, id: number): Promise<void> {
  await db.prepare(
    `UPDATE translation_tasks SET status = 'translating', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(id).run()
}

async function markDone(db: D1Database, id: number): Promise<void> {
  await db.prepare(
    `UPDATE translation_tasks SET status = 'done', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(id).run()
}

async function markFailed(db: D1Database, id: number, error: string): Promise<void> {
  await db.prepare(
    `UPDATE translation_tasks SET status = 'failed', retry_count = retry_count + 1,
            last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).bind(error.slice(0, 500), id).run()
}

function isLibrary(appId: string) { return appId.startsWith('lib_') }

async function getSourceTranslation(db: D1Database, appId: string, sourceLocale: string): Promise<{ data: Translation | null; usedLocale: string }> {
  const fallbackLocale = sourceLocale === 'zh' ? 'en' : 'zh'
  if (isLibrary(appId)) {
    const repoId = parseInt(appId.replace('lib_', ''))
    // 先试请求语言，再试回退语言
    let row = await db.prepare(
      `SELECT ? as app_id, locale, summary, full_description,
              NULL as description, NULL as features, NULL as use_cases,
              NULL as quick_start_guide, NULL as uninstall_guide, NULL as caveats
       FROM apps_library_translations WHERE library_id = (SELECT id FROM apps_library WHERE github_repo_id = ?) AND locale = ?`,
    ).bind(appId, repoId, sourceLocale).first<Translation>()
    if (!row?.summary && !row?.full_description) {
      row = await db.prepare(
        `SELECT ? as app_id, locale, summary, full_description,
                NULL as description, NULL as features, NULL as use_cases,
                NULL as quick_start_guide, NULL as uninstall_guide, NULL as caveats
         FROM apps_library_translations WHERE library_id = (SELECT id FROM apps_library WHERE github_repo_id = ?) AND locale = ?`,
      ).bind(appId, repoId, fallbackLocale).first<Translation>()
    }
    if (!row?.summary && !row?.full_description) return { data: null, usedLocale: sourceLocale }
    return { data: row, usedLocale: row?.locale || sourceLocale }
  }
  // apps 表
  let row = await db.prepare(
    `SELECT app_id, locale, summary, description, full_description,
            features, use_cases, quick_start_guide, uninstall_guide, caveats
     FROM app_translations WHERE app_id = ? AND locale = ?`,
  ).bind(appId, sourceLocale).first<Translation>()
  if (!row?.summary && !row?.full_description) {
    row = await db.prepare(
      `SELECT app_id, locale, summary, description, full_description,
              features, use_cases, quick_start_guide, uninstall_guide, caveats
       FROM app_translations WHERE app_id = ? AND locale = ?`,
    ).bind(appId, fallbackLocale).first<Translation>()
  }
  return { data: row, usedLocale: row?.locale || sourceLocale }
}

interface FAQSource {
  question: string
  answer: string
}

async function getFaqSourceTranslation(db: D1Database, faqId: string): Promise<FAQSource | null> {
  const row = await db.prepare(
    `SELECT question_en, answer_en FROM app_faqs WHERE id = ?`,
  ).bind(faqId).first<{ question_en: string; answer_en: string }>()
  if (!row) return null
  return { question: row.question_en, answer: row.answer_en }
}

async function upsertFaqTranslation(db: D1Database, faqId: string, locale: string, question: string, answer: string): Promise<void> {
  const id = `faq_trans_${faqId}_${locale}`
  await db.prepare(
    `INSERT OR REPLACE INTO app_faq_translations (id, faq_id, locale, question, answer, translated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
  ).bind(id, faqId, locale, question, answer).run()
}

async function upsertTranslation(db: D1Database, t: Translation): Promise<void> {
  if (isLibrary(t.app_id)) {
    const repoId = parseInt(t.app_id.replace('lib_', ''))
    await db.prepare(
      `INSERT OR REPLACE INTO apps_library_translations
         (library_id, locale, summary, full_description)
       VALUES ((SELECT id FROM apps_library WHERE github_repo_id = ?), ?, ?, ?)`,
    ).bind(repoId, t.locale, t.summary, t.full_description).run()
    return
  }
  await db.prepare(
    `INSERT OR REPLACE INTO app_translations
       (id, app_id, locale, summary, description, full_description,
        features, use_cases, quick_start_guide, uninstall_guide, caveats,
        translated_by, ai_model_version, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'deepseek-v4-flash', 'deepseek-v4-flash', 0.85)`,
  ).bind(
    `tr_${t.app_id}_${t.locale}`,
    t.app_id, t.locale,
    t.summary, t.description, t.full_description,
    t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats,
  ).run()
}

async function processFaqTask(env: Env, task: Task): Promise<void> {
  const faqId = task.source_id!

  const source = await getFaqSourceTranslation(env.DB, faqId)
  if (!source) {
    await markFailed(env.DB, task.id, `FAQ source not found: ${faqId}`)
    return
  }

  try {
    const [question, answer] = await Promise.all([
      translateText(env, source.question, task.source_locale, task.target_locale),
      translateText(env, source.answer, task.source_locale, task.target_locale),
    ])

    await upsertFaqTranslation(env.DB, faqId, task.target_locale, question, answer)

    await env.DB.prepare(
      `UPDATE app_faqs SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    ).bind(faqId).run()

    // 同步更新父 app/library 的 last_updated（SEO: sitemap 反映 FAQ 变更）
    if (task.app_id.startsWith('lib_')) {
      const repoId = parseInt(task.app_id.replace('lib_', ''))
      if (!isNaN(repoId)) {
        await env.DB.prepare(
          `UPDATE apps_library SET last_updated = CURRENT_TIMESTAMP WHERE github_repo_id = ?`,
        ).bind(repoId).run()
      }
    } else {
      await env.DB.prepare(
        `UPDATE apps SET last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
      ).bind(task.app_id).run()
    }

    await markDone(env.DB, task.id)
    console.log(`[translator] faq done: ${faqId} → ${task.target_locale}`)
  } catch (err) {
    await markFailed(env.DB, task.id, (err as Error).message)
    console.warn(`[translator] faq failed: ${faqId} → ${task.target_locale}: ${(err as Error).message}`)
  }
}

async function processTask(env: Env, task: Task): Promise<void> {
  if (task.source_table === 'app_faqs' && task.source_id) {
    await processFaqTask(env, task)
    return
  }

  // 获取源语言翻译（zh 无内容则 fallback en）
  const src = await getSourceTranslation(env.DB, task.app_id, task.source_locale)
  const source = src.data
  if (!source) {
    await markFailed(env.DB, task.id, 'source translation not found')
    return
  }

  // 逐字段翻译（用实际源语言）
  const actualSrc = src.usedLocale
  const t: Translation = {
    app_id: task.app_id,
    locale: task.target_locale,
    summary: null,
    description: null,
    full_description: null,
    features: null,
    use_cases: null,
    quick_start_guide: null,
    uninstall_guide: null,
    caveats: null,
  }

  try {
    if (source.summary) t.summary = await translateText(env, source.summary, actualSrc, task.target_locale)
    if (source.description) t.description = await translateText(env, source.description, actualSrc, task.target_locale)
    if (source.full_description) t.full_description = await translateText(env, source.full_description, actualSrc, task.target_locale)
    if (source.features) t.features = await translateText(env, source.features, actualSrc, task.target_locale)
    if (source.use_cases) t.use_cases = await translateText(env, source.use_cases, actualSrc, task.target_locale)
    if (source.quick_start_guide) t.quick_start_guide = await translateText(env, source.quick_start_guide, actualSrc, task.target_locale)
    if (source.uninstall_guide) t.uninstall_guide = await translateText(env, source.uninstall_guide, actualSrc, task.target_locale)
    if (source.caveats) t.caveats = await translateText(env, source.caveats, actualSrc, task.target_locale)

    await upsertTranslation(env.DB, t)
    await markDone(env.DB, task.id)
    console.log(`[translator] done: ${task.app_id} → ${task.target_locale}`)
  } catch (err) {
    await markFailed(env.DB, task.id, (err as Error).message)
    console.warn(`[translator] failed: ${task.app_id} → ${task.target_locale}: ${(err as Error).message}`)
  }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log('[translator] scheduled trigger')
    ctx.waitUntil(
      (async () => {
        const tasks = await fetchPendingTasks(env.DB)
        if (tasks.length === 0) {
          console.log('[translator] no pending tasks')
          return
        }
        console.log(`[translator] processing ${tasks.length} tasks`)
        for (const task of tasks) {
          await lockTask(env.DB, task.id)
          await processTask(env, task)
        }
      })().catch(err => console.error('[translator] fatal:', (err as Error).message)),
    )
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const ok = auth && env.TRIGGER_TOKEN && auth === env.TRIGGER_TOKEN

    if (url.pathname === '/translate/trigger' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const tasks = await fetchPendingTasks(env.DB)
      if (tasks.length === 0) {
        return new Response('no pending tasks', { status: 200 })
      }
      for (const task of tasks) {
        await lockTask(env.DB, task.id)
        await processTask(env, task)
      }
      return Response.json({ processed: tasks.length })
    }

    // 批量为指定 app 创建翻译任务
    if (url.pathname === '/translate/create-tasks' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const appId = url.searchParams.get('app_id')
      let count = 0
      for (const tl of TARGET_LOCALES) {
        try {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale) VALUES (?, 'app_translations', ?, 'zh', ?)`,
          ).bind(appId, appId, tl).run()
          count++
        } catch { /* UNIQUE constraint */ }
      }
      return Response.json({ app_id: appId, created: count })
    }

    // 为所有存量 app 创建翻译任务
    if (url.pathname === '/translate/create-all-tasks' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const batchSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get('batch') || '50')))
      let created = 0; let offset = 0
      while (true) {
        const rows = await env.DB.prepare(
          `SELECT id FROM apps WHERE status = 'active' ORDER BY id LIMIT ? OFFSET ?`,
        ).bind(batchSize, offset).all<{id:string}>()
        if (!rows.results?.length) break
        for (const r of rows.results) {
          for (const tl of TARGET_LOCALES) {
            try {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale) VALUES (?, 'app_translations', ?, 'zh', ?)`,
              ).bind(r.id, r.id, tl).run()
              created++
            } catch { /* UNIQUE constraint */ }
          }
        }
        offset += batchSize
        if (rows.results.length < batchSize) break
      }
      return Response.json({ created })
    }

    return Response.json({
      service: 'opensource-hub-translator',
      status: 'ok',
      endpoints: ['POST /translate/trigger', 'POST /translate/create-tasks?app_id=xxx'],
    })
  },
}
