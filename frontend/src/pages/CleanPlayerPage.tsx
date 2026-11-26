import { useMemo } from 'react'
import { EmptyState } from '@/components/patterns/EmptyState'
import { QueryErrorAlert } from '@/components/patterns/QueryErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { PlayerCanvas } from '@/features/player/components/PlayerCanvas'
import { usePlayerScene } from '@/features/player/hooks/usePlayerScene'
import { parsePlayerUrlParams } from '@/features/player/utils/playerUrlState'
import { cn } from '@/lib/utils'

export function CleanPlayerPage() {
  const search = typeof window !== 'undefined' ? window.location.search : ''
  const urlState = useMemo(() => parsePlayerUrlParams(search), [search])

  const sceneQuery = usePlayerScene(urlState.target, urlState.scenario)

  return (
    <main
      className="flex h-screen w-screen items-center justify-center overflow-hidden bg-player-stage-bg p-2 sm:p-4"
      aria-label="Modo Player DOOH em tela cheia"
    >
      {sceneQuery.isPending ? (
        <div
          className={cn(
            'flex items-center justify-center',
            urlState.format === 'landscape'
              ? 'aspect-video w-full max-w-6xl'
              : 'aspect-[9/16] h-full max-h-full',
          )}
          aria-label="Carregando cena do player limpo"
        >
          <Skeleton className="h-full w-full rounded-xl" />
        </div>
      ) : sceneQuery.isError ? (
        <div className="w-full max-w-lg">
          <QueryErrorAlert
            error={sceneQuery.error}
            title="Não foi possível carregar a cena do Player DOOH"
            onRetry={() => void sceneQuery.refetch()}
          />
        </div>
      ) : !sceneQuery.data ? (
        <div className="w-full max-w-lg rounded-xl bg-card p-6">
          <EmptyState
            title="Cena do Player indisponível"
            description="A API não retornou dados de cena para os parâmetros informados na URL."
          />
        </div>
      ) : (
        <div
          className={cn(
            'flex items-center justify-center',
            urlState.format === 'landscape'
              ? 'aspect-video max-h-full w-full max-w-7xl'
              : 'aspect-[9/16] h-full max-h-full max-w-full',
          )}
        >
          <PlayerCanvas
            scene={sceneQuery.data}
            format={urlState.format}
            brandConfig={urlState.brandConfig}
            fullscreen
          />
        </div>
      )}
    </main>
  )
}

export default CleanPlayerPage
