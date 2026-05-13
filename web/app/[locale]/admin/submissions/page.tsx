"use client"

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Check, X, Home, Loader2 } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_TABS = ['pending', 'approved', 'rejected']
const STATUS_LABELS: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }

const api = (path: string, opts?: RequestInit) => fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, 'Content-Type': 'application/json', ...opts?.headers },
  ...opts,
}).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || String(r.status)) }))

export default function AdminSubmissionsPage() {
  const [items, setItems] = useState<any[]>([])
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [acting, setActing] = useState<string | null>(null) // id currently being processed

  const load = useCallback(async () => {
    const data = await api(`/admin/submissions?status=${status}&page=${page}`)
    setItems(data.data || [])
    setTotal(data.total || 0)
  }, [status, page])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    setActing(id)
    try { await api(`/admin/submissions/${id}/approve`, { method: 'POST' }); load() }
    catch (e) { console.error('approve failed:', e) }
    finally { setActing(null) }
  }
  const reject = async (id: string) => {
    setActing(id)
    try { await api(`/admin/submissions/${id}/reject`, { method: 'POST' }); load() }
    catch (e) { console.error('reject failed:', e) }
    finally { setActing(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <Home className="size-5" />
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">提交审核</h1>
        <p className="text-muted-foreground text-sm mt-1">共 {total} 条</p>
      </div>

      <div className="flex gap-2">
        {STATUS_TABS.map(s => (
          <Badge key={s} variant={status === s ? 'default' : 'outline'}
            className="cursor-pointer" onClick={() => { setStatus(s); setPage(1) }}>
            {STATUS_LABELS[s]}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4">
        {items.map(item => (
          <Card key={item.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary">{item.source === 'software' ? '软件推荐' : '功能需求'}</Badge>
                    {item.name && <span className="font-semibold">{item.name}</span>}
                    {item.repo_url && <span className="text-sm text-muted-foreground break-all">{item.repo_url}</span>}
                    {item.scenario && <span className="text-sm text-muted-foreground">场景: {item.scenario}</span>}
                  </div>
                  <p className="text-sm">{item.description}</p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    {item.email && <span>{item.email}</span>}
                    <span>{new Date(item.created_at).toLocaleString()}</span>
                    {item.reviewed_at && <span>审核于: {new Date(item.reviewed_at).toLocaleString()}</span>}
                  </div>
                </div>
                {status === 'pending' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => approve(item.id)} disabled={acting === item.id}>
                      {acting === item.id ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Check className="size-4 mr-1" />}
                      通过
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => reject(item.id)} disabled={acting === item.id}>
                      <X className="size-4 mr-1" />拒绝
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} 页</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <Button size="sm" variant="outline" disabled={items.length < 20} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      </div>
    </div>
  )
}
