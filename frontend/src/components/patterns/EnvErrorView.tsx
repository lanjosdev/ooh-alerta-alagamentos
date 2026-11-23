import { AlertTriangle, Terminal } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { EnvValidationIssue } from '@/env'

export interface EnvErrorViewProps {
  issues: EnvValidationIssue[]
}

export function EnvErrorView({ issues }: EnvErrorViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-severity-critical-fg">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            <CardTitle className="text-base">Configuração de ambiente inválida</CardTitle>
          </div>
          <CardDescription>
            As variáveis do Vite falharam na validação inicial. Corrija o arquivo{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              frontend/.env
            </code>{' '}
            antes de iniciar o monitoramento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTitle>Campos com erro de validação</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {issues.map((issue) => (
                  <li key={`${issue.path}-${issue.message}`}>
                    <span className="font-mono font-semibold">{issue.path}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            <div className="mb-1.5 flex items-center gap-1.5 font-medium text-foreground">
              <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exemplo a partir de frontend/.env.example</span>
            </div>
            <pre className="overflow-x-auto font-mono text-xs text-foreground">
              {`VITE_API_BASE_URL=http://localhost:3333/v1\nVITE_API_TIMEOUT_MS=15000`}
            </pre>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
