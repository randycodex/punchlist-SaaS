import type { ZoningReportItem } from '@/lib/zoning/types';
import ZoningStatusBadge from '@/components/zoning/ZoningStatusBadge';

export default function ZoningWorksheetRow({ item }: { item: ZoningReportItem }) {
  return (
    <div className="grid gap-3 border-t border-black/5 px-4 py-3 text-sm dark:border-white/10 md:grid-cols-[1.1fr_1.1fr_1fr_9rem_1.2fr] md:items-start">
      <div>
        <div className="md:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Field</div>
        <div className="font-medium text-gray-900 dark:text-white">{item.field}</div>
      </div>
      <div>
        <div className="md:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Value</div>
        <div className="text-gray-700 dark:text-gray-200">{item.value}</div>
      </div>
      <div>
        <div className="md:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Source</div>
        <div className="text-gray-600 dark:text-gray-300">{item.source}</div>
      </div>
      <div>
        <div className="md:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Status</div>
        <ZoningStatusBadge status={item.status} />
      </div>
      <div>
        <div className="md:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Notes</div>
        <div className="text-gray-600 dark:text-gray-300">{item.notes || 'No notes'}</div>
      </div>
    </div>
  );
}
