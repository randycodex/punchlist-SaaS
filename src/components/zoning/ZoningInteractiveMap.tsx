'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl, {
  type GeoJSONSourceSpecification,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Geometry } from 'geojson';
import type { ZoningParcelGeometry, ZoningWorksheet } from '@/lib/zoning/types';

type LayerToggle = {
  id: string;
  label: string;
  enabled: boolean;
  available: boolean;
};

type ToggleLayerConfig = {
  layerIds: string[];
};

function getParcelGeometry(openData: ZoningWorksheet['report']['openData']) {
  const value = openData?.parcelGeometry;
  if (!value || typeof value !== 'object' || !('type' in value) || !('coordinates' in value)) return undefined;
  return value as ZoningParcelGeometry;
}

function getRingCenter(geometry: ZoningParcelGeometry) {
  const ring =
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.coordinates
          .map((polygon) => polygon[0])
          .sort((first, second) => second.length - first.length)[0];

  const points = (ring as number[][])
    .map((coordinate) => ({ longitude: Number(coordinate[0]), latitude: Number(coordinate[1]) }))
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude));

  if (!points.length) return { longitude: -73.95, latitude: 40.73 };

  const bounds = points.reduce(
    (accumulator, point) => ({
      minLat: Math.min(accumulator.minLat, point.latitude),
      maxLat: Math.max(accumulator.maxLat, point.latitude),
      minLon: Math.min(accumulator.minLon, point.longitude),
      maxLon: Math.max(accumulator.maxLon, point.longitude),
    }),
    {
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
      minLon: Number.POSITIVE_INFINITY,
      maxLon: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    longitude: (bounds.minLon + bounds.maxLon) / 2,
    latitude: (bounds.minLat + bounds.maxLat) / 2,
  };
}

function createBaseStyle(): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: {
        type: 'raster',
        tiles: [
          'https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
          'https://cartodb-basemaps-b.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
          'https://cartodb-basemaps-c.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
          'https://cartodb-basemaps-d.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: 'Basemap: CartoDB',
      },
    },
    layers: [
      {
        id: 'base',
        type: 'raster',
        source: 'base',
      },
    ],
  };
}

function setLayerVisibility(map: MapLibreMap, layerId: string, visible: boolean) {
  if (!map.getLayer(layerId)) return;
  map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
}

const vectorSourceConfigs = {
  zoning: {
    type: 'vector',
    tiles: ['https://cartocdn-gusc-b.global.ssl.fastly.net/planninglabs/api/v1/map/4f406a89cdc00a788ac6461e308b4be2:1525336746959/{z}/{x}/{y}.mvt'],
  },
  zoningDistrictsSource: {
    type: 'vector',
    tiles: ['https://cartocdn-gusc-d.global.ssl.fastly.net/planninglabs/api/v1/map/ebc5bb9ee6e423eea48b205e4cec420c:1531773210424/{z}/{x}/{y}.mvt'],
  },
  supportingZoning: {
    type: 'vector',
    tiles: ['https://cartocdn-gusc-d.global.ssl.fastly.net/planninglabs/api/v1/map/166f4d41feddd399bdacaa46f9dc66e1:1531772777417/{z}/{x}/{y}.mvt'],
    minzoom: 0,
  },
  zoningMapAmendments: {
    type: 'vector',
    tiles: ['https://cartocdn-gusc-c.global.ssl.fastly.net/planninglabs/api/v1/map/d2a210c24197461ae9a74d4a0e3076b7:1531772739795/{z}/{x}/{y}.mvt'],
    minzoom: 0,
  },
} as const;

const toggleLayerConfigs: Record<string, ToggleLayerConfig> = {
  'tax-lot': { layerIds: ['tax-lot-fill', 'tax-lot-outline'] },
  boroughs: { layerIds: ['boroughs-fill', 'boroughs-line'] },
  'community-districts': { layerIds: ['community-districts-fill', 'community-districts-line'] },
  'council-districts': { layerIds: ['council-districts-fill', 'council-districts-line'] },
  'zoning-districts': { layerIds: ['zd-fill', 'zd-lines', 'zd-labels'] },
  'commercial-overlays': { layerIds: ['co-fill', 'co-line', 'co-labels'] },
  'zoning-map-index': { layerIds: ['zmi-fill', 'zmi-line', 'zmi-label'] },
  'zoning-map-amendments': { layerIds: ['zma-fill', 'zma-line'] },
  'zoning-map-amendments-pending': { layerIds: ['zmacert-fill', 'zmacert-line'] },
  'special-purpose-districts': { layerIds: ['zoning-sp-fill', 'zoning-sp-line'] },
  'special-purpose-subdistricts': { layerIds: ['zoning-sp-sd-fill', 'zoning-sp-sd-line'] },
};

export default function ZoningInteractiveMap({ worksheet }: { worksheet: ZoningWorksheet }) {
  const mapContainerId = useId();
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);

  const parcelGeometry = getParcelGeometry(worksheet.report.openData);
  const initialCenter = useMemo(
    () => (parcelGeometry ? getRingCenter(parcelGeometry) : { longitude: -73.95, latitude: 40.73 }),
    [parcelGeometry],
  );

  const [toggles, setToggles] = useState<LayerToggle[]>([
    { id: 'tax-lot', label: 'Tax Lots (site)', enabled: true, available: true },
    { id: 'boroughs', label: 'Boroughs', enabled: false, available: true },
    { id: 'community-districts', label: 'Community Districts', enabled: false, available: true },
    { id: 'council-districts', label: 'NYC Council Districts', enabled: false, available: true },
    { id: 'zoning-districts', label: 'Zoning Districts', enabled: true, available: true },
    { id: 'commercial-overlays', label: 'Commercial Overlays', enabled: false, available: true },
    { id: 'zoning-map-index', label: 'Zoning Map Index', enabled: false, available: true },
    { id: 'zoning-map-amendments', label: 'Zoning Map Amendments', enabled: false, available: true },
    { id: 'zoning-map-amendments-pending', label: 'Pending Zoning Map Amendments', enabled: false, available: true },
    { id: 'special-purpose-districts', label: 'Special Purpose Districts', enabled: false, available: true },
    { id: 'special-purpose-subdistricts', label: 'Special Purpose Subdistricts', enabled: false, available: true },
    { id: 'subways', label: 'Subways (coming soon)', enabled: false, available: false },
    { id: 'building-footprints', label: 'Building Footprints (coming soon)', enabled: false, available: false },
  ]);

  useEffect(() => {
    const container = document.getElementById(mapContainerId);
    if (!container || mapRef.current) return;

    const map = new maplibregl.Map({
      container,
      style: createBaseStyle(),
      center: [initialCenter.longitude, initialCenter.latitude],
      zoom: parcelGeometry ? 18.5 : 12,
      bearing: -20,
      pitch: 0,
      attributionControl: false,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      setIsReady(true);

      if (parcelGeometry) {
        map.addSource(
          'tax-lot-source',
          {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: parcelGeometry as unknown as Geometry,
          },
          } satisfies GeoJSONSourceSpecification,
        );

        map.addLayer({
          id: 'tax-lot-fill',
          type: 'fill',
          source: 'tax-lot-source',
          paint: {
            'fill-color': '#1d4ed8',
            'fill-opacity': 0.4,
          },
        });

        map.addLayer({
          id: 'tax-lot-outline',
          type: 'line',
          source: 'tax-lot-source',
          paint: {
            'line-color': '#0b1b4a',
            'line-width': 3,
            'line-dasharray': [2, 2],
          },
        });
      }

      map.addSource('zoning', vectorSourceConfigs.zoning as unknown as GeoJSONSourceSpecification);
      map.addSource(
        'zoning-districts-source',
        vectorSourceConfigs.zoningDistrictsSource as unknown as GeoJSONSourceSpecification,
      );
      map.addSource(
        'supporting-zoning',
        vectorSourceConfigs.supportingZoning as unknown as GeoJSONSourceSpecification,
      );
      map.addSource(
        'zoning-map-amendments-source',
        vectorSourceConfigs.zoningMapAmendments as unknown as GeoJSONSourceSpecification,
      );

      const boundaryLayers: Array<{
        id: string;
        sourceId: string;
        dataUrl: string;
        lineColor: string;
        fillColor: string;
      }> = [
        {
          id: 'boroughs',
          sourceId: 'boroughs-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/gthc-hcne.geojson?$limit=1000',
          lineColor: '#0f172a',
          fillColor: '#0f172a',
        },
        {
          id: 'community-districts',
          sourceId: 'community-districts-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/5crt-au7u.geojson?$limit=1000',
          lineColor: '#334155',
          fillColor: '#334155',
        },
        {
          id: 'council-districts',
          sourceId: 'council-districts-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/872g-cjhh.geojson?$limit=1000',
          lineColor: '#475569',
          fillColor: '#475569',
        },
      ];

      for (const boundary of boundaryLayers) {
        map.addSource(
          boundary.sourceId,
          {
            type: 'geojson',
            data: boundary.dataUrl,
          } satisfies GeoJSONSourceSpecification,
        );

        map.addLayer({
          id: `${boundary.id}-fill`,
          type: 'fill',
          source: boundary.sourceId,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': boundary.fillColor,
            'fill-opacity': 0.06,
          },
        });

        map.addLayer({
          id: `${boundary.id}-line`,
          type: 'line',
          source: boundary.sourceId,
          layout: { visibility: 'none' },
          paint: {
            'line-color': boundary.lineColor,
            'line-width': 1.5,
            'line-opacity': 0.75,
          },
        });
      }

      map.addLayer({
        id: 'zd-fill',
        type: 'fill',
        source: 'zoning-districts-source',
        'source-layer': 'zoning-districts',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'match',
            ['get', 'primaryzone'],
            'BP',
            '#808080',
            'C1',
            '#ffa89c',
            'C2',
            '#fd9a8f',
            'C3',
            '#fa867c',
            'C4',
            '#f76e67',
            'C5',
            '#f2544e',
            'C6',
            '#ee3a36',
            'C7',
            '#ea2220',
            'C8',
            '#e50000',
            'M1',
            '#f3b3ff',
            'M2',
            '#e187f3',
            'M3',
            '#cf5ce6',
            'PA',
            '#78D271',
            'R1',
            '#fff8a6',
            'R2',
            '#fff7a6',
            'R3',
            '#fff797',
            'R4',
            '#fff584',
            'R5',
            '#fff36c',
            'R6',
            '#fff153',
            'R7',
            '#ffee39',
            'R8',
            '#ffec22',
            'R9',
            '#ffeb0e',
            'R10',
            '#ffea00',
            '#cccccc',
          ],
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.3, 16, 0],
        },
      });

      map.addLayer({
        id: 'zd-lines',
        type: 'line',
        source: 'zoning-districts-source',
        'source-layer': 'zoning-districts',
        layout: { visibility: 'none' },
        paint: {
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 0.2, 16, 0.5],
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1, 14, 3],
        },
      });

      map.addLayer({
        id: 'zd-labels',
        type: 'symbol',
        source: 'zoning-districts-source',
        'source-layer': 'zoning-districts',
        layout: {
          visibility: 'none',
          'symbol-placement': 'point',
          'text-field': ['coalesce', ['get', 'zonedist'], ''],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 16],
        },
        paint: {
          'text-color': ['interpolate', ['linear'], ['zoom'], 15, '#626262', 16, '#444444'],
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 2,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0, 13, 1],
        },
      });

      map.addLayer({
        id: 'co-fill',
        type: 'fill',
        source: 'zoning',
        'source-layer': 'commercial-overlays',
        minzoom: 12,
        layout: { visibility: 'none' },
        paint: {
          'fill-outline-color': '#cdcdcd',
          'fill-opacity': 0,
        },
      });

      map.addLayer({
        id: 'co-line',
        type: 'line',
        source: 'zoning',
        'source-layer': 'commercial-overlays',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.1, 15, 2],
          'line-opacity': 0.75,
          'line-color': 'rgba(220,10,10,1)',
        },
      });

      map.addLayer({
        id: 'co-labels',
        type: 'symbol',
        source: 'zoning',
        'source-layer': 'commercial-overlays',
        minzoom: 14,
        layout: {
          visibility: 'none',
          'symbol-placement': 'point',
          'text-field': ['coalesce', ['get', 'overlay'], ''],
        },
        paint: {
          'text-color': 'rgba(200,0,0,1)',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 2,
          'text-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'zmi-line',
        type: 'line',
        source: 'supporting-zoning',
        'source-layer': 'zoning-map-index',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 12, 3],
          'line-color': '#000000',
        },
      });

      map.addLayer({
        id: 'zmi-label',
        type: 'symbol',
        source: 'supporting-zoning',
        'source-layer': 'zoning-map-index-centroids',
        layout: {
          visibility: 'none',
          'symbol-placement': 'point',
          'text-field': ['coalesce', ['get', 'zmi_label'], ''],
          'text-allow-overlap': true,
          'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 16, 18, 20, 24],
        },
        paint: {
          'text-color': 'rgba(200,0,0,1)',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
          'text-halo-blur': 2,
          'text-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'zmi-fill',
        type: 'fill',
        source: 'supporting-zoning',
        'source-layer': 'zoning-map-index',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#000000',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0.1, 16, 0.1],
        },
      });

      map.addLayer({
        id: 'zma-line',
        type: 'line',
        source: 'zoning-map-amendments-source',
        'source-layer': 'zoning-map-amendments',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 12, 3],
          'line-color': '#9FC73E',
          'line-dasharray': [1, 1],
          'line-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'zma-fill',
        type: 'fill',
        source: 'zoning-map-amendments-source',
        'source-layer': 'zoning-map-amendments',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#9FC73E',
          'fill-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'zmacert-line',
        type: 'line',
        source: 'supporting-zoning',
        'source-layer': 'zoning-map-amendments-pending',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 12, 3],
          'line-color': '#B01F1F',
          'line-dasharray': [1, 1],
          'line-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'zmacert-fill',
        type: 'fill',
        source: 'supporting-zoning',
        'source-layer': 'zoning-map-amendments-pending',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#B01F1F',
          'fill-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'zoning-sp-line',
        type: 'line',
        source: 'zoning',
        'source-layer': 'special-purpose-districts',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 12, 3],
          'line-color': 'rgba(94,102,51,0.6)',
          'line-dasharray': [1, 1],
        },
      });

      map.addLayer({
        id: 'zoning-sp-fill',
        type: 'fill',
        source: 'zoning',
        'source-layer': 'special-purpose-districts',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#5E6633',
          'fill-opacity': 0.2,
        },
      });

      map.addLayer({
        id: 'zoning-sp-sd-line',
        type: 'line',
        source: 'supporting-zoning',
        'source-layer': 'special-purpose-subdistricts',
        layout: { visibility: 'none' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 12, 3],
          'line-color': '#8DA610',
          'line-dasharray': [1, 1],
          'line-opacity': 0.6,
        },
      });

      map.addLayer({
        id: 'zoning-sp-sd-fill',
        type: 'fill',
        source: 'supporting-zoning',
        'source-layer': 'special-purpose-subdistricts',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#8DA610',
          'fill-opacity': 0.2,
        },
      });
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [initialCenter, mapContainerId, parcelGeometry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isReady) return;

    for (const toggle of toggles) {
      const config = toggleLayerConfigs[toggle.id];
      if (!config) continue;

      for (const layerId of config.layerIds) {
        setLayerVisibility(map, layerId, toggle.enabled);
      }
    }
  }, [isReady, toggles]);

  return (
    <div className="grid h-full grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="h-full overflow-y-auto border-r border-zinc-300 bg-white text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="border-b border-zinc-300 px-3 py-2 font-semibold dark:border-zinc-700">Zoning and Land Use</div>
        <div className="space-y-1 px-3 py-2">
          {toggles.map((toggle) => (
            <label
              key={toggle.id}
              className={`flex items-center gap-2 rounded px-2 py-1 ${
                toggle.available ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={toggle.enabled}
                disabled={!toggle.available}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setToggles((current) =>
                    current.map((item) => (item.id === toggle.id ? { ...item, enabled: checked } : item)),
                  );
                }}
              />
              <span className="truncate">{toggle.label}</span>
            </label>
          ))}
        </div>
      </aside>
      <div className="relative">
        <div id={mapContainerId} className="h-full w-full" />
        {!parcelGeometry ? (
          <div className="absolute left-3 top-3 rounded border border-zinc-300 bg-white/95 px-3 py-2 text-xs text-zinc-950 shadow dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-50">
            Parcel polygon not available yet. Enter an address and save the report to hydrate BBL geometry.
          </div>
        ) : null}
      </div>
    </div>
  );
}
