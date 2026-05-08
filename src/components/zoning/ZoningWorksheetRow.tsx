import { useState, useTransition } from 'react';
import type { ZoningReportItem } from '@/lib/zoning/types';
import ZoningStatusBadge from '@/components/zoning/ZoningStatusBadge';

const statusOptions: Array<{ value: ZoningReportItem['status']; label: string }> = [
  { value: 'auto_filled', label: 'Auto-filled' },
  { value: 'calculated', label: 'Calculated' },
  { value: 'guidance', label: 'Guidance' },
  { value: 'manual_review_required', label: 'Manual review' },
];

export default function ZoningWorksheetRow({
  item,
  editable = false,
  onSave,
}: {
  item: ZoningReportItem;
  editable?: boolean;
  onSave?: (item: ZoningReportItem) => Promise<void>;
}) {
  const [draft, setDraft] = useState(item);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveItem() {
    if (!onSave) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await onSave(draft);
        setMessage('Saved');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Save failed');
      }
    });
  }

  if (editable) {
    return (
      <div className="grid gap-3 border-t border-black/5 px-4 py-3 text-sm dark:border-white/10 lg:grid-cols-[1fr_1.1fr_1fr_10rem_1.1fr_5.5rem] lg:items-start">
        <div>
          <div className="lg:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Field</div>
          <div className="font-medium text-gray-900 dark:text-white">{draft.field}</div>
        </div>
        <label className="space-y-1">
          <span className="lg:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Value</span>
          <textarea
            value={draft.value}
            onChange={(event) => setDraft((current) => ({ ...current, value: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="lg:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Source</span>
          <textarea
            value={draft.source}
            onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <label className="space-y-1">
          <span className="lg:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Status</span>
          <select
            value={draft.status}
            onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ZoningReportItem['status'] }))}
            className="w-full rounded-md border border-black/10 bg-white px-2 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="lg:hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400">Notes</span>
          <textarea
            value={draft.notes ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            className="min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
          />
        </label>
        <div className="flex items-center gap-2 lg:block">
          <button
            type="button"
            onClick={saveItem}
            disabled={isPending}
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            {isPending ? 'Saving' : 'Save'}
          </button>
          {message ? <div className="mt-0 text-xs text-gray-500 dark:text-gray-400 lg:mt-2">{message}</div> : null}
        </div>
      </div>
    );
  }

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
