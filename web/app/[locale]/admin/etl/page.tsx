"use client"

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STATUSES = ['all', 'pending', 'processing', 'completed', 'skipped', 'failed', 'rate_limited']
const api = (path: string, opts?: RequestInit) => fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, ...opts?.headers },
  ...opts,
}).then(r => r.json())

export default function AdminEtlPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    const q = status !== 'all' ? `&status=${status}` : ''
    const data = await api(`/admin/jobs?page=${page}&limit=30${q}`)
    setJobs(data.data || [])
    setTotal(data.total || 0)
  }, [status, page])

  useEffect(() => { load() }, [load])

  const bulkRetry = async () => {
    setRetrying(true)
    await api('/admin/jobs/bulk-retry', {
      method: 'POST',
      body: JSON.stringify({ ids: [...selected] }),
      headers: { 'Content-Type': 'application/json' },
    })
    setSelected(new Set())
    setRetrying(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ETL 作业管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {total} 条记录</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <Button size="sm" onClick={bulkRetry} disabled={retrying}>
              <RefreshCw className="size-4 mr-1" />
              重试选中 ({selected.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={load}>刷新</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <Badge key={s} variant={status === s ? 'default' : 'outline'}
            className="cursor-pointer" onClick={() => { setStatus(s); setPage(1) }}>
            {s} {s === 'all' ? '' : ''}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" onChange={e => {
                      if (e.target.checked) setSelected(new Set(jobs.map(j => j.id)))
                      else setSelected(new Set())
                    }} />
                  </th>
                  <th className="px-4 py-3 text-left">仓库</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">来源</th>
                  <th className="px-4 py-3 text-left">重试</th>
                  <th className="px-4 py-3 text-left">错误信息</th>
                  <th className="px-4 py-3 text-left">上次处理</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(job.id)}
                        onChange={e => {
                          const next = new Set(selected)
                          e.target.checked ? next.add(job.id) : next.delete(job.id)
                          setSelected(next)
                        }} />
                    </td>
                    <td className="px-4 py-3 font-medium">{job.full_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={job.etl_status === 'failed' ? 'destructive' : job.etl_status === 'completed' ? 'default' : 'secondary'}>
                        {job.etl_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{job.source || '-'}</td>
                    <td className="px-4 py-3">{job.retry_count}/{job.max_retries}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{job.error_log || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{job.last_processed_at || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} 页</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <Button size="sm" variant="outline" disabled={jobs.length < 30} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      </div>
    </div>
  )
}
