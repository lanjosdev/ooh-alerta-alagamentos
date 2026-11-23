import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-lg border p-3.5 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        info: 'border-border bg-secondary/70 text-foreground',
        destructive:
          'border-severity-critical-border bg-severity-critical-bg text-severity-critical-fg',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface AlertProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cn('font-semibold leading-tight', className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('mt-1 text-xs leading-relaxed opacity-90', className)} {...props} />
}
