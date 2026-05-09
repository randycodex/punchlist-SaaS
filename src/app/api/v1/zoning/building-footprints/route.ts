import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const buildingFootprintsQueryUrl =
  'https://services2.arcgis.com/IsDCghZ73NgoYoz5/ArcGIS/rest/services/NYC_Building_Footprint/FeatureServer/0/query';

function parseCoordinate(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const url = new URL(request.url);
  const south = parseCoordinate(url.searchParams.get('south'));
  const west = parseCoordinate(url.searchParams.get('west'));
  const north = parseCoordinate(url.searchParams.get('north'));
  const east = parseCoordinate(url.searchParams.get('east'));

  if (
    south === undefined ||
    west === undefined ||
    north === undefined ||
    east === undefined ||
    south >= north ||
    west >= east
  ) {
    return NextResponse.json({ error: 'Valid south, west, north, and east bounds are required.' }, { status: 400 });
  }

  const params = new URLSearchParams({
    f: 'geojson',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    geometryType: 'esriGeometryEnvelope',
    spatialRel: 'esriSpatialRelIntersects',
    inSR: '4326',
    outSR: '4326',
    resultRecordCount: '1000',
    geometry: JSON.stringify({
      xmin: west,
      ymin: south,
      xmax: east,
      ymax: north,
      spatialReference: { wkid: 4326 },
    }),
  });

  try {
    const response = await fetch(`${buildingFootprintsQueryUrl}?${params.toString()}`, {
      headers: { accept: 'application/geo+json, application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Building footprint request failed: ${response.status}` }, { status: 502 });
    }

    const payload = await response.json();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch building footprints.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
