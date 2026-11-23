import type { ForecastProvider, RegionForecast } from '../forecast-provider.js'

/**
 * Template de referência para plugar provedores comerciais de alta resolução
 * (ex.: Tomorrow.io ~2,5 km / nowcasting 5-15 min ou Google Weather API).
 *
 * Passos para ativar um novo provedor pago em produção:
 * 1. Adicione as credenciais necessárias em `src/env.ts` (ex.: `TOMORROW_IO_API_KEY`).
 * 2. Implemente `ForecastProvider` em `src/providers/<nome>/<nome>-forecast-provider.ts`
 *    retornando exatamente a estrutura normalizada `RegionForecast`.
 * 3. Registre o novo provedor em `src/providers/provider-factory.ts` para o respectivo
 *    valor de `FORECAST_PROVIDER`, sem alterar services, motor de risco, controllers ou rotas.
 */
export class PaidForecastProviderTemplate implements ForecastProvider {
  readonly providerName: string

  constructor(
    providerName: 'tomorrow-io' | 'google-weather',
    private readonly apiKey: string,
  ) {
    this.providerName = providerName
  }

  async getHourlyForecast(lat: number, lon: number, _now: Date = new Date()): Promise<RegionForecast> {
    if (!this.apiKey) {
      throw new Error(`Credencial não configurada para o provedor ${this.providerName}`)
    }

    throw new Error(
      `Adaptador comercial '${this.providerName}' ainda não implementado para (${lat}, ${lon}). Consulte src/providers/stubs/paid-forecast-provider.template.ts.`,
    )
  }
}
