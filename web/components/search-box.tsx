"use client"

import * as React from "react"
import { Search, Sparkles } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"

interface SearchBoxProps {
  className?: string
}

export function SearchBox({ className }: SearchBoxProps) {
  const t = useTranslations('search')
  const suggestions = [t('suggestions.0'), t('suggestions.1'), t('suggestions.2'), t('suggestions.3')]
  const [query, setQuery] = React.useState("")
  const [isFocused, setIsFocused] = React.useState(false)
  const [placeholder, setPlaceholder] = React.useState(suggestions[0])

  // Cycle through suggestions
  React.useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % suggestions.length
      setPlaceholder(suggestions[i])
    }, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={cn("relative w-full max-w-2xl", className)}>
      <div
        className={cn(
          "relative flex items-center rounded-2xl border bg-card shadow-lg transition-all duration-200",
          isFocused
            ? "border-foreground/30 shadow-foreground/5 ring-4 ring-foreground/5"
            : "border-border"
        )}
      >
        <Search className="ml-5 size-5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={t('placeholder', { query: placeholder })}
          className="h-14 w-full bg-transparent px-4 text-base outline-none placeholder:text-muted-foreground/60"
        />
        <div className="mr-3 flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-amber-400" />
          <span className="hidden sm:inline">{t('aiSearch')}</span>
        </div>
      </div>
      <p className="mt-2.5 text-center text-xs text-muted-foreground">
        {t('hint')}
      </p>
    </div>
  )
}
