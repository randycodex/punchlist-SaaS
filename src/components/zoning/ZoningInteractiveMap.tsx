'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl, {
  type GeoJSONSourceSpecification,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type StyleSpecification,
} from 'maplibre-gl';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import type { ZoningParcelGeometry, ZoningWorksheet } from '@/lib/zoning/types';

type LayerGroup = 'zoning-land-use' | 'supporting-zoning' | 'other-supporting' | 'administrative' | 'basemaps';

type LayerLegendItem = {
  label: string;
  color?: string;
  variant?: 'fill' | 'line' | 'outline' | 'dot' | 'hatch' | 'radio';
};

type LayerToggle = {
  id: string;
  label: string;
  enabled: boolean;
  available: boolean;
  group: LayerGroup;
  color?: string;
  sourceUrl?: string;
  children?: LayerLegendItem[];
};

type ToggleLayerConfig = {
  layerIds: string[];
};

type SupportingLayer = {
  id: string;
  sourceLayer: string;
  color: string;
  opacity?: number;
  dasharray?: number[];
};

const sourceLinks = {
  zoningFeatures: 'https://www.nyc.gov/content/planning/pages/resources?search=zoning#datasets',
  digitalCityMap: 'https://www.nyc.gov/content/planning/pages/resources/datasets/digital-city-map',
  openDataLandmarks: 'https://data.cityofnewyork.us/Housing-Development/Designated-and-Calendared-Buildings-and-Sites/ncre-qhxs',
  flood: 'http://www.region2coastal.com/view-flood-maps-data/view-preliminary-flood-map-data/',
  admin: 'https://www.nyc.gov/content/planning/pages/resources#datasets',
  subwayStops: 'https://data.cityofnewyork.us/Transportation/Subway-Entrances/drex-xx56',
  subwayRoutes: 'https://planninglabs.carto.com/api/v2/sql?q=SELECT * FROM mta_subway_routes&format=SHP',
  aerial: 'https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Orthos_2024/MapServer',
  mapPluto: 'https://www.nyc.gov/content/planning/pages/resources/datasets/mappluto-pluto-change',
  stateSenate: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_State_Senate_Districts/FeatureServer/0',
  stateAssembly: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_State_Assembly_Districts/FeatureServer/0',
  nta: 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Neighborhood_Tabulation_Areas_2020/FeatureServer',
  buildingFootprints: 'https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer',
};

const emptyFeatureCollection = { type: 'FeatureCollection', features: [] } as FeatureCollection;

const landUseLegend: LayerLegendItem[] = [
  { label: 'One & Two Family Buildings', color: '#fff4a7' },
  { label: 'Multi-Family Walk-Up Buildings', color: '#f7bf56' },
  { label: 'Multi-Family Elevator Buildings', color: '#cc8d16' },
  { label: 'Mixed Residential & Commercial Buildings', color: '#ff9966' },
  { label: 'Commercial & Office Buildings', color: '#f44b4b' },
  { label: 'Industrial & Manufacturing', color: '#d774ee' },
  { label: 'Transportation & Utility', color: '#e8c8f4' },
  { label: 'Public Facilities & Institutions', color: '#5aa8dc' },
  { label: 'Open Space & Outdoor Recreation', color: '#8ddc8b' },
  { label: 'Parking Facilities', color: '#bababa' },
  { label: 'Vacant Land', color: '#6b6b6b' },
  { label: 'Other', color: '#efefef' },
];

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

function getGeometryBounds(geometry?: ZoningParcelGeometry) {
  if (!geometry) return undefined;

  const coordinates = (
    geometry.type === 'Polygon'
      ? geometry.coordinates.flat()
      : geometry.coordinates.flatMap((polygon) => polygon.flat())
  ) as number[][];

  const points = coordinates
    .map((coordinate) => ({ longitude: Number(coordinate[0]), latitude: Number(coordinate[1]) }))
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude));

  if (!points.length) return undefined;

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

  return [
    [bounds.minLon, bounds.minLat],
    [bounds.maxLon, bounds.maxLat],
  ] as [[number, number], [number, number]];
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

function getViewportQuery(map: MapLibreMap) {
  const bounds = map.getBounds();
  return new URLSearchParams({
    south: String(bounds.getSouth()),
    west: String(bounds.getWest()),
    north: String(bounds.getNorth()),
    east: String(bounds.getEast()),
  });
}

function toFeatureCollection(payload?: {
  features?: Array<{ type?: string; geometry?: Geometry; properties?: Record<string, unknown> }>;
}) {
  const features = payload?.features
    ?.filter((feature) => feature.geometry && feature.properties)
    .map((feature) => ({
      type: 'Feature' as const,
      geometry: feature.geometry as Geometry,
      properties: feature.properties,
    }));

  return { type: 'FeatureCollection', features: features ?? [] } as FeatureCollection;
}

function renderLegendMarker(item: LayerLegendItem) {
  if (item.variant === 'radio') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-zinc-400 bg-transparent" />;
  }

  if (item.variant === 'dot') {
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/50" style={{ backgroundColor: item.color }} />;
  }

  if (item.variant === 'line') {
    return <span className="h-0.5 w-4 shrink-0" style={{ backgroundColor: item.color }} />;
  }

  if (item.variant === 'outline') {
    return <span className="h-3 w-3 shrink-0 rounded-sm border-2 bg-transparent" style={{ borderColor: item.color }} />;
  }

  if (item.variant === 'hatch') {
    return (
      <span
        className="h-3 w-3 shrink-0 rounded-sm border border-zinc-400"
        style={{
          backgroundColor: item.color,
          backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.65) 0 1px, transparent 1px 3px)',
        }}
      />
    );
  }

  return <span className="h-3 w-3 shrink-0 rounded-sm border border-zinc-300" style={{ backgroundColor: item.color }} />;
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
  'tax-lot': { layerIds: ['city-tax-lot-line', 'city-tax-lot-label', 'tax-lot-fill', 'tax-lot-outline'] },
  'land-use-colors': { layerIds: ['pluto-landuse-fill', 'pluto-landuse-line'] },
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
  'mandatory-inclusionary-housing-areas': { layerIds: ['mandatory-inclusionary-housing-areas-fill', 'mandatory-inclusionary-housing-areas-line'] },
  'inclusionary-housing-designated-areas': { layerIds: ['inclusionary-housing-designated-areas-fill', 'inclusionary-housing-designated-areas-line'] },
  'zoning-for-accessibility': { layerIds: ['zoning-for-accessibility-fill', 'zoning-for-accessibility-line'] },
  'greater-transit-zone': { layerIds: ['greater-transit-zone-fill', 'greater-transit-zone-line'] },
  'transit-zones-parking-geographies': { layerIds: ['transit-zones-parking-geographies-fill', 'transit-zones-parking-geographies-line'] },
  'fresh-zones': { layerIds: ['fresh-zones-fill', 'fresh-zones-line'] },
  'limited-height-districts': { layerIds: ['limited-height-districts-fill', 'limited-height-districts-line'] },
  'lower-density-growth-management-areas': { layerIds: ['lower-density-growth-management-areas-fill', 'lower-density-growth-management-areas-line'] },
  'coastal-zone-boundary': { layerIds: ['coastal-zone-boundary-line'] },
  'waterfront-access-plan': { layerIds: ['waterfront-access-plan-fill', 'waterfront-access-plan-line'] },
  'historic-districts': { layerIds: ['historic-districts-fill', 'historic-districts-line'] },
  landmarks: { layerIds: ['landmarks-fill', 'landmarks-line'] },
  'effective-firm-2007': { layerIds: ['effective-firm-2007-fill', 'effective-firm-2007-line'] },
  'preliminary-firm-2015': { layerIds: ['preliminary-firm-2015-fill', 'preliminary-firm-2015-line'] },
  'environmental-designations': { layerIds: ['environmental-designations-fill', 'environmental-designations-line'] },
  'appendix-i': { layerIds: ['appendix-i-fill', 'appendix-i-line'] },
  'appendix-j-designated-m-districts': { layerIds: ['appendix-j-designated-m-districts-fill', 'appendix-j-designated-m-districts-line'] },
  'business-improvement-districts': { layerIds: ['business-improvement-districts-fill', 'business-improvement-districts-line'] },
  'industrial-business-zones': { layerIds: ['industrial-business-zones-fill', 'industrial-business-zones-line'] },
  'state-senate-districts': { layerIds: ['state-senate-districts-fill', 'state-senate-districts-line'] },
  'state-assembly-districts': { layerIds: ['state-assembly-districts-fill', 'state-assembly-districts-line'] },
  'neighborhood-tabulation-areas': { layerIds: ['neighborhood-tabulation-areas-fill', 'neighborhood-tabulation-areas-line'] },
  subways: { layerIds: ['subway-routes-line'] },
  'building-footprints': { layerIds: ['building-footprints-fill', 'building-footprints-line'] },
  '3d-buildings': { layerIds: ['building-footprints-3d'] },
  'aerial-imagery': { layerIds: ['nyc-aerial-2024'] },
};

const supportingLayers: SupportingLayer[] = [
  { id: 'mandatory-inclusionary-housing-areas', sourceLayer: 'mandatory-inclusionary-housing-areas', color: '#f0a51a', opacity: 0.22 },
  { id: 'inclusionary-housing-designated-areas', sourceLayer: 'inclusionary-housing-designated-areas', color: '#f3c24b', opacity: 0.2 },
  { id: 'zoning-for-accessibility', sourceLayer: 'zoning-for-accessibility', color: '#8f5cc2', opacity: 0.22 },
  { id: 'greater-transit-zone', sourceLayer: 'greater-transit-zone', color: '#009688', opacity: 0.18 },
  { id: 'transit-zones-parking-geographies', sourceLayer: 'transit-zones-parking-geographies', color: '#26a69a', opacity: 0.18 },
  { id: 'fresh-zones', sourceLayer: 'fresh-zones', color: '#f57c00', opacity: 0.2 },
  { id: 'limited-height-districts', sourceLayer: 'limited-height-districts', color: '#546e7a', opacity: 0.18 },
  { id: 'lower-density-growth-management-areas', sourceLayer: 'lower-density-growth-management-areas', color: '#7cb342', opacity: 0.18 },
  { id: 'coastal-zone-boundary', sourceLayer: 'coastal-zone-boundary', color: '#0288d1', opacity: 0, dasharray: [2, 1] },
  { id: 'waterfront-access-plan', sourceLayer: 'waterfront-access-plan', color: '#00acc1', opacity: 0.16 },
  { id: 'historic-districts', sourceLayer: 'historic-districts', color: '#6d4c41', opacity: 0.15 },
  { id: 'landmarks', sourceLayer: 'landmarks', color: '#8d6e63', opacity: 0.18 },
  { id: 'effective-firm-2007', sourceLayer: 'effective-flood-insurance-rate-maps-2007', color: '#1976d2', opacity: 0.14 },
  { id: 'preliminary-firm-2015', sourceLayer: 'preliminary-flood-insurance-rate-maps-2015', color: '#1565c0', opacity: 0.14 },
  { id: 'environmental-designations', sourceLayer: 'environmental-designations', color: '#558b2f', opacity: 0.2 },
  { id: 'appendix-i', sourceLayer: 'appendix-i', color: '#9e9d24', opacity: 0.18 },
  { id: 'appendix-j-designated-m-districts', sourceLayer: 'appendix-j-designated-m-districts', color: '#827717', opacity: 0.18 },
  { id: 'business-improvement-districts', sourceLayer: 'business-improvement-districts', color: '#ad1457', opacity: 0.16 },
  { id: 'industrial-business-zones', sourceLayer: 'industrial-business-zones', color: '#6a1b9a', opacity: 0.16 },
];

const groupLabels: Record<LayerGroup, string> = {
  'zoning-land-use': 'Zoning and Land Use',
  'supporting-zoning': 'Supporting Zoning Layers',
  'other-supporting': 'Other Supporting Layers',
  administrative: 'Administrative Boundaries',
  basemaps: 'Basemaps',
};

const zoningDistrictLegend: LayerLegendItem[] = [
  { label: 'Commercial Districts', color: '#f36f6f' },
  { label: 'Manufacturing Districts', color: '#d774ee' },
  { label: 'Residence Districts', color: '#fff06a' },
  { label: 'Parks', color: '#8ddc8b' },
  { label: 'Battery Park City', color: '#b8b8b8' },
];

const commercialOverlayLegend: LayerLegendItem[] = [
  { label: 'C1-1 through C1-5', color: '#ff7676', variant: 'outline' },
  { label: 'C2-1 through C2-5', color: '#dc0a0a', variant: 'outline' },
];

const transitParkingLegend: LayerLegendItem[] = [
  { label: 'MN Core and LIC Parking Areas', color: '#ead0e6' },
  { label: 'Inner Transit Zone', color: '#d6e6ff' },
  { label: 'Outer Transit Zone', color: '#d6f0ff' },
  { label: 'Special 25-241 Parking Provisions', color: '#6aa6a6', variant: 'hatch' },
  { label: 'Beyond the Greater Transit Zone', color: '#dddddd' },
];

const freshZoneLegend: LayerLegendItem[] = [
  { label: 'Zoning incentives', color: '#d6f0e9' },
  { label: 'Zoning and discretionary tax incentives', color: '#dff5e0' },
  { label: 'Discretionary tax incentives', color: '#ecf8d8' },
];

const landmarkLegend: LayerLegendItem[] = [
  { label: 'Individual Landmarks', color: '#75d6b0', variant: 'dot' },
  { label: 'Interior Landmarks', color: '#9a8cff', variant: 'dot' },
  { label: 'Scenic Landmarks', color: '#d774ee', variant: 'hatch' },
];

const floodLegend: LayerLegendItem[] = [
  { label: 'V (1% floodplain)', color: '#0096b6' },
  { label: 'A (1% floodplain)', color: '#00aee8' },
  { label: 'Shaded X (0.2% floodplain)', color: '#31dfc3' },
];

const environmentalLegend: LayerLegendItem[] = [
  { label: 'Environmental Designations', color: '#5b46ff', variant: 'outline' },
];

const aerialLegend: LayerLegendItem[] = ['2024', '2022', '2020', '2018', '2016', '2014', '2012', '2010', '2008', '2006', '2004', '2001-2', '1996', '1951', '1924'].map((label) => ({
  label,
  variant: 'radio' as const,
}));

export default function ZoningInteractiveMap({ worksheet }: { worksheet: ZoningWorksheet }) {
  const mapContainerId = useId();
  const mapRef = useRef<MapLibreMap | null>(null);
  const [isReady, setIsReady] = useState(false);

  const parcelGeometry = getParcelGeometry(worksheet.report.openData);
  const initialCenter = useMemo(
    () => (parcelGeometry ? getRingCenter(parcelGeometry) : { longitude: -73.95, latitude: 40.73 }),
    [parcelGeometry],
  );
  const parcelBounds = useMemo(() => getGeometryBounds(parcelGeometry), [parcelGeometry]);

  const [toggles, setToggles] = useState<LayerToggle[]>([
    { id: 'tax-lot', label: 'Tax Lots (site)', enabled: true, available: true, group: 'zoning-land-use', color: '#1d4ed8', sourceUrl: sourceLinks.digitalCityMap },
    { id: 'land-use-colors', label: 'Show Land Use Colors', enabled: true, available: true, group: 'zoning-land-use', color: '#ff9966', sourceUrl: sourceLinks.mapPluto, children: landUseLegend },
    { id: 'zoning-districts', label: 'Zoning Districts', enabled: true, available: true, group: 'zoning-land-use', color: '#ffec22', sourceUrl: sourceLinks.zoningFeatures, children: zoningDistrictLegend },
    { id: 'commercial-overlays', label: 'Commercial Overlays', enabled: false, available: true, group: 'zoning-land-use', color: '#dc0a0a', sourceUrl: sourceLinks.zoningFeatures, children: commercialOverlayLegend },
    { id: 'zoning-map-index', label: 'Zoning Map Index', enabled: false, available: true, group: 'zoning-land-use', color: '#000000', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'zoning-map-amendments', label: 'Zoning Map Amendments', enabled: false, available: true, group: 'zoning-land-use', color: '#9FC73E', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'zoning-map-amendments-pending', label: 'Pending Zoning Map Amendments', enabled: false, available: true, group: 'zoning-land-use', color: '#B01F1F', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'special-purpose-districts', label: 'Special Purpose Districts', enabled: false, available: true, group: 'zoning-land-use', color: '#5E6633', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'special-purpose-subdistricts', label: 'Special Purpose Subdistricts', enabled: false, available: true, group: 'zoning-land-use', color: '#8DA610', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'mandatory-inclusionary-housing-areas', label: 'Mandatory Inclusionary Housing Areas', enabled: false, available: true, group: 'supporting-zoning', color: '#f0a51a', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'inclusionary-housing-designated-areas', label: 'Inclusionary Housing Designated Areas', enabled: false, available: true, group: 'supporting-zoning', color: '#f3c24b', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'zoning-for-accessibility', label: 'Zoning For Accessibility', enabled: false, available: true, group: 'supporting-zoning', color: '#8f5cc2', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'greater-transit-zone', label: 'Greater Transit Zone', enabled: false, available: true, group: 'supporting-zoning', color: '#009688', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'transit-zones-parking-geographies', label: 'Transit Zones Parking Geographies', enabled: false, available: true, group: 'supporting-zoning', color: '#26a69a', sourceUrl: sourceLinks.zoningFeatures, children: transitParkingLegend },
    { id: 'fresh-zones', label: 'FRESH Zones', enabled: false, available: true, group: 'supporting-zoning', color: '#f57c00', sourceUrl: sourceLinks.zoningFeatures, children: freshZoneLegend },
    { id: 'limited-height-districts', label: 'Limited Height Districts', enabled: false, available: true, group: 'supporting-zoning', color: '#546e7a', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'lower-density-growth-management-areas', label: 'Lower Density Growth Management Areas', enabled: false, available: true, group: 'supporting-zoning', color: '#7cb342', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'coastal-zone-boundary', label: 'Coastal Zone Boundary', enabled: false, available: true, group: 'supporting-zoning', color: '#0288d1', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'waterfront-access-plan', label: 'Waterfront Access Plan', enabled: false, available: true, group: 'supporting-zoning', color: '#00acc1', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'historic-districts', label: 'Historic Districts', enabled: false, available: true, group: 'supporting-zoning', color: '#6d4c41', sourceUrl: sourceLinks.openDataLandmarks },
    { id: 'landmarks', label: 'Landmarks', enabled: false, available: true, group: 'supporting-zoning', color: '#8d6e63', sourceUrl: sourceLinks.openDataLandmarks, children: landmarkLegend },
    { id: 'effective-firm-2007', label: 'Effective Flood Insurance Rate Maps 2007', enabled: false, available: true, group: 'supporting-zoning', color: '#1976d2', sourceUrl: sourceLinks.flood, children: floodLegend },
    { id: 'preliminary-firm-2015', label: 'Preliminary Flood Insurance Rate Maps 2015', enabled: false, available: true, group: 'supporting-zoning', color: '#1565c0', sourceUrl: sourceLinks.flood, children: floodLegend },
    { id: 'environmental-designations', label: 'Environmental Designations', enabled: false, available: true, group: 'supporting-zoning', color: '#558b2f', sourceUrl: sourceLinks.zoningFeatures, children: environmentalLegend },
    { id: 'appendix-i', label: 'Appendix I', enabled: false, available: true, group: 'supporting-zoning', color: '#9e9d24', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'appendix-j-designated-m-districts', label: 'Appendix J Designated M Districts', enabled: false, available: true, group: 'supporting-zoning', color: '#827717', sourceUrl: sourceLinks.zoningFeatures },
    { id: 'business-improvement-districts', label: 'Business Improvement Districts', enabled: false, available: true, group: 'other-supporting', color: '#ad1457', sourceUrl: sourceLinks.admin },
    { id: 'industrial-business-zones', label: 'Industrial Business Zones', enabled: false, available: true, group: 'other-supporting', color: '#6a1b9a', sourceUrl: sourceLinks.admin },
    { id: 'boroughs', label: 'Boroughs', enabled: false, available: true, group: 'administrative', color: '#F5B176', sourceUrl: sourceLinks.admin },
    { id: 'community-districts', label: 'Community Districts', enabled: false, available: true, group: 'administrative', color: '#76F578', sourceUrl: sourceLinks.admin },
    { id: 'council-districts', label: 'NYC Council Districts', enabled: false, available: true, group: 'administrative', color: '#4CC9F0', sourceUrl: sourceLinks.admin },
    { id: 'state-senate-districts', label: 'NY State Senate Districts', enabled: false, available: true, group: 'administrative', color: '#7e57c2', sourceUrl: sourceLinks.stateSenate },
    { id: 'state-assembly-districts', label: 'NY State Assembly Districts', enabled: false, available: true, group: 'administrative', color: '#5c6bc0', sourceUrl: sourceLinks.stateAssembly },
    { id: 'neighborhood-tabulation-areas', label: 'Neighborhood Tabulation Areas', enabled: false, available: true, group: 'administrative', color: '#26a69a', sourceUrl: sourceLinks.nta },
    { id: 'subways', label: 'Subways', enabled: false, available: true, group: 'basemaps', color: '#e53935', sourceUrl: sourceLinks.subwayRoutes },
    { id: 'building-footprints', label: 'Building Footprints', enabled: false, available: true, group: 'basemaps', color: '#9e9e9e', sourceUrl: sourceLinks.buildingFootprints },
    { id: '3d-buildings', label: '3D Buildings', enabled: false, available: true, group: 'basemaps', color: '#757575', sourceUrl: sourceLinks.buildingFootprints },
    { id: 'aerial-imagery', label: 'Aerial Imagery', enabled: false, available: true, group: 'basemaps', color: '#607d8b', sourceUrl: sourceLinks.aerial, children: aerialLegend },
  ]);
  const [expandedGroups, setExpandedGroups] = useState<Record<LayerGroup, boolean>>({
    'zoning-land-use': true,
    'supporting-zoning': true,
    'other-supporting': true,
    administrative: true,
    basemaps: true,
  });
  const [expandedLayerIds, setExpandedLayerIds] = useState<Record<string, boolean>>({
    'land-use-colors': true,
    'zoning-districts': true,
    'commercial-overlays': true,
    'transit-zones-parking-geographies': true,
    'fresh-zones': true,
    landmarks: true,
    'effective-firm-2007': true,
    'preliminary-firm-2015': true,
    'environmental-designations': true,
    'aerial-imagery': true,
  });

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
            'fill-color': '#3f4b82',
            'fill-opacity': 0.82,
          },
        });

        map.addLayer({
          id: 'tax-lot-outline',
          type: 'line',
          source: 'tax-lot-source',
          paint: {
            'line-color': '#0f1b69',
            'line-width': 5,
            'line-dasharray': [3, 2],
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

      map.addSource('pluto-landuse-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
      });

      map.addSource('building-footprints-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as FeatureCollection,
      });

      map.addSource('subway-routes-source', {
        type: 'geojson',
        data: 'https://planninglabs.carto.com/api/v2/sql?q=SELECT%20*%20FROM%20mta_subway_routes&format=GeoJSON',
      } satisfies GeoJSONSourceSpecification);

      map.addSource('nyc-aerial-2024-source', {
        type: 'raster',
        tiles: ['https://tiles.arcgis.com/tiles/yG5s3afENB5iO9fj/arcgis/rest/services/NYC_Orthos_2024/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: 'NYC OTI Orthophotography 2024',
      });

      map.addLayer({
        id: 'nyc-aerial-2024',
        type: 'raster',
        source: 'nyc-aerial-2024-source',
        layout: { visibility: 'none' },
        paint: {
          'raster-opacity': 0.92,
        },
      });

      map.addLayer({
        id: 'pluto-landuse-fill',
        type: 'fill',
        source: 'pluto-landuse-source',
        layout: { visibility: 'none' },
        paint: {
          'fill-color': [
            'match',
            ['to-string', ['coalesce', ['get', 'LandUse'], ['get', 'landuse'], ['get', 'land_use']]],
            '1',
            '#fff4a7',
            '01',
            '#fff4a7',
            '2',
            '#f7bf56',
            '02',
            '#f7bf56',
            '3',
            '#cc8d16',
            '03',
            '#cc8d16',
            '4',
            '#ff9966',
            '04',
            '#ff9966',
            '5',
            '#f44b4b',
            '05',
            '#f44b4b',
            '6',
            '#d774ee',
            '06',
            '#d774ee',
            '7',
            '#e8c8f4',
            '07',
            '#e8c8f4',
            '8',
            '#5aa8dc',
            '08',
            '#5aa8dc',
            '9',
            '#8ddc8b',
            '09',
            '#8ddc8b',
            '10',
            '#bababa',
            '11',
            '#6b6b6b',
            '#efefef',
          ],
          'fill-opacity': 0.78,
          'fill-outline-color': 'rgba(122, 90, 34, 0.22)',
        },
      });

      map.addLayer({
        id: 'pluto-landuse-line',
        type: 'line',
        source: 'pluto-landuse-source',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#9f5426',
          'line-opacity': 0.8,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 0.9, 18, 1.4],
        },
      });

      map.addLayer({
        id: 'city-tax-lot-label',
        type: 'symbol',
        source: 'zoning',
        'source-layer': 'tax-lots',
        minzoom: 16,
        layout: {
          visibility: 'none',
          'symbol-placement': 'point',
          'text-field': ['coalesce', ['to-string', ['get', 'lot']], ['to-string', ['get', 'lotnum']], ''],
          'text-size': ['interpolate', ['linear'], ['zoom'], 16, 9, 19, 13],
        },
        paint: {
          'text-color': '#c45f1d',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'subway-routes-line',
        type: 'line',
        source: 'subway-routes-source',
        minzoom: 12,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#e53935',
          'line-opacity': 0.95,
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1.2, 15, 2.5, 18, 4],
        },
      });

      map.addLayer({
        id: 'building-footprints-fill',
        type: 'fill',
        source: 'building-footprints-source',
        minzoom: 15,
        layout: { visibility: 'none' },
        paint: {
          'fill-color': '#b6b6b6',
          'fill-opacity': 0.58,
        },
      });

      map.addLayer({
        id: 'building-footprints-line',
        type: 'line',
        source: 'building-footprints-source',
        minzoom: 15,
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#6f6f6f',
          'line-opacity': 0.75,
          'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.4, 18, 1.1],
        },
      });

      map.addLayer({
        id: 'building-footprints-3d',
        type: 'fill-extrusion',
        source: 'building-footprints-source',
        minzoom: 16,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': '#9a9a9a',
          'fill-extrusion-opacity': 0.72,
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['to-number', ['coalesce', ['get', 'heightroof'], ['get', 'height_roof'], ['get', 'height'], 35]],
            0,
            8,
            200,
            200,
          ],
          'fill-extrusion-base': 0,
        },
      });

      const boundaryLayers: Array<{
        id: string;
        sourceId: string;
        dataUrl: string;
        lineColor: string;
        fillColor: string;
        lineWidth: number;
      }> = [
        {
          id: 'boroughs',
          sourceId: 'boroughs-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/gthc-hcne.geojson?$limit=1000',
          lineColor: '#F5B176',
          fillColor: '#F5B176',
          lineWidth: 2.4,
        },
        {
          id: 'community-districts',
          sourceId: 'community-districts-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/5crt-au7u.geojson?$limit=1000',
          lineColor: '#76F578',
          fillColor: '#76F578',
          lineWidth: 1.8,
        },
        {
          id: 'council-districts',
          sourceId: 'council-districts-source',
          dataUrl: 'https://data.cityofnewyork.us/resource/872g-cjhh.geojson?$limit=1000',
          lineColor: '#4CC9F0',
          fillColor: '#4CC9F0',
          lineWidth: 1.8,
        },
        {
          id: 'state-senate-districts',
          sourceId: 'state-senate-districts-source',
          dataUrl:
            'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_State_Senate_Districts/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson',
          lineColor: '#7e57c2',
          fillColor: '#7e57c2',
          lineWidth: 1.8,
        },
        {
          id: 'state-assembly-districts',
          sourceId: 'state-assembly-districts-source',
          dataUrl:
            'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_State_Assembly_Districts/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson',
          lineColor: '#5c6bc0',
          fillColor: '#5c6bc0',
          lineWidth: 1.8,
        },
        {
          id: 'neighborhood-tabulation-areas',
          sourceId: 'neighborhood-tabulation-areas-source',
          dataUrl:
            'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Neighborhood_Tabulation_Areas_2020/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson',
          lineColor: '#26a69a',
          fillColor: '#26a69a',
          lineWidth: 1.6,
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
            'fill-opacity': 0.12,
          },
        });

        map.addLayer({
          id: `${boundary.id}-line`,
          type: 'line',
          source: boundary.sourceId,
          layout: { visibility: 'none' },
          paint: {
            'line-color': boundary.lineColor,
            'line-width': ['interpolate', ['linear'], ['zoom'], 8, boundary.lineWidth, 12, boundary.lineWidth + 0.8, 16, boundary.lineWidth + 1.4],
            'line-opacity': 0.95,
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
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.22, 13, 0.32, 18, 0.26],
        },
      });

      map.addLayer({
        id: 'zd-lines',
        type: 'line',
        source: 'zoning-districts-source',
        'source-layer': 'zoning-districts',
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#cf4b43',
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.25, 13, 0.45, 16, 0.75],
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
          'fill-color': 'rgba(220,10,10,0.12)',
          'fill-opacity': 0.12,
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

      for (const layer of supportingLayers) {
        map.addLayer({
          id: `${layer.id}-fill`,
          type: 'fill',
          source: 'supporting-zoning',
          'source-layer': layer.sourceLayer,
          layout: { visibility: 'none' },
          paint: {
            'fill-color': layer.color,
            'fill-opacity': layer.opacity ?? 0.18,
          },
        });

        map.addLayer({
          id: `${layer.id}-line`,
          type: 'line',
          source: 'supporting-zoning',
          'source-layer': layer.sourceLayer,
          layout: { visibility: 'none' },
          paint: {
            'line-color': layer.color,
            'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 2.5],
            'line-opacity': 0.75,
            ...(layer.dasharray ? { 'line-dasharray': layer.dasharray } : {}),
          },
        });
      }

      if (parcelGeometry && map.getLayer('tax-lot-fill') && map.getLayer('tax-lot-outline')) {
        map.moveLayer('tax-lot-fill');
        map.moveLayer('tax-lot-outline');
      }
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [initialCenter, mapContainerId, parcelBounds, parcelGeometry]);

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

  useEffect(() => {
    const map = mapRef.current;
    const landUseToggle = toggles.find((toggle) => toggle.id === 'land-use-colors');
    if (!map || !isReady || !landUseToggle?.enabled) {
      if (map?.getLayer('pluto-landuse-fill')) setLayerVisibility(map, 'pluto-landuse-fill', false);
      if (map?.getLayer('pluto-landuse-line')) setLayerVisibility(map, 'pluto-landuse-line', false);
      const disabledSource = map?.getSource('pluto-landuse-source') as GeoJSONSource | undefined;
      disabledSource?.setData(emptyFeatureCollection);
      return;
    }

    const source = map.getSource('pluto-landuse-source') as GeoJSONSource | undefined;
    if (!source) return;

    let controller: AbortController | undefined;

    const refreshLandUse = () => {
      if (map.getZoom() < 14) {
        source.setData(emptyFeatureCollection);
        setLayerVisibility(map, 'pluto-landuse-fill', false);
        setLayerVisibility(map, 'pluto-landuse-line', false);
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const query = getViewportQuery(map);

      void fetch(`/api/v1/zoning/mappluto-landuse?${query.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) return undefined;
          return (await response.json()) as { features?: Array<{ type?: string; geometry?: Geometry; properties?: Record<string, unknown> }> };
        })
        .then((payload) => {
          const collection = toFeatureCollection(payload);
          source.setData(collection);
          const hasFeatures = collection.features.length > 0;
          setLayerVisibility(map, 'pluto-landuse-fill', hasFeatures);
          setLayerVisibility(map, 'pluto-landuse-line', hasFeatures);
        })
        .catch(() => undefined);
    };

    refreshLandUse();
    map.on('moveend', refreshLandUse);
    map.on('zoomend', refreshLandUse);

    return () => {
      controller?.abort();
      map.off('moveend', refreshLandUse);
      map.off('zoomend', refreshLandUse);
    };
  }, [isReady, toggles]);

  useEffect(() => {
    const map = mapRef.current;
    const buildingsToggle = toggles.find((toggle) => toggle.id === 'building-footprints');
    const buildings3dToggle = toggles.find((toggle) => toggle.id === '3d-buildings');
    if (!map || !isReady || (!buildingsToggle?.enabled && !buildings3dToggle?.enabled)) {
      if (map?.getLayer('building-footprints-fill')) setLayerVisibility(map, 'building-footprints-fill', false);
      if (map?.getLayer('building-footprints-line')) setLayerVisibility(map, 'building-footprints-line', false);
      if (map?.getLayer('building-footprints-3d')) setLayerVisibility(map, 'building-footprints-3d', false);
      const disabledSource = map?.getSource('building-footprints-source') as GeoJSONSource | undefined;
      disabledSource?.setData(emptyFeatureCollection);
      return;
    }

    const source = map.getSource('building-footprints-source') as GeoJSONSource | undefined;
    if (!source) return;

    let controller: AbortController | undefined;

    const refreshBuildings = () => {
      if (map.getZoom() < 15) {
        source.setData(emptyFeatureCollection);
        setLayerVisibility(map, 'building-footprints-fill', false);
        setLayerVisibility(map, 'building-footprints-line', false);
        return;
      }

      controller?.abort();
      controller = new AbortController();
      const query = getViewportQuery(map);

      void fetch(`/api/v1/zoning/building-footprints?${query.toString()}`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then(async (response) => {
          if (!response.ok) return undefined;
          return (await response.json()) as { features?: Array<{ type?: string; geometry?: Geometry; properties?: Record<string, unknown> }> };
        })
        .then((payload) => {
          const collection = toFeatureCollection(payload);
          source.setData(collection);
          const hasFeatures = collection.features.length > 0;
          setLayerVisibility(map, 'building-footprints-fill', hasFeatures && Boolean(buildingsToggle?.enabled));
          setLayerVisibility(map, 'building-footprints-line', hasFeatures && Boolean(buildingsToggle?.enabled));
          setLayerVisibility(map, 'building-footprints-3d', hasFeatures && Boolean(buildings3dToggle?.enabled));
        })
        .catch(() => undefined);
    };

    refreshBuildings();
    map.on('moveend', refreshBuildings);
    map.on('zoomend', refreshBuildings);

    return () => {
      controller?.abort();
      map.off('moveend', refreshBuildings);
      map.off('zoomend', refreshBuildings);
    };
  }, [isReady, toggles]);

  const groupedToggles = toggles.reduce<Record<LayerGroup, LayerToggle[]>>(
    (groups, toggle) => ({
      ...groups,
      [toggle.group]: [...groups[toggle.group], toggle],
    }),
    {
      'zoning-land-use': [],
      'supporting-zoning': [],
      'other-supporting': [],
      administrative: [],
      basemaps: [],
    },
  );

  return (
    <div className="grid h-full grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="h-full overflow-y-auto border-r border-zinc-300 bg-white text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
        {Object.entries(groupLabels).map(([groupId, label]) => (
          <div key={groupId} className="border-b border-zinc-300 dark:border-zinc-700">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left text-base font-bold hover:bg-zinc-100 dark:hover:bg-zinc-900"
              onClick={() =>
                setExpandedGroups((current) => ({
                  ...current,
                  [groupId as LayerGroup]: !current[groupId as LayerGroup],
                }))
              }
            >
              <span>{label}</span>
              {expandedGroups[groupId as LayerGroup] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {expandedGroups[groupId as LayerGroup] ? (
            <div className="space-y-1 px-3 pb-2">
              {groupedToggles[groupId as LayerGroup].map((toggle) => (
                <div key={toggle.id}>
                  <div
                    className={`flex items-start gap-2 rounded px-2 py-1 ${
                      toggle.available ? 'cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900' : 'cursor-not-allowed opacity-50'
                    }`}
                    title={toggle.label}
                  >
                    <label className="flex min-w-0 flex-1 cursor-inherit items-start gap-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0"
                        checked={toggle.enabled}
                        disabled={!toggle.available}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setToggles((current) =>
                            current.map((item) => (item.id === toggle.id ? { ...item, enabled: checked } : item)),
                          );
                        }}
                      />
                    {toggle.color ? (
                      <span
                        className="mt-1 h-3 w-3 shrink-0 rounded-sm border border-zinc-400"
                        style={{ backgroundColor: toggle.available ? toggle.color : 'transparent' }}
                      />
                    ) : null}
                    <span className="min-w-0 flex-1 leading-snug">{toggle.label}</span>
                    </label>
                    {toggle.children?.length ? (
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                        title={expandedLayerIds[toggle.id] ? 'Collapse layer legend' : 'Expand layer legend'}
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpandedLayerIds((current) => ({ ...current, [toggle.id]: !current[toggle.id] }));
                        }}
                      >
                        {expandedLayerIds[toggle.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      </button>
                    ) : null}
                    {toggle.sourceUrl ? (
                      <a
                        href={toggle.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 shrink-0 text-zinc-500 transition hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                        title="Open source dataset"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  {toggle.children?.length && expandedLayerIds[toggle.id] ? (
                    <div className="ml-8 mt-1 space-y-1 pb-2">
                      {toggle.children.map((item) => (
                        <div key={item.label} className="flex items-center gap-2 text-[11px] leading-tight text-zinc-700 dark:text-zinc-300">
                          {renderLegendMarker(item)}
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            ) : null}
          </div>
        ))}
      </aside>
      <div className="relative">
        <div id={mapContainerId} className="h-full w-full" />
        {parcelBounds ? (
          <button
            type="button"
            className="absolute left-3 top-3 border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-950 shadow transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-zinc-900"
            onClick={() => {
              mapRef.current?.fitBounds(parcelBounds, {
                padding: 120,
                maxZoom: 18.75,
                duration: 450,
              });
            }}
          >
            Focus site
          </button>
        ) : null}
        {!parcelGeometry ? (
          <div className="absolute left-3 top-3 rounded border border-zinc-300 bg-white/95 px-3 py-2 text-xs text-zinc-950 shadow dark:border-zinc-700 dark:bg-zinc-950/90 dark:text-zinc-50">
            Parcel polygon not available yet. Enter an address and save the report to hydrate BBL geometry.
          </div>
        ) : null}
      </div>
    </div>
  );
}
