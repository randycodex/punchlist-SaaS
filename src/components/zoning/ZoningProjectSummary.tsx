import type { ZoningWorksheet } from '@/lib/zoning/types';

function InfoRow({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="grid min-h-7 grid-cols-[13.5rem_minmax(0,1fr)_minmax(12rem,0.55fr)] border-b border-zinc-300 text-[0.9rem] leading-6 dark:border-zinc-700 max-lg:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="border-r border-zinc-300 bg-zinc-50 px-1.5 font-bold text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
        {label}
      </div>
      <div className="border-r border-zinc-300 px-1.5 text-black dark:border-zinc-700 dark:text-zinc-100">{value}</div>
      <div className="px-1.5 text-black dark:text-zinc-100 max-lg:hidden">{secondary ?? ''}</div>
    </div>
  );
}

export default function ZoningProjectSummary({ worksheet }: { worksheet: ZoningWorksheet }) {
  const report = worksheet.report;
  const openData = report.openData ?? {};
  const districtLabel = [report.zoningDistrict, report.commercialOverlay].filter(Boolean).join(' / ') || 'TBD';
  const specialDistrict = report.specialDistrict ? ` / Special District ${report.specialDistrict}` : '';
  const addressLabel = [report.address || 'Address pending', report.borough, report.zipCode].filter(Boolean).join(', ');
  const lotArea = typeof openData.lotArea === 'string' ? openData.lotArea : 'Pending parcel lookup or architect input';
  const lotFront = typeof openData.lotFront === 'string' ? openData.lotFront : '';
  const lotDepth = typeof openData.lotDepth === 'string' ? openData.lotDepth : '';
  const communityDistrict = typeof openData.communityDistrict === 'string' ? openData.communityDistrict : '';
  const councilDistrict = typeof openData.councilDistrict === 'string' ? openData.councilDistrict : '';
  const landUse = typeof openData.landUse === 'string' ? openData.landUse : '';
  const buildingClass = typeof openData.buildingClass === 'string' ? openData.buildingClass : '';
  const buildingArea = typeof openData.buildingArea === 'string' ? openData.buildingArea : '';
  const yearBuilt = typeof openData.yearBuilt === 'string' ? openData.yearBuilt : '';
  const units = typeof openData.totalUnits === 'string' ? openData.totalUnits : '';

  return (
    <section className="border-x border-t border-zinc-300 bg-white text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="border-b-2 border-black bg-zinc-300 px-1.5 py-0.5 text-center text-sm font-bold uppercase text-black dark:border-zinc-200 dark:bg-zinc-700 dark:text-white">
        Zoning Information
      </div>
      <InfoRow
        label="Applicable Resolution:"
        value="Zoning Resolution of The City of New York City Planning Commission Department of City Planning numbers below refer to this document."
      />
      <InfoRow label="Tax Lot | BBL:" value={report.bbl || 'Pending address lookup'} />
      <InfoRow label="Address:" value={addressLabel} />
      <InfoRow label="Block:" value={report.block || 'TBD'} />
      <InfoRow
        label="Lot(s):"
        value={report.lot || 'TBD'}
        secondary={report.lot ? `Existing tax lots ${report.lot} should be confirmed against the zoning lot record.` : ''}
      />
      <InfoRow label="Zoning District:" value={`${districtLabel}${specialDistrict}`} />
      <InfoRow label="Zoning Map:" value={report.zoningMap || 'TBD'} />
      <InfoRow label="Land Use:" value={landUse || 'TBD'} secondary={buildingClass ? `Building class: ${buildingClass}` : ''} />
      <InfoRow label="Lot Area:" value={lotArea} secondary={[lotFront ? `Frontage: ${lotFront}` : '', lotDepth ? `Depth: ${lotDepth}` : ''].filter(Boolean).join(' | ')} />
      <InfoRow label="Building Area:" value={buildingArea || 'TBD'} secondary={[yearBuilt ? `Year built: ${yearBuilt}` : '', units ? `Units: ${units}` : ''].filter(Boolean).join(' | ')} />
      <InfoRow label="Neighborhood:" value={communityDistrict ? `Community District ${communityDistrict}` : 'TBD'} secondary={councilDistrict ? `Council District ${councilDistrict}` : ''} />
      <InfoRow label="Housing Designation:" value="Manual review required" />
      <InfoRow
        label="Transit Designation:"
        value={communityDistrict ? `Check Community District ${communityDistrict} against ZR Appendix I.` : 'Manual review required'}
      />
    </section>
  );
}
