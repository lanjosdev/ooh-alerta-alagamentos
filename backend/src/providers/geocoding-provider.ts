export interface GeocodingCandidate {
  id: string
  displayName: string
  primaryName: string
  neighborhood: string | null
  city: string | null
  state: string | null
  latitude: number
  longitude: number
}

export interface GeocodingProvider {
  readonly providerName: string
  searchAddress(query: string): Promise<GeocodingCandidate[]>
}
