export type ZoningItemStatus = 'auto_filled' | 'calculated' | 'guidance' | 'manual_review_required';

export type ZoningComplianceResult =
  | 'complies'
  | 'does_not_comply'
  | 'incomplete'
  | 'manual_review_required';

export type ZoningEvaluationMode = 'lookup_only' | 'manual_input' | 'formula_check' | 'manual_review';

export type ZoningParcelGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

export type ZoningOpenDataValue = string | string[] | ZoningParcelGeometry | undefined;

export type ZoningSectionKey =
  | 'lot_identity'
  | 'districts_overlays'
  | 'zoning_information'
  | 'floor_area'
  | 'far'
  | 'lot_coverage'
  | 'lot_area_du'
  | 'use_regulations'
  | 'yard_requirements'
  | 'height_setback'
  | 'parking'
  | 'street_trees'
  | 'quality_housing'
  | 'special_district'
  | 'legal_references'
  | 'export_summary';

export interface ZoningReport {
  id: string;
  organizationId?: string;
  projectId?: string;
  title: string;
  address: string;
  borough: string;
  block: string;
  lot: string;
  bbl?: string;
  zipCode?: string;
  zoningDistrict: string;
  commercialOverlay?: string;
  specialDistrict?: string;
  zoningMap?: string;
  openData?: Record<string, ZoningOpenDataValue>;
  createdAt: Date;
  updatedAt: Date;
}

export type ZoningReportSummary = Pick<
  ZoningReport,
  | 'id'
  | 'organizationId'
  | 'projectId'
  | 'title'
  | 'address'
  | 'borough'
  | 'block'
  | 'lot'
  | 'bbl'
  | 'zipCode'
  | 'zoningDistrict'
  | 'commercialOverlay'
  | 'specialDistrict'
  | 'zoningMap'
  | 'openData'
  | 'createdAt'
  | 'updatedAt'
>;

export interface ZoningReportSection {
  id: string;
  reportId: string;
  key: ZoningSectionKey;
  title: string;
  description?: string;
  sortOrder: number;
  items: ZoningReportItem[];
}

export interface ZoningReportItem {
  id: string;
  reportId: string;
  section: ZoningSectionKey;
  field: string;
  value: string;
  zrSection?: string;
  itemDescription?: string;
  permittedRequired?: string;
  proposed?: string;
  result?: ZoningComplianceResult;
  evaluationMode?: ZoningEvaluationMode;
  source: string;
  status: ZoningItemStatus;
  notes?: string;
  createdAt: Date;
}

export interface ZoningManualFlag {
  id: string;
  reportId: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  reference?: string;
}

export interface ZoningReference {
  id: string;
  reportId: string;
  label: string;
  source: string;
  url?: string;
  notes?: string;
}

export interface ZoningWorksheet {
  report: ZoningReport;
  sections: ZoningReportSection[];
  manualFlags: ZoningManualFlag[];
  references: ZoningReference[];
}
