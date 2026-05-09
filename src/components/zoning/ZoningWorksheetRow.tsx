import { useState, useTransition } from 'react';
import type { ZoningReportItem } from '@/lib/zoning/types';

const resultOptions: Array<{ value: NonNullable<ZoningReportItem['result']>; label: string }> = [
  { value: 'complies', label: 'Complies' },
  { value: 'does_not_comply', label: 'Does not comply' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'manual_review_required', label: 'Manual review' },
];

const resultStyles: Record<NonNullable<ZoningReportItem['result']>, string> = {
  complies: 'text-black dark:text-white',
  does_not_comply: 'text-red-700 dark:text-red-300',
  incomplete: 'text-zinc-500 dark:text-zinc-400',
  manual_review_required: 'text-sky-700 dark:text-sky-300',
};

function getResultLabel(result?: ZoningReportItem['result']) {
  return resultOptions.find((option) => option.value === result)?.label ?? 'Incomplete';
}

function getFirstNumber(value?: string) {
  const match = value?.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function evaluateDraft(item: ZoningReportItem): ZoningReportItem['result'] {
  if (item.evaluationMode === 'manual_review' || item.status === 'manual_review_required') {
    return 'manual_review_required';
  }

  if (!item.proposed?.trim()) {
    return 'incomplete';
  }

  if (item.evaluationMode !== 'formula_check') {
    return item.result ?? 'manual_review_required';
  }

  const permittedValue = getFirstNumber(item.permittedRequired ?? item.value);
  const proposedValue = getFirstNumber(item.proposed);

  if (permittedValue === null || proposedValue === null) {
    return 'manual_review_required';
  }

  const requiredText = `${item.itemDescription ?? item.field} ${item.permittedRequired ?? item.value}`.toLowerCase();
  const isMinimum = requiredText.includes('minimum') || requiredText.includes('min ');

  return isMinimum
    ? proposedValue >= permittedValue
      ? 'complies'
      : 'does_not_comply'
    : proposedValue <= permittedValue
      ? 'complies'
      : 'does_not_comply';
}

function getRowFillTone(item: ZoningReportItem) {
  const permittedRequired = (item.permittedRequired ?? item.value ?? '').trim();
  const proposed = (item.proposed ?? '').trim();

  if (item.status === 'auto_filled' && permittedRequired) {
    return {
      row: 'bg-emerald-50/60 dark:bg-emerald-950/20',
      proposed: 'bg-emerald-100/60 dark:bg-emerald-900/30',
    };
  }

  if (!permittedRequired) {
    return {
      row: 'bg-red-50/70 dark:bg-red-950/20',
      proposed: 'bg-red-100/60 dark:bg-red-900/25',
    };
  }

  if (item.status === 'manual_review_required' || item.evaluationMode === 'manual_review' || !proposed) {
    return {
      row: 'bg-sky-50/60 dark:bg-sky-950/20',
      proposed: 'bg-sky-100/60 dark:bg-sky-900/30',
    };
  }

  return {
    row: '',
    proposed: 'bg-zinc-50 dark:bg-zinc-900/50',
  };
}

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
  const denseTextareaClass =
    'block min-h-8 w-full resize-y border-0 bg-transparent px-1.5 py-1 text-[0.82rem] leading-5 text-zinc-950 outline-none focus:bg-amber-50 dark:text-zinc-50 dark:focus:bg-zinc-800';
  const denseInputClass =
    'block h-8 w-full border-0 bg-transparent px-1.5 py-1 text-[0.82rem] leading-5 text-zinc-950 outline-none focus:bg-amber-50 dark:text-zinc-50 dark:focus:bg-zinc-800';
  const denseSelectClass =
    'block h-8 w-full border-0 bg-transparent px-1 py-1 text-[0.76rem] font-semibold text-zinc-950 outline-none focus:bg-amber-50 dark:text-zinc-50 dark:focus:bg-zinc-800';
  const tones = getRowFillTone(draft);

  function saveItem() {
    if (!onSave) return;
    setMessage(null);
    startTransition(async () => {
      try {
        const evaluatedDraft = { ...draft, result: evaluateDraft(draft) };
        setDraft(evaluatedDraft);
        await onSave(evaluatedDraft);
        setMessage('Saved');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Save failed');
      }
    });
  }

  if (editable) {
    return (
      <div className={`grid border-b border-zinc-300 text-sm dark:border-zinc-700 xl:grid-cols-[8.5rem_1.35fr_1.45fr_1.15fr_8.25rem_1fr_3.75rem] xl:items-stretch ${tones.row}`}>
        <div className="border-r border-zinc-300 dark:border-zinc-700">
          <div className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">ZR Sec.</div>
          <input
            value={draft.zrSection ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, zrSection: event.target.value }))}
            className={denseInputClass}
            placeholder="141-22"
          />
        </div>
        <label className="border-r border-zinc-300 dark:border-zinc-700">
          <span className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Item / Description</span>
          <textarea
            value={draft.itemDescription ?? draft.field}
            onChange={(event) => setDraft((current) => ({ ...current, itemDescription: event.target.value, field: event.target.value }))}
            className={denseTextareaClass}
          />
        </label>
        <label className="border-r border-zinc-300 dark:border-zinc-700">
          <span className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Permitted / Required</span>
          <textarea
            value={draft.permittedRequired ?? draft.value}
            onChange={(event) => setDraft((current) => ({ ...current, permittedRequired: event.target.value, value: event.target.value }))}
            className={denseTextareaClass}
          />
        </label>
        <label className="border-r border-zinc-300 dark:border-zinc-700">
          <span className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Proposed</span>
          <textarea
            value={draft.proposed ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, proposed: event.target.value }))}
            className={`${denseTextareaClass} ${tones.proposed}`}
          />
        </label>
        <div className="border-r border-zinc-300 dark:border-zinc-700">
          <label className="block">
            <span className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Result</span>
            <select
              value={draft.result ?? 'incomplete'}
              onChange={(event) => setDraft((current) => ({ ...current, result: event.target.value as ZoningReportItem['result'] }))}
              className={denseSelectClass}
            >
              {resultOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="border-r border-zinc-300 dark:border-zinc-700">
          <span className="px-1.5 pt-1 text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Notes</span>
          <textarea
            value={draft.notes ?? ''}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            className={denseTextareaClass}
          />
        </label>
        <div className="flex items-start gap-1 px-1 py-1 xl:block">
          <button
            type="button"
            onClick={saveItem}
            disabled={isPending}
            className="h-7 w-full border border-black bg-white text-[0.72rem] font-bold uppercase text-black disabled:opacity-50 dark:border-white dark:bg-zinc-950 dark:text-white"
          >
            {isPending ? 'Saving' : 'Save'}
          </button>
          {message ? <div className="mt-1 text-[0.65rem] text-zinc-500 dark:text-zinc-400">{message}</div> : null}
        </div>
      </div>
    );
  }

  const readonlyTones = getRowFillTone(item);

  return (
    <div className={`grid border-b border-zinc-300 text-[0.82rem] leading-5 dark:border-zinc-700 xl:grid-cols-[8.5rem_1.35fr_1.45fr_1.15fr_8.25rem_1fr] xl:items-stretch ${readonlyTones.row}`}>
      <div className="border-r border-zinc-300 px-1.5 py-1 dark:border-zinc-700">
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">ZR Sec.</div>
        <div className="font-medium text-black dark:text-white">{item.zrSection || '-'}</div>
      </div>
      <div className="border-r border-zinc-300 px-1.5 py-1 dark:border-zinc-700">
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Item / Description</div>
        <div className="text-black dark:text-zinc-100">{item.itemDescription || item.field}</div>
      </div>
      <div className="border-r border-zinc-300 px-1.5 py-1 dark:border-zinc-700">
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Permitted / Required</div>
        <div className="whitespace-pre-wrap text-black dark:text-zinc-100">{item.permittedRequired || item.value}</div>
      </div>
      <div className={`border-r border-zinc-300 px-1.5 py-1 dark:border-zinc-700 ${readonlyTones.proposed}`}>
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Proposed</div>
        <div className="whitespace-pre-wrap text-black dark:text-zinc-100">{item.proposed || ''}</div>
      </div>
      <div className="border-r border-zinc-300 px-1.5 py-1 text-right dark:border-zinc-700">
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Result</div>
        <div className={`text-[0.82rem] font-bold uppercase ${resultStyles[item.result ?? 'incomplete']}`}>
          {item.result === 'does_not_comply' ? 'Does not comply' : getResultLabel(item.result)}
        </div>
      </div>
      <div className="px-1.5 py-1">
        <div className="text-[0.65rem] font-bold uppercase text-zinc-500 xl:hidden">Notes</div>
        <div className="text-zinc-700 dark:text-zinc-300">{item.notes || ''}</div>
      </div>
    </div>
  );
}
