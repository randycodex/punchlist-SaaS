import { AlertTriangle, Building2, Calculator, FileText } from 'lucide-react';
import type { ZoningWorksheet } from '@/lib/zoning/types';
import { getZoningStatusLabel } from '@/components/zoning/ZoningStatusBadge';

export default function ZoningProjectSummary({ worksheet }: { worksheet: ZoningWorksheet }) {
  const items = worksheet.sections.flatMap((section) => section.items);
  const counts = items.reduce(
    (totals, item) => {
      totals[item.status] += 1;
      return totals;
    },
    {
      auto_filled: 0,
      calculated: 0,
      guidance: 0,
      manual_review_required: 0,
    }
  );

  return (
    <section className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <div className="section-eyebrow">Zoning Research</div>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{worksheet.report.title}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Building2 className="h-4 w-4 text-gray-500" />
                {worksheet.report.address}
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                Block {worksheet.report.block} / Lot {worksheet.report.lot}
              </div>
            </div>
            <div className="rounded-md border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <FileText className="h-4 w-4 text-gray-500" />
                {worksheet.report.zoningDistrict}
                {worksheet.report.commercialOverlay ? ` / ${worksheet.report.commercialOverlay}` : ''}
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {worksheet.report.specialDistrict || 'No special district recorded'}
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className="rounded-md border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
                {status === 'manual_review_required' ? <AlertTriangle className="h-3.5 w-3.5" /> : <Calculator className="h-3.5 w-3.5" />}
                {getZoningStatusLabel(status as keyof typeof counts)}
              </div>
              <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{count}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
