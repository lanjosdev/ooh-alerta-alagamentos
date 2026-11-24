import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { EnvErrorView } from '@/components/patterns/EnvErrorView'
import { envValidation } from '@/env'
import { queryClient } from '@/lib/query-client'
import { MonitoringPage } from '@/pages/MonitoringPage'

export function App() {
  if (!envValidation.success) {
    return <EnvErrorView issues={envValidation.issues} />
  }

  return (
    <QueryClientProvider client={queryClient}>
      <MonitoringPage />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
