/**
 * OpenSource-Hub Translator Worker
 * 定时扫描 translation_tasks，用 CF AI m2m100 翻译软件内容
 * 触发: cron 每 5 分钟 (见 wrangler.toml)
 */

export interface Env {
  DB: D1Database
  AI: Ai
  BATCH_SIZE: string
  TARGET_LOCALES: string
  TRIGGER_TOKEN?: string
}

const TARGET_LOCALES = ['ja', 'ko', 'es', 'pt-BR']
const BATCH_SIZE = 5

// m2m100 语言代码 (Cloudflare Workers AI 使用 ISO 639-1)
const LANG_MAP: Record<string, string> = {
  zh: 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  es: 'es',
  'pt-BR': 'pt',
}

interface Task {
  id: number
  app_id: string
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
  try {
    const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
      text: text,
      source_lang: LANG_MAP[sourceLang] || 'zho_Hans',
      target_lang: LANG_MAP[targetLang] || 'jpn_Jpan',
    }) as { translated_text?: string }
    return result?.translated_text || text
  } catch (err) {
    console.warn(`[translate] m2m100 failed:`, (err as Error).message)
    throw err
  }
}

async function fetchPendingTasks(db: D1Database): Promise<Task[]> {
  const { results } = await db.prepare(
    `SELECT id, app_id, source_locale, target_locale, retry_count
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cf-m2m100', 'm2m100-1.2b', 0.85)`,
  ).bind(
    `tr_${t.app_id}_${t.locale}`,
    t.app_id, t.locale,
    t.summary, t.description, t.full_description,
    t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats,
  ).run()
}

async function processTask(env: Env, task: Task): Promise<void> {
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
            `INSERT OR IGNORE INTO translation_tasks (app_id, source_locale, target_locale) VALUES (?, 'zh', ?)`,
          ).bind(appId, tl).run()
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
                `INSERT OR IGNORE INTO translation_tasks (app_id, source_locale, target_locale) VALUES (?, 'zh', ?)`,
              ).bind(r.id, tl).run()
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
