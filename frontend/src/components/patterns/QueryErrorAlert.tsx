import { AlertCircle, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'

export interface QueryErrorAlertProps {
  error: unknown
  title?: string
  onRetry?: () => void
  retryLabel?: string
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  className?: string
}

export function QueryErrorAlert({
  error,
  title = 'Não foi possível carregar os dados',
  onRetry,
  retryLabel = 'Tentar novamente',
  secondaryActionLabel,
  onSecondaryAction,
  className,
}: QueryErrorAlertProps) {
  const message = getApiErrorMessage(error)

  return (
    <Alert variant="destructive" className={cn('items-start', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-2">
        <div>
          <AlertTitle>{title}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </div>
        {(onRetry || (secondaryActionLabel && onSecondaryAction)) ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {onRetry ? (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{retryLabel}</span>
              </Button>
            ) : null}
            {secondaryActionLabel && onSecondaryAction ? (
              <Button type="button" size="sm" variant="secondary" onClick={onSecondaryAction}>
                {secondaryActionLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </Alert>
  )
}
