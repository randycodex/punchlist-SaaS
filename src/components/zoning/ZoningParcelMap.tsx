'use client';

import { ExternalLink, MapPinned } from 'lucide-react';
import type { ZoningParcelGeometry, ZoningWorksheet } from '@/lib/zoning/types';
import ZoningInteractiveMap from '@/components/zoning/ZoningInteractiveMap';

type Tile = {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

type Point = {
  longitude: number;
  latitude: number;
};

const mapWidth = 1120;
const mapHeight = 560;
const tileSize = 256;

function getOpenDataValue(openData: ZoningWorksheet['report']['openData'], key: string) {
  const value = openData?.[key];
  return typeof value === 'string' ? value : '';
}

function getParcelGeometry(openData: ZoningWorksheet['report']['openData']) {
  const value = openData?.parcelGeometry;
  if (!value || typeof value !== 'object' || !('type' in value) || !('coordinates' in value)) return undefined;
  return value as ZoningParcelGeometry;
}

function getPolygonRing(geometry?: ZoningParcelGeometry): Point[] {
  if (!geometry) return [];
  const ring = (
    geometry.type === 'Polygon'
      ? geometry.coordinates[0]
      : geometry.coordinates
          .map((polygon) => polygon[0])
          .sort((first, second) => second.length - first.length)[0]
  ) as number[][];

  if (!Array.isArray(ring)) return [];

  return ring
    .map((coordinate) => ({
      longitude: Number(coordinate[0]),
      latitude: Number(coordinate[1]),
    }))
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude));
}

function getRingCenter(ring: Point[], fallbackLatitude: number, fallbackLongitude: number) {
  if (!ring.length) {
    return { latitude: fallbackLatitude, longitude: fallbackLongitude };
  }

  const bounds = ring.reduce(
    (accumulator, point) => ({
      minLatitude: Math.min(accumulator.minLatitude, point.latitude),
      maxLatitude: Math.max(accumulator.maxLatitude, point.latitude),
      minLongitude: Math.min(accumulator.minLongitude, point.longitude),
      maxLongitude: Math.max(accumulator.maxLongitude, point.longitude),
    }),
    {
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
    },
  );

  return {
    latitude: (bounds.minLatitude + bounds.maxLatitude) / 2,
    longitude: (bounds.minLongitude + bounds.maxLongitude) / 2,
  };
}

function projectPoint(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom;
  const latitudeRadians = (latitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale * tileSize,
    y: ((1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2) * scale * tileSize,
  };
}

function getTileState(latitude: number, longitude: number, zoom: number) {
  const center = projectPoint(latitude, longitude, zoom);
  const centerTileX = Math.floor(center.x / tileSize);
  const centerTileY = Math.floor(center.y / tileSize);
  const pixelX = center.x - centerTileX * tileSize;
  const pixelY = center.y - centerTileY * tileSize;

  const xRadius = Math.ceil(mapWidth / tileSize / 2) + 1;
  const yRadius = Math.ceil(mapHeight / tileSize / 2) + 1;

  const tiles: Tile[] = [];
  for (let yOffset = -yRadius; yOffset <= yRadius; yOffset += 1) {
    for (let xOffset = -xRadius; xOffset <= xRadius; xOffset += 1) {
      tiles.push({
        x: centerTileX + xOffset,
        y: centerTileY + yOffset,
        offsetX: mapWidth / 2 + xOffset * tileSize - pixelX,
        offsetY: mapHeight / 2 + yOffset * tileSize - pixelY,
      });
    }
  }

  return tiles;
}

function getPolygonPoints(ring: Point[], centerLatitude: number, centerLongitude: number, zoom: number) {
  const center = projectPoint(centerLatitude, centerLongitude, zoom);
  return ring
    .map((point) => {
      const projected = projectPoint(point.latitude, point.longitude, zoom);
      return `${projected.x - center.x + mapWidth / 2},${projected.y - center.y + mapHeight / 2}`;
    })
    .join(' ');
}

export default function ZoningParcelMap({ worksheet }: { worksheet: ZoningWorksheet }) {
  const report = worksheet.report;
  const latitude = Number(getOpenDataValue(report.openData, 'latitude'));
  const longitude = Number(getOpenDataValue(report.openData, 'longitude'));
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const geometry = getParcelGeometry(report.openData);
  const parcelRing = getPolygonRing(geometry);
  const center = getRingCenter(parcelRing, latitude, longitude);
  const hasParcelGeometry = parcelRing.length >= 4;
  const zoom = 20;
  const tiles = hasCoordinates ? getTileState(center.latitude, center.longitude, zoom) : [];
  const polygonPoints = hasParcelGeometry ? getPolygonPoints(parcelRing, center.latitude, center.longitude, zoom) : '';
  const tileHost = ['a', 'b', 'c', 'd'][Math.abs(Math.round(latitude * 1000)) % 4];
  const zolaUrl = report.bbl
    ? `https://zola.planning.nyc.gov/l/lot/${report.bbl}`
    : 'https://zola.planning.nyc.gov/';

  return (
    <section className="border border-zinc-300 bg-white text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex min-w-0 items-center gap-2">
          <MapPinned className="h-4 w-4 shrink-0" />
          <span className="truncate uppercase">Map</span>
        </div>
        <a
          href={zolaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 transition hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white"
        >
          ZOLA
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="relative h-[35rem] overflow-hidden bg-zinc-200 dark:bg-zinc-900">
          <ZoningInteractiveMap worksheet={worksheet} />
        </div>

        <div className="border-t border-zinc-300 text-sm dark:border-zinc-700 lg:border-l lg:border-t-0">
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-zinc-300 dark:border-zinc-700">
            <div className="bg-zinc-50 px-2 py-1 font-bold dark:bg-zinc-900">BBL</div>
            <div className="px-2 py-1">{report.bbl || 'Pending'}</div>
          </div>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-zinc-300 dark:border-zinc-700">
            <div className="bg-zinc-50 px-2 py-1 font-bold dark:bg-zinc-900">District</div>
            <div className="px-2 py-1">{[report.zoningDistrict, report.commercialOverlay].filter(Boolean).join(' / ') || 'Pending'}</div>
          </div>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-zinc-300 dark:border-zinc-700">
            <div className="bg-zinc-50 px-2 py-1 font-bold dark:bg-zinc-900">Map</div>
            <div className="px-2 py-1">{report.zoningMap || 'Pending'}</div>
          </div>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] border-b border-zinc-300 dark:border-zinc-700">
            <div className="bg-zinc-50 px-2 py-1 font-bold dark:bg-zinc-900">Lat/Lon</div>
            <div className="px-2 py-1">{hasCoordinates ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : 'Pending'}</div>
          </div>
          <div className="px-2 py-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
            {hasParcelGeometry
              ? `Lot boundary from ${getOpenDataValue(report.openData, 'parcelGeometrySource') || 'NYC Digital Tax Map'}.`
              : 'Lot boundary shown as an approximate marker until NYC Digital Tax Map geometry is available for this lot.'}
          </div>
        </div>
      </div>
    </section>
  );
}
