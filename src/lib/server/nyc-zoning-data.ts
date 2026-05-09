import 'server-only';

export type NYCParcelZoningFacts = {
  address?: string;
  zipCode?: string;
  borough?: string;
  boroughCode?: string;
  block?: string;
  lot?: string;
  bbl?: string;
  bin?: string;
  zoningDistrict?: string;
  zoningDistricts?: string[];
  commercialOverlay?: string;
  commercialOverlays?: string[];
  specialDistrict?: string;
  specialDistricts?: string[];
  limitedHeightDistrict?: string;
  zoningMap?: string;
  zoningMapCode?: string;
  ownerName?: string;
  landUse?: string;
  lotArea?: string;
  lotFront?: string;
  lotDepth?: string;
  yearBuilt?: string;
  buildingClass?: string;
  buildingArea?: string;
  numberOfBuildings?: string;
  numberOfFloors?: string;
  totalUnits?: string;
  residentialUnits?: string;
  residentialFar?: string;
  commercialFar?: string;
  facilityFar?: string;
  builtFar?: string;
  communityDistrict?: string;
  councilDistrict?: string;
  schoolDistrict?: string;
  policePrecinct?: string;
  fireCompany?: string;
  sanitationBorough?: string;
  sanitationDistrict?: string;
  sanitationSubsection?: string;
  eDesignation?: string;
  latitude?: string;
  longitude?: string;
  xCoord?: string;
  yCoord?: string;
  sourceVersion?: string;
  parcelGeometry?: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  parcelGeometrySource?: string;
};

type GeoSearchFeature = {
  properties?: {
    label?: string;
    postalcode?: string;
    borough?: string;
    addendum?: {
      pad?: {
        bbl?: string;
        bin?: string;
      };
    };
  };
};

type ZoningTaxLotRow = {
  borough_code?: string;
  tax_block?: string;
  tax_lot?: string;
  bbl?: string;
  zoning_district_1?: string;
  zoning_district_2?: string;
  zoning_district_3?: string;
  zoning_district_4?: string;
  commercial_overlay_1?: string;
  commercial_overlay_2?: string;
  special_district_1?: string;
  special_district_2?: string;
  special_district_3?: string;
  limited_height_district?: string;
  zoning_map_number?: string;
  zoning_map_code?: string;
};

type PlutoRow = {
  address?: string;
  borough?: string;
  block?: string;
  lot?: string;
  bbl?: string;
  zipcode?: string;
  zonedist1?: string;
  zonedist2?: string;
  zonedist3?: string;
  zonedist4?: string;
  overlay1?: string;
  overlay2?: string;
  spdist1?: string;
  spdist2?: string;
  spdist3?: string;
  ltdheight?: string;
  zonemap?: string;
  zmcode?: string;
  ownername?: string;
  landuse?: string;
  lotarea?: string;
  lotfront?: string;
  lotdepth?: string;
  yearbuilt?: string;
  bldgclass?: string;
  bldgarea?: string;
  numbldgs?: string;
  numfloors?: string;
  unitstotal?: string;
  unitsres?: string;
  residfar?: string;
  commfar?: string;
  facilfar?: string;
  builtfar?: string;
  cd?: string;
  council?: string;
  schooldist?: string;
  policeprct?: string;
  firecomp?: string;
  sanitboro?: string;
  sanitdistrict?: string;
  sanitsub?: string;
  edesig?: string;
  edesignum?: string;
  latitude?: string;
  longitude?: string;
  xcoord?: string;
  ycoord?: string;
  version?: string;
};

type TaxLotPolygonFeature = {
  type?: string;
  geometry?: NYCParcelZoningFacts['parcelGeometry'];
  properties?: {
    BBL?: string;
    BORO?: string;
    BLOCK?: number;
    LOT?: number;
  };
};

const boroughNames: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
  MN: 'Manhattan',
  BX: 'Bronx',
  BK: 'Brooklyn',
  QN: 'Queens',
  SI: 'Staten Island',
};

const landUseLabels: Record<string, string> = {
  '1': 'One & Two Family Buildings',
  '2': 'Multi-Family Walk-Up Buildings',
  '3': 'Multi-Family Elevator Buildings',
  '4': 'Mixed Residential & Commercial Buildings',
  '5': 'Commercial & Office Buildings',
  '6': 'Industrial & Manufacturing',
  '7': 'Transportation & Utility',
  '8': 'Public Facilities & Institutions',
  '9': 'Open Space & Outdoor Recreation',
  '10': 'Parking Facilities',
  '11': 'Vacant Land',
};

function compact(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function normalizeBbl(value?: string) {
  const digits = value?.replace(/\D/g, '') ?? '';
  return digits.length >= 10 ? digits.slice(0, 10) : '';
}

function formatNumber(value?: string, options?: Intl.NumberFormatOptions) {
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.NumberFormat('en-US', options).format(parsed);
}

function formatFeet(value?: string) {
  const formatted = formatNumber(value, { maximumFractionDigits: 2 });
  return formatted ? `${formatted} ft` : undefined;
}

function formatSquareFeet(value?: string) {
  const formatted = formatNumber(value, { maximumFractionDigits: 0 });
  return formatted ? `${formatted} sq ft` : undefined;
}

async function fetchJson<T>(url: string): Promise<T | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function lookupAddress(address?: string, borough?: string, zipCode?: string) {
  const query = compact([address, borough, zipCode]).join(' ');
  if (!query) return undefined;

  const payload = await fetchJson<{ features?: GeoSearchFeature[] }>(
    `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(query)}&size=1`,
  );

  const properties = payload?.features?.[0]?.properties;
  const pad = properties?.addendum?.pad;
  const bbl = normalizeBbl(pad?.bbl);

  if (!bbl) return undefined;

  return {
    address: properties?.label?.replace(/, USA$/, ''),
    zipCode: properties?.postalcode,
    borough: properties?.borough,
    bbl,
    bin: pad?.bin,
  };
}

async function lookupZoningTaxLot(bbl: string) {
  const rows = await fetchJson<ZoningTaxLotRow[]>(
    `https://data.cityofnewyork.us/resource/fdkv-4t4z.json?bbl=${encodeURIComponent(bbl)}&$limit=1`,
  );

  return rows?.[0];
}

async function lookupPluto(bbl: string) {
  const rows = await fetchJson<PlutoRow[]>(
    `https://data.cityofnewyork.us/resource/64uk-42ks.json?bbl=${encodeURIComponent(bbl)}&$limit=1`,
  );

  return rows?.[0];
}

async function lookupTaxLotPolygon(bbl: string) {
  const params = new URLSearchParams({
    f: 'geojson',
    where: `BBL='${bbl.replace(/'/g, "''")}'`,
    outFields: 'BBL,BORO,BLOCK,LOT',
    returnGeometry: 'true',
    outSR: '4326',
  });
  const payload = await fetchJson<{ features?: TaxLotPolygonFeature[] }>(
    `https://services6.arcgis.com/yG5s3afENB5iO9fj/ArcGIS/rest/services/DTM_ETL_DAILY_view/FeatureServer/0/query?${params.toString()}`,
  );

  return payload?.features?.find((feature) => feature.geometry)?.geometry;
}

export async function lookupNYCParcelZoningFacts(input: {
  address?: string;
  borough?: string;
  zipCode?: string;
  bbl?: string;
}): Promise<NYCParcelZoningFacts> {
  const addressFacts = await lookupAddress(input.address, input.borough, input.zipCode);
  const bbl = normalizeBbl(input.bbl) || addressFacts?.bbl;

  if (!bbl) {
    return {};
  }

  const [zoningTaxLot, pluto, parcelGeometry] = await Promise.all([
    lookupZoningTaxLot(bbl),
    lookupPluto(bbl),
    lookupTaxLotPolygon(bbl),
  ]);
  const zoningDistricts = compact([
    zoningTaxLot?.zoning_district_1,
    zoningTaxLot?.zoning_district_2,
    zoningTaxLot?.zoning_district_3,
    zoningTaxLot?.zoning_district_4,
    pluto?.zonedist1,
    pluto?.zonedist2,
    pluto?.zonedist3,
    pluto?.zonedist4,
  ]);
  const uniqueZoningDistricts = [...new Set(zoningDistricts)];
  const commercialOverlays = compact([
    zoningTaxLot?.commercial_overlay_1,
    zoningTaxLot?.commercial_overlay_2,
    pluto?.overlay1,
    pluto?.overlay2,
  ]);
  const uniqueCommercialOverlays = [...new Set(commercialOverlays)];
  const specialDistricts = compact([
    zoningTaxLot?.special_district_1,
    zoningTaxLot?.special_district_2,
    zoningTaxLot?.special_district_3,
    pluto?.spdist1,
    pluto?.spdist2,
    pluto?.spdist3,
  ]);
  const uniqueSpecialDistricts = [...new Set(specialDistricts)];
  const boroughCode = zoningTaxLot?.borough_code ?? bbl.slice(0, 1);
  const borough = input.borough || addressFacts?.borough || boroughNames[pluto?.borough ?? ''] || boroughNames[boroughCode];
  const zoningMap = zoningTaxLot?.zoning_map_number ?? pluto?.zonemap;
  const eDesignation = pluto?.edesig ?? pluto?.edesignum;

  return {
    address: pluto?.address ? `${pluto.address}, ${boroughNames[pluto.borough ?? ''] ?? borough}` : addressFacts?.address,
    zipCode: addressFacts?.zipCode ?? pluto?.zipcode,
    borough,
    boroughCode,
    block: zoningTaxLot?.tax_block ?? pluto?.block ?? String(Number(bbl.slice(1, 6))),
    lot: zoningTaxLot?.tax_lot ?? pluto?.lot ?? String(Number(bbl.slice(6))),
    bbl,
    bin: addressFacts?.bin,
    zoningDistrict: uniqueZoningDistricts.join(' / '),
    zoningDistricts: uniqueZoningDistricts,
    commercialOverlay: uniqueCommercialOverlays.join(' / ') || undefined,
    commercialOverlays: uniqueCommercialOverlays,
    specialDistrict: uniqueSpecialDistricts.join(' / ') || undefined,
    specialDistricts: uniqueSpecialDistricts,
    limitedHeightDistrict: zoningTaxLot?.limited_height_district ?? pluto?.ltdheight,
    zoningMap,
    zoningMapCode: zoningTaxLot?.zoning_map_code ?? pluto?.zmcode,
    ownerName: pluto?.ownername,
    landUse: pluto?.landuse ? landUseLabels[pluto.landuse] ?? pluto.landuse : undefined,
    lotArea: formatSquareFeet(pluto?.lotarea),
    lotFront: formatFeet(pluto?.lotfront),
    lotDepth: formatFeet(pluto?.lotdepth),
    yearBuilt: pluto?.yearbuilt,
    buildingClass: pluto?.bldgclass,
    buildingArea: formatSquareFeet(pluto?.bldgarea),
    numberOfBuildings: pluto?.numbldgs,
    numberOfFloors: formatNumber(pluto?.numfloors, { maximumFractionDigits: 2 }),
    totalUnits: pluto?.unitstotal,
    residentialUnits: pluto?.unitsres,
    residentialFar: formatNumber(pluto?.residfar, { maximumFractionDigits: 2 }),
    commercialFar: formatNumber(pluto?.commfar, { maximumFractionDigits: 2 }),
    facilityFar: formatNumber(pluto?.facilfar, { maximumFractionDigits: 2 }),
    builtFar: formatNumber(pluto?.builtfar, { maximumFractionDigits: 2 }),
    communityDistrict: pluto?.cd,
    councilDistrict: pluto?.council,
    schoolDistrict: pluto?.schooldist,
    policePrecinct: pluto?.policeprct,
    fireCompany: pluto?.firecomp,
    sanitationBorough: pluto?.sanitboro,
    sanitationDistrict: pluto?.sanitdistrict,
    sanitationSubsection: pluto?.sanitsub,
    eDesignation,
    latitude: pluto?.latitude,
    longitude: pluto?.longitude,
    xCoord: pluto?.xcoord,
    yCoord: pluto?.ycoord,
    sourceVersion: pluto?.version,
    parcelGeometry,
    parcelGeometrySource: parcelGeometry ? 'NYC DOF Digital Tax Map TAX_LOT_POLYGON' : undefined,
  };
}
