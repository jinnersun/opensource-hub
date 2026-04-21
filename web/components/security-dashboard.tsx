import { ShieldCheck, ShieldAlert, Clock } from "lucide-react"
import { useTranslations } from 'next-intl'
import { securityReport } from "@/lib/data"

export function SecurityDashboard() {
  const t = useTranslations('security')

  return (
    <aside className="w-full rounded-2xl border bg-card p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15">
          <ShieldCheck className="size-4 text-emerald-500" />
        </div>
        <p className="text-sm font-semibold">{t('todayReport')}</p>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-500/8 p-3 text-center dark:bg-emerald-500/10">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {securityReport.scannedPercent}%
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('scanned')}</p>
        </div>
        <div className="rounded-xl bg-amber-500/8 p-3 text-center dark:bg-amber-500/10">
          <div className="flex items-center justify-center gap-1">
            <ShieldAlert className="size-4 text-amber-500" />
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {securityReport.isolatedCount}
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t('isolated')}</p>
        </div>
      </div>

      {/* Recent checksum checks */}
      <div>
        <p className="mb-2.5 text-xs font-medium text-muted-foreground">
          {t('latestChecks')}
        </p>
        <ul className="flex flex-col gap-2">
          {securityReport.recentChecks.map((item, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-500" />
                <span className="truncate text-xs font-medium">{item.name}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {item.checksum}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-3" />
                {item.time}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        {t('allScanned')}
      </p>
    </aside>
  )
}
