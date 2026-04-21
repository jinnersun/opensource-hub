'use client'

import { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  className?: string
  height?: number
  width?: number
}

export function Sparkline({ data, className = '', height = 20, width = 60 }: SparklineProps) {
  const { min, max, points } = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: 0, max: 1, points: [] }
    }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return { x, y, value }
    })

    return { min, max, points }
  }, [data, height, width])

  if (points.length === 0) {
    return null
  }

  // Create SVG path
  const pathData = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`inline-block align-middle ${className}`}
      preserveAspectRatio="none"
    >
      <path d={pathData} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
