import { AlertTriangle } from 'lucide-react';
import type { ZoningManualFlag } from '@/lib/zoning/types';

const severityClasses: Record<ZoningManualFlag['severity'], string> = {
  low: 'text-gray-600 dark:text-gray-300',
  medium: 'text-amber-700 dark:text-amber-200',
  high: 'text-red-700 dark:text-red-200',
};

export default function ZoningManualReviewCard({ flag }: { flag: ZoningManualFlag }) {
  return (
    <article className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div>
          <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${severityClasses[flag.severity]}`}>
            {flag.severity} priority
          </div>
          <h3 className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{flag.title}</h3>
          <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">{flag.description}</p>
          {flag.reference ? <div className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">{flag.reference}</div> : null}
        </div>
      </div>
    </article>
  );
}
