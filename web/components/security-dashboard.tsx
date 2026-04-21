import { ShieldCheck, ShieldOff } from "lucide-react"
import { useTranslations } from 'next-intl'

export function SecurityDashboard() {
  const t = useTranslations('security')
  const te = useTranslations('errors')

  return (
    <aside className="w-full rounded-2xl border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15">
          <ShieldCheck className="size-4 text-emerald-500" />
        </div>
        <p className="text-sm font-semibold">{t('todayReport')}</p>
      </div>

      {/* 暂无数据占位 */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ShieldOff className="size-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">{te('noData')}</p>
      </div>
    </aside>
  )
}
