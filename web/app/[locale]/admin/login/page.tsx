"use client"

import { useState } from 'react'
import { useRouter } from '@/i18n/routing'
import { Shield, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function AdminLoginPage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const login = async () => {
    if (!token.trim()) { setError('请输入 Admin Token'); return }
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/proxy?path=/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      if (r.ok) {
        sessionStorage.setItem('admin_token', token.trim())
        router.replace('/admin')
      } else {
        setError('Token 无效')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm space-y-6 rounded-xl border p-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">管理后台</h1>
          <p className="text-sm text-muted-foreground mt-1">输入 Admin Token 登录</p>
        </div>
        <div className="space-y-3">
          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="password"
              placeholder="Admin Token"
              value={token}
              onChange={e => setToken(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              className="pl-9"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button className="w-full" onClick={login} disabled={loading}>
            {loading ? '验证中...' : '登录'}
          </Button>
        </div>
      </div>
    </div>
  )
}
