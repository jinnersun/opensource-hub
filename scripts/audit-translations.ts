#!/usr/bin/env tsx
/**
 * 翻译质量巡检 — 字符集启发式检测 v2
 *
 * 检测规则:
 *   ko → 文本 >10 字符 且 零谚文(가-힣) → 漏翻
 *   ja → 文本 >20 字符 且 零假名(ぁ-ん/ァ-ン) 且 CJK 占比 >40% → 中文混入
 *   en → 英文字母+标点占比 <70% 且 CJK >5 → 中文污染
 *   zh → 不检测（翻译源）
 *
 * --fix 模式:
 *   retry_count < 3  → 重置为 pending, retry_count + 1
 *   retry_count >= 3 → 标记为 need_human_fix (防止无限重试消耗 Token)
 *
 * 使用:
 *   tsx scripts/audit-translations.ts --check
 *   tsx scripts/audit-translations.ts --fix
 */

import { execSync } from 'child_process'

// ==========================================
// 检测
// ==========================================

interface AuditResult {
  table: string
  recordId: string
  locale: string
  field: string
  cjkCount: number
  totalLen: number
  reason: string
}

function auditText(text: string | null, locale: string): { cjk: number; hasHangul: boolean; hasKana: boolean; enRatio: number; totalLen: number } | null {
  if (!text || text.trim().length === 0) return null
  const totalLen = text.length
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length
  const hasHangul = /[가-힯]/.test(text)
  const hasKana = /[぀-ゟ゠-ヿ]/.test(text)
  const enMatches = (text.match(/[a-zA-Z0-9\s\p{P}]/gu) || []).length
  const enRatio = enMatches / Math.max(1, totalLen)
  return { cjk, hasHangul, hasKana, enRatio, totalLen }
}

function checkField(text: string | null, locale: string, table: string, id: string, field: string): AuditResult | null {
  const c = auditText(text, locale)
  if (!c) return null

  // 韩文: 长文本 >10 且完全无谚文
  if (locale === 'ko' && !c.hasHangul && c.totalLen > 10) {
    return { table, recordId: id, locale, field, cjkCount: c.cjk, totalLen: c.totalLen, reason: 'Missing Hangul' }
  }

  // 日文: 长文本 >20 且无假名 且 CJK 占比 >40%
  if (locale === 'ja' && !c.hasKana && c.totalLen > 20 && c.cjk / c.totalLen > 0.4) {
    return { table, recordId: id, locale, field, cjkCount: c.cjk, totalLen: c.totalLen, reason: 'No Kana in long text (CJK leakage)' }
  }

  // 英文: 拉丁字符+标点占比 <70% 且 CJK >5
  if (locale === 'en' && c.enRatio < 0.7 && c.cjk > 5) {
    return { table, recordId: id, locale, field, cjkCount: c.cjk, totalLen: c.totalLen, reason: 'CJK contamination in English' }
  }

  return null
}

// ==========================================
// D1
// ==========================================

function execWranglerQuery(q: string): any[] {
  const out = execSync('wrangler d1 execute opensource-hub-db --command "' + q.replace(/"/g, '\\"') + '" --remote --json', {
    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  })
  try {
    const parsed = JSON.parse(out)
    return Array.isArray(parsed) ? parsed[0]?.results || [] : []
  } catch { return [] }
}

function execWrangler(q: string): void {
  execSync('wrangler d1 execute opensource-hub-db --command "' + q.replace(/"/g, '\\"') + '" --remote', {
    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  })
}

// ==========================================
// 扫描
// ==========================================

const SOURCES = [
  { table: 'app_translations', idCol: 'app_id as id', fields: ['summary', 'full_description'] },
  { table: 'apps_library_translations', idCol: 'library_id as id', fields: ['summary', 'full_description'] },
  { table: 'app_faq_translations', idCol: 'faq_id as id', fields: ['question', 'answer'] },
]

function scanAll(): AuditResult[] {
  const results: AuditResult[] = []
  const locales = ['ja', 'ko', 'en']

  for (const src of SOURCES) {
    for (const locale of locales) {
      console.log('Scanning ' + src.table + '.' + locale + '...')
      const rows = execWranglerQuery(
        'SELECT ' + src.idCol + ', ' + src.fields.join(', ') +
        ' FROM ' + src.table + " WHERE locale='" + locale + "'"
      )

      for (const row of rows) {
        for (const field of src.fields) {
          const r = checkField(row[field], locale, src.table, String(row.id), field)
          if (r) results.push(r)
        }
      }
    }
  }
  return results
}

// ==========================================
// 修复
// ==========================================

function fixRecord(locale: string, retryCount: number, sourceTableMatch: string): string {
  if (retryCount >= 3) {
    return "UPDATE translation_tasks SET status='failed', retry_count=3, last_error='Audit: persistent translation hallucination (needs manual review)', updated_at=CURRENT_TIMESTAMP WHERE status='done' AND target_locale='" + locale + "' AND source_table IN (" + sourceTableMatch + ") AND retry_count >= 3"
  }
  return "UPDATE translation_tasks SET status='pending', retry_count=retry_count+1, last_error='Audit: detected untranslated content', updated_at=CURRENT_TIMESTAMP WHERE status='done' AND target_locale='" + locale + "' AND source_table IN (" + sourceTableMatch + ") AND retry_count < 3"
}

// ==========================================
// 入口
// ==========================================

function main() {
  const args = process.argv.slice(2)
  const doFix = args.includes('--fix')

  if (!doFix && !args.includes('--check')) {
    console.log('Usage: tsx scripts/audit-translations.ts --check | --fix')
    process.exit(1)
  }

  console.log('Translation Audit v2')
  console.log('')

  const results = scanAll()

  console.log('')
  console.log('='.repeat(60))
  console.log('Found ' + results.length + ' suspicious records')
  console.log('='.repeat(60))

  if (results.length === 0) {
    console.log('No issues found.')
    process.exit(0)
  }

  // Report
  for (const r of results.slice(0, 30)) {
    console.log(r.table + ' | ' + r.recordId + ' | ' + r.locale + ' | ' + r.field + ' | CJK=' + r.cjkCount + '/' + r.totalLen + ' | ' + r.reason)
  }
  if (results.length > 30) console.log('... and ' + (results.length - 30) + ' more')

  // Fix
  if (doFix) {
    // 统计 retry_count 分布
    const dist = execWranglerQuery(
      "SELECT retry_count, COUNT(*) as cnt FROM translation_tasks WHERE status='done' GROUP BY retry_count"
    )
    console.log('')
    console.log('Translation task retry distribution:')
    for (const d of dist) {
      console.log('  retry_count=' + d.retry_count + ': ' + d.cnt + ' tasks')
    }

    console.log('')
    console.log('Resetting suspicious translations...')

    const locales = ['ja', 'ko', 'en']
    const sourceMatch = "'app_translations','apps_library_translations','app_faqs'"

    for (const locale of locales) {
      // >=3 retries → need_human_fix
      execWrangler(fixRecord(locale, 3, sourceMatch))
      // <3 retries → pending, retry_count++
      execWrangler(fixRecord(locale, 0, sourceMatch))
    }

    console.log('Done. Translator Worker will reprocess pending tasks next cron.')
    console.log('Tasks with retry_count >=3 marked as need_human_fix.')
  }

  process.exit(0)
}

main()
