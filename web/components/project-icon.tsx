import { cn } from "@/lib/utils"

const gradients = [
  "from-rose-500 to-orange-400",
  "from-blue-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-amber-500 to-yellow-400",
  "from-indigo-500 to-blue-400",
  "from-pink-500 to-rose-400",
  "from-teal-500 to-emerald-400",
  "from-orange-500 to-amber-400",
]

interface ProjectIconProps {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
}

export function ProjectIcon({ name, size = "md", className }: ProjectIconProps) {
  const letter = name.charAt(0).toUpperCase()
  const gradientIndex = name.charCodeAt(0) % gradients.length
  const gradient = gradients[gradientIndex]

  const sizeClasses = {
    sm: "size-8 text-sm",
    md: "size-12 text-lg",
    lg: "size-16 text-2xl",
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white shadow-sm",
        gradient,
        sizeClasses[size],
        className
      )}
    >
      {letter}
    </div>
  )
}
