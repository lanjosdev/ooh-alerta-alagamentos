import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { Toaster } from 'sonner'
import { EnvErrorView } from '@/components/patterns/EnvErrorView'
import { Skeleton } from '@/components/ui/skeleton'
import { envValidation } from '@/env'
import { resolveAppRoute } from '@/features/player/utils/playerUrlState'
import { queryClient } from '@/lib/query-client'
import { MonitoringPage } from '@/pages/MonitoringPage'

const LazyCleanPlayerPage = lazy(() => import('@/pages/CleanPlayerPage'))

export function App() {
  if (!envValidation.success) {
    return <EnvErrorView issues={envValidation.issues} />
  }

  const route =
    typeof window !== 'undefined' ? resolveAppRoute(window.location) : 'monitoring'

  return (
    <QueryClientProvider client={queryClient}>
      {route === 'player' ? (
        <Suspense
          fallback={
            <main className="flex h-screen w-screen items-center justify-center bg-player-stage-bg p-6">
              <Skeleton className="aspect-[9/16] h-full max-h-[820px] rounded-xl" />
            </main>
          }
        >
          <LazyCleanPlayerPage />
        </Suspense>
      ) : (
        <MonitoringPage />
      )}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
