import { AlertTriangle } from 'lucide-react';
import type { ZoningManualFlag } from '@/lib/zoning/types';

const severityClasses: Record<ZoningManualFlag['severity'], string> = {
  low: 'text-gray-600 dark:text-gray-300',
  medium: 'text-amber-700 dark:text-amber-200',
  high: 'text-red-700 dark:text-red-200',
};

export default function ZoningManualReviewCard({ flag }: { flag: ZoningManualFlag }) {
  return (
    <article className="bg-white px-2 py-1.5 dark:bg-zinc-950">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-red-700 dark:text-red-200">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className={`text-[0.65rem] font-bold uppercase leading-none ${severityClasses[flag.severity]}`}>
            {flag.severity} priority
          </div>
          <h3 className="mt-1 text-xs font-bold text-gray-900 dark:text-white">{flag.title}</h3>
          <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-300">{flag.description}</p>
          {flag.reference ? <div className="mt-1 text-[0.65rem] font-bold text-gray-500 dark:text-gray-400">{flag.reference}</div> : null}
        </div>
      </div>
    </article>
  );
}
