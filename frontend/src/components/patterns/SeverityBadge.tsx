import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getSeverityMeta } from '@/features/monitoring/utils/severity'
import { cn } from '@/lib/utils'
import type { SeverityLevel } from '@/types/alerts'

export interface SeverityBadgeProps {
  level: SeverityLevel
  showIcon?: boolean
  showApiCode?: boolean
  className?: string
}

function SeverityIcon({ level }: { level: SeverityLevel }) {
  switch (level) {
    case 0:
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    case 1:
      return <Info className="h-3.5 w-3.5" aria-hidden="true" />
    case 2:
      return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
    case 3:
      return <AlertOctagon className="h-3.5 w-3.5" aria-hidden="true" />
  }
}

export function SeverityBadge({
  level,
  showIcon = true,
  showApiCode = false,
  className,
}: SeverityBadgeProps) {
  const meta = getSeverityMeta(level)

  return (
    <Badge
      className={cn(meta.badgeClassName, 'font-semibold', className)}
      aria-label={`Severidade ${meta.label}`}
    >
      {showIcon ? <SeverityIcon level={level} /> : null}
      <span>{meta.label}</span>
      {showApiCode ? (
        <span className="opacity-75">({meta.apiLabel})</span>
      ) : null}
    </Badge>
  )
}
