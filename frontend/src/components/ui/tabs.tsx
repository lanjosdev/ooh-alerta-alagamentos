import { createContext, useContext, useId, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  baseId: string
  activeValue: string
  setActiveValue: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

function useTabsContext(): TabsContextValue {
  const context = useContext(TabsContext)
  if (!context) {
    throw new Error('Componentes de Tabs devem ser usados dentro de <Tabs>.')
  }
  return context
}

export interface TabsProps {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
  className?: string
  children: ReactNode
}

export function Tabs({
  defaultValue = '',
  value,
  onValueChange,
  className,
  children,
}: TabsProps) {
  const baseId = useId()
  const [internalValue, setInternalValue] = useState(defaultValue)
  const activeValue = value !== undefined ? value : internalValue

  const setActiveValue = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue)
    }
    onValueChange?.(nextValue)
  }

  return (
    <TabsContext.Provider value={{ baseId, activeValue, setActiveValue }}>
      <div className={cn('flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabsListProps {
  className?: string
  children: ReactNode
  'aria-label'?: string
}

export function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1 text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface TabsTriggerProps {
  value: string
  className?: string
  children: ReactNode
  disabled?: boolean
}

export function TabsTrigger({ value, className, children, disabled = false }: TabsTriggerProps) {
  const { baseId, activeValue, setActiveValue } = useTabsContext()
  const isActive = activeValue === value

  return (
    <button
      id={`${baseId}-tab-${value}`}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={`${baseId}-panel-${value}`}
      disabled={disabled}
      onClick={() => setActiveValue(value)}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 sm:text-sm',
        isActive
          ? 'bg-card text-foreground shadow-xs'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}

export interface TabsContentProps {
  value: string
  className?: string
  children: ReactNode
}

export function TabsContent({ value, className, children }: TabsContentProps) {
  const { baseId, activeValue } = useTabsContext()
  if (activeValue !== value) {
    return null
  }

  return (
    <div
      id={`${baseId}-panel-${value}`}
      role="tabpanel"
      aria-labelledby={`${baseId}-tab-${value}`}
      className={cn('mt-3 focus-visible:outline-none', className)}
    >
      {children}
    </div>
  )
}
