import { vi } from 'vitest'

export interface MockMapInstance {
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
  once: ReturnType<typeof vi.fn>
  addControl: ReturnType<typeof vi.fn>
  removeControl: ReturnType<typeof vi.fn>
  fitBounds: ReturnType<typeof vi.fn>
  flyTo: ReturnType<typeof vi.fn>
  easeTo: ReturnType<typeof vi.fn>
  jumpTo: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  isStyleLoaded: ReturnType<typeof vi.fn>
  getCenter: ReturnType<typeof vi.fn>
  getZoom: ReturnType<typeof vi.fn>
  getContainer: ReturnType<typeof vi.fn>
  triggerRepaint: ReturnType<typeof vi.fn>
}

export interface MockMarkerInstance {
  options?: { element?: HTMLElement; anchor?: string }
  setLngLat: ReturnType<typeof vi.fn>
  addTo: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  getElement: ReturnType<typeof vi.fn>
}

export interface MockOverlayInstance {
  setProps: ReturnType<typeof vi.fn>
  finalize: ReturnType<typeof vi.fn>
  onAdd: ReturnType<typeof vi.fn>
  onRemove: ReturnType<typeof vi.fn>
}

export const maplibreMockState = {
  maps: [] as MockMapInstance[],
  overlays: [] as MockOverlayInstance[],
  markers: [] as MockMarkerInstance[],
  clickHandlers: [] as Array<(event: { lngLat: { lng: number; lat: number } }) => void>,
  loadHandlers: [] as Array<() => void>,
  overlayPropsHistory: [] as Array<Record<string, unknown>>,
  reset() {
    this.maps = []
    this.overlays = []
    this.markers = []
    this.clickHandlers = []
    this.loadHandlers = []
    this.overlayPropsHistory = []
  },
  triggerMapClick(lngLat: { lng: number; lat: number }) {
    for (const handler of this.clickHandlers) {
      handler({ lngLat })
    }
  },
  triggerMapLoad() {
    for (const handler of this.loadHandlers) {
      handler()
    }
  },
}

export function createMapLibreModuleMock() {
  class MockMap {
    private container: HTMLElement

    constructor(options: { container: HTMLElement }) {
      this.container = options.container
    }

    on = vi.fn((eventName: string, handler: (...args: unknown[]) => void) => {
      if (eventName === 'click') {
        maplibreMockState.clickHandlers.push(
          handler as (event: { lngLat: { lng: number; lat: number } }) => void,
        )
      }
      if (eventName === 'load') {
        maplibreMockState.loadHandlers.push(handler as () => void)
      }
      return this
    })
    off = vi.fn(() => this)
    once = vi.fn(() => this)
    addControl = vi.fn(() => this)
    removeControl = vi.fn(() => this)
    fitBounds = vi.fn(() => this)
    flyTo = vi.fn(() => this)
    easeTo = vi.fn(() => this)
    jumpTo = vi.fn(() => this)
    resize = vi.fn(() => this)
    remove = vi.fn()
    isStyleLoaded = vi.fn(() => true)
    getCenter = vi.fn(() => ({ lng: -46.6333, lat: -23.5505 }))
    getZoom = vi.fn(() => 11.2)
    getContainer = vi.fn(() => this.container)
    triggerRepaint = vi.fn()
  }

  const MapConstructor = vi.fn(function (
    this: unknown,
    options: { container: HTMLElement },
  ): MockMapInstance {
    const mock = new MockMap(options)
    maplibreMockState.maps.push(mock)
    return mock
  })

  class MockMarker {
    options?: { element?: HTMLElement; anchor?: string }
    private element: HTMLElement
    constructor(options?: { element?: HTMLElement; anchor?: string }) {
      this.options = options
      this.element = options?.element ?? document.createElement('div')
    }
    setLngLat = vi.fn(() => this)
    addTo = vi.fn((map: { getContainer?: () => HTMLElement }) => {
      const container = map.getContainer?.()
      if (container && !container.contains(this.element)) {
        container.appendChild(this.element)
      }
      return this
    })
    remove = vi.fn(() => {
      this.element.remove()
    })
    getElement = vi.fn(() => this.element)
  }

  const MarkerConstructor = vi.fn(function (
    this: unknown,
    options?: { element?: HTMLElement; anchor?: string },
  ): MockMarkerInstance {
    const marker = new MockMarker(options)
    maplibreMockState.markers.push(marker)
    return marker
  })

  const NavigationControlConstructor = vi.fn(function () {
    return {
      onAdd: vi.fn(() => document.createElement('div')),
      onRemove: vi.fn(),
    }
  })

  const LngLatBoundsConstructor = vi.fn(function () {
    return {
      extend: vi.fn().mockReturnThis(),
    }
  })

  return {
    Map: MapConstructor,
    Marker: MarkerConstructor,
    NavigationControl: NavigationControlConstructor,
    LngLatBounds: LngLatBoundsConstructor,
  }
}

export function createDeckGlMapboxMock() {
  const MapboxOverlayConstructor = vi.fn(function (
    this: unknown,
    initialProps: Record<string, unknown> = {},
  ): MockOverlayInstance {
    maplibreMockState.overlayPropsHistory.push(initialProps)
    const overlay: MockOverlayInstance = {
      setProps: vi.fn((nextProps: Record<string, unknown>) => {
        maplibreMockState.overlayPropsHistory.push(nextProps)
      }),
      finalize: vi.fn(),
      onAdd: vi.fn(() => document.createElement('div')),
      onRemove: vi.fn(),
    }
    maplibreMockState.overlays.push(overlay)
    return overlay
  })

  return {
    MapboxOverlay: MapboxOverlayConstructor,
  }
}
