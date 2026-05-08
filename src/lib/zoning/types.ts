export type ZoningItemStatus = 'auto_filled' | 'calculated' | 'guidance' | 'manual_review_required';

export type ZoningSectionKey =
  | 'lot_identity'
  | 'districts_overlays'
  | 'floor_area'
  | 'use_regulations'
  | 'yard_requirements'
  | 'height_setback'
  | 'parking'
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
  zoningDistrict: string;
  commercialOverlay?: string;
  specialDistrict?: string;
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
  | 'zoningDistrict'
  | 'commercialOverlay'
  | 'specialDistrict'
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
