import type { ZoningItemStatus } from '@/lib/zoning/types';

const statusLabels: Record<ZoningItemStatus, string> = {
  auto_filled: 'Auto-filled',
  calculated: 'Calculated',
  guidance: 'Guidance',
  manual_review_required: 'Manual review',
};

const statusClasses: Record<ZoningItemStatus, string> = {
  auto_filled: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200',
  calculated: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200',
  guidance: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200',
  manual_review_required: 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200',
};

export function getZoningStatusLabel(status: ZoningItemStatus) {
  return statusLabels[status];
}

export default function ZoningStatusBadge({ status }: { status: ZoningItemStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
