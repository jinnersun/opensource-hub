"use client"

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { GitBranch, Bot, Languages, ArrowRight, FileText, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface FAQStats {
  raw: Record<string, number>
  faqs: Record<string, number>
  translations: Record<string, Record<string, number>>
  todayHarvested: number
  todayEtlDone: number
}

const api = (path: string) => {
  const sp = new URLSearchParams({ path })
  return fetch(`/api/proxy?${sp.toString()}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` },
  }).then(r => r.json())
}

const LOCALE_LABELS: Record<string, string> = { zh: '中文', ja: '日文', ko: '韩文' }
const LOCALE_COLORS: Record<string, string> = { zh: 'text-red-400', ja: 'text-pink-400', ko: 'text-blue-400' }

const RAW_STATUS_MAP: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  pending:     { label: '待处理', color: 'text-amber-500', icon: Clock },
  processing:  { label: '处理中', color: 'text-blue-500', icon: Loader2 },
  completed:   { label: '已完成', color: 'text-emerald-500', icon: CheckCircle },
  rejected:    { label: '已拒绝', color: 'text-red-500', icon: XCircle },
}

const FAQ_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending_translation: { label: '待翻译', color: 'text-purple-500' },
  translating:         { label: '翻译中', color: 'text-blue-500' },
  active:              { label: '已激活', color: 'text-emerald-500' },
  outdated:            { label: '已过期', color: 'text-slate-400' },
  hidden:              { label: '已隐藏', color: 'text-slate-500' },
}

export default function FAQPipelinePage() {
  const [stats, setStats] = useState<FAQStats | null>(null)

  useEffect(() => { api('/admin/faq-stats').then(setStats) }, [])

  if (!stats) return <div className="py-20 text-center text-muted-foreground">加载中...</div>
  if ((stats as any).error) return <div className="py-20 text-center text-red-500">加载失败: {(stats as any).error}</div>

  const rawTotal = Object.values(stats.raw || {}).reduce((a, b) => a + b, 0)
  const faqTotal = Object.values(stats.faqs || {}).reduce((a, b) => a + b, 0)
  const trEntries = Object.entries(stats.translations || {})
  const trDone = trEntries.reduce((sum, [, m]) => sum + (m.done || 0), 0)
  const trTotal = trEntries.reduce((sum, [, m]) => sum + Object.values(m).reduce((a, b) => a + b, 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin" className="hover:text-foreground">总览</Link>
        <span>/</span>
        <span className="text-foreground font-medium">FAQ 管道</span>
      </div>

      <h1 className="text-2xl font-bold">FAQ 管道</h1>

      {/* 摘要卡片 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-indigo-500/10">
              <GitBranch className="size-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rawTotal}</p>
              <p className="text-xs text-muted-foreground">采集 Issues 总数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-teal-500/10">
              <Bot className="size-5 text-teal-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqTotal}</p>
              <p className="text-xs text-muted-foreground">生成 FAQ 数</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Languages className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{trDone}/{trTotal}</p>
              <p className="text-xs text-muted-foreground">翻译完成率</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="size-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.faqs?.active || 0}</p>
              <p className="text-xs text-muted-foreground">前端可见 FAQ</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 今日活动 */}
      <div className="flex gap-4 text-sm">
        <div className="rounded-lg bg-blue-500/10 px-4 py-2 flex items-center gap-2">
          <GitBranch className="size-4 text-blue-500" />
          <span className="text-muted-foreground">今日采集</span>
          <span className="font-mono font-bold">{stats.todayHarvested}</span>
        </div>
        <div className="rounded-lg bg-teal-500/10 px-4 py-2 flex items-center gap-2">
          <Bot className="size-4 text-teal-500" />
          <span className="text-muted-foreground">今日 ETL 处理</span>
          <span className="font-mono font-bold">{stats.todayEtlDone}</span>
        </div>
      </div>

      {/* 管道三段 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 采集漏斗 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <GitBranch className="size-4 text-indigo-500" />
              采集状态 (raw_faqs)
            </h2>
            <div className="space-y-2">
              {Object.entries(RAW_STATUS_MAP).map(([k, meta]) => {
                const v = stats.raw?.[k] || 0
                return (
                  <div key={k} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <meta.icon className={`size-3.5 ${meta.color}`} />
                      <span className={meta.color}>{meta.label}</span>
                    </div>
                    <span className="font-mono font-medium">{v}</span>
                  </div>
                )
              })}
            </div>
            {rawTotal > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>处理进度</span>
                  <span>{Math.round(((stats.raw?.completed || 0) / rawTotal) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.round(((stats.raw?.completed || 0) / rawTotal) * 100)}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ETL 产出 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Bot className="size-4 text-teal-500" />
              FAQ 产出 (app_faqs)
            </h2>
            <div className="space-y-2">
              {Object.entries(FAQ_STATUS_MAP).map(([k, meta]) => {
                const v = stats.faqs?.[k] || 0
                return (
                  <div key={k} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    <span className={meta.color}>{meta.label}</span>
                    <span className="font-mono font-medium">{v}</span>
                  </div>
                )
              })}
            </div>
            {faqTotal > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>激活率</span>
                  <span>{Math.round(((stats.faqs?.active || 0) / faqTotal) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${Math.round(((stats.faqs?.active || 0) / faqTotal) * 100)}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 翻译进度 */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Languages className="size-4 text-emerald-500" />
              翻译任务 (FAQ)
            </h2>
            {trEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">暂无翻译任务</p>
            ) : (
              <div className="space-y-3">
                {trEntries.map(([locale, m]) => {
                  const done = m.done || 0
                  const total = Object.values(m).reduce((a, b) => a + b, 0)
                  return (
                    <div key={locale}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className={LOCALE_COLORS[locale] || 'text-muted-foreground'}>
                          {LOCALE_LABELS[locale] || locale}
                        </span>
                        <span className="text-xs text-muted-foreground">{done}/{total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
