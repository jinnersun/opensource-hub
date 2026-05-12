"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Shield } from 'lucide-react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token')
    if (!token) {
      router.replace('/admin/login')
      return
    }
    // Verify token is still valid
    fetch('/api/proxy?path=/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` },
    }).then(r => {
      if (r.ok) { setAuthed(true) } else { sessionStorage.removeItem('admin_token'); router.replace('/admin/login') }
    }).catch(() => router.replace('/admin/login'))
    .finally(() => setChecking(false))
  }, [router])

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center"><Shield className="size-8 animate-pulse text-muted-foreground" /></div>
  }
  if (!authed) return null

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="size-5 text-primary" />
          <span className="font-semibold">OpenSource-Hub Admin</span>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/admin" className="hover:text-foreground text-muted-foreground">总览</a>
          <a href="/admin/etl" className="hover:text-foreground text-muted-foreground">ETL 作业</a>
          <a href="/admin/submissions" className="hover:text-foreground text-muted-foreground">提交审核</a>
          <button onClick={() => { sessionStorage.removeItem('admin_token'); router.replace('/admin/login') }}
            className="text-muted-foreground hover:text-red-500">退出</button>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
