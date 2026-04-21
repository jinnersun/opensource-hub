"use client"

import { useState } from "react"
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Send, CheckCircle2, Loader2, Github } from "lucide-react"

interface SubmitSoftwareDialogProps {
  open: boolean
  onClose: () => void
}

export function SubmitSoftwareDialog({ open, onClose }: SubmitSoftwareDialogProps) {
  const [name, setName] = useState("")
  const [repoUrl, setRepoUrl] = useState("")
  const [description, setDescription] = useState("")
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const t = useTranslations('submitSoftware')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim() || !repoUrl.trim() || !description.trim()) {
      toast.error(t('errorRequired'))
      return
    }

    if (!repoUrl.includes("github.com")) {
      toast.error(t('errorRepo'))
      return
    }

    if (email && !email.includes("@")) {
      toast.error(t('errorEmail'))
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/submit-software", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, repoUrl, description, email }),
      })

      if (res.ok) {
        setSubmitted(true)
        toast.success(t('successToast'))
      } else {
        toast.error(t('errorSubmit'))
      }
    } catch {
      toast.error(t('errorNetwork'))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName("")
    setRepoUrl("")
    setDescription("")
    setEmail("")
    setSubmitted(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description')}
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">{t('success')}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('successDesc')}
              </p>
            </div>
            <Button onClick={handleClose} className="mt-2">
              {t('gotIt')}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sw-name">
                {t('name')} <span className="text-red-500">{t('required')}</span>
              </Label>
              <Input
                id="sw-name"
                placeholder={t('namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sw-repo">
                {t('repoUrl')} <span className="text-red-500">{t('required')}</span>
              </Label>
              <div className="relative">
                <Github className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sw-repo"
                  placeholder="https://github.com/..."
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sw-desc">
                {t('functionDesc')} <span className="text-red-500">{t('required')}</span>
              </Label>
              <Textarea
                id="sw-desc"
                placeholder={t('descPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sw-email">{t('email')}</Label>
              <Input
                id="sw-email"
                type="email"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  {t('submit')}
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
