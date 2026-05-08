'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowLeft, FileDown, TableProperties } from 'lucide-react';
import {
  createZoningReport,
  getZoningReport,
  updateZoningReport,
  updateZoningReportItem,
} from '@/lib/saas/api';
import { workbookReferenceNotes } from '@/lib/zoning/mockZoningData';
import type { ZoningReport, ZoningReportItem, ZoningWorksheet as ZoningWorksheetType } from '@/lib/zoning/types';
import ZoningManualReviewCard from '@/components/zoning/ZoningManualReviewCard';
import ZoningProjectSummary from '@/components/zoning/ZoningProjectSummary';
import ZoningWorksheet from '@/components/zoning/ZoningWorksheet';

type ZoningDashboardProps = {
  reportId?: string;
  projectSeed?: string;
  addressSeed?: string;
};

type ReportDraft = Pick<
  ZoningReport,
  'title' | 'address' | 'borough' | 'block' | 'lot' | 'zoningDistrict'
> & {
  commercialOverlay: string;
  specialDistrict: string;
};

function getReportDraft(report: ZoningReport): ReportDraft {
  return {
    title: report.title,
    address: report.address,
    borough: report.borough,
    block: report.block,
    lot: report.lot,
    zoningDistrict: report.zoningDistrict,
    commercialOverlay: report.commercialOverlay ?? '',
    specialDistrict: report.specialDistrict ?? '',
  };
}

export default function ZoningDashboard({ reportId, projectSeed, addressSeed }: ZoningDashboardProps) {
  const [worksheet, setWorksheet] = useState<ZoningWorksheetType | null>(null);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isActive = true;

    async function loadWorksheet() {
      setError(null);
      try {
        const nextWorksheet = reportId
          ? await getZoningReport(reportId)
          : await createZoningReport({
              projectId: projectSeed,
              address: addressSeed,
            });

        if (!isActive) return;
        setWorksheet(nextWorksheet);
        setDraft(getReportDraft(nextWorksheet.report));
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load zoning report.');
      }
    }

    void loadWorksheet();

    return () => {
      isActive = false;
    };
  }, [addressSeed, projectSeed, reportId]);

  function updateDraft<K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function saveReport() {
    if (!worksheet || !draft) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const report = await updateZoningReport(worksheet.report.id, draft);
        setWorksheet((current) => (current ? { ...current, report } : current));
        setMessage('Report saved');
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to save report.');
      }
    });
  }

  async function saveItem(item: ZoningReportItem) {
    if (!worksheet) return;

    const savedItem = await updateZoningReportItem(worksheet.report.id, item.id, {
      value: item.value,
      source: item.source,
      status: item.status,
      notes: item.notes,
    });

    setWorksheet((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => ({
          ...section,
          items: section.items.map((sectionItem) => (sectionItem.id === savedItem.id ? savedItem : sectionItem)),
        })),
      };
    });
  }

  if (error && !worksheet) {
    return (
      <div className="app-page flex h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] items-center justify-center px-4">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!worksheet || !draft) {
    return (
      <div className="app-page flex h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-black/10 border-t-[var(--accent)] dark:border-white/10 dark:border-t-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="app-page h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] overflow-y-auto">
      <header className="header-stable sticky top-0 z-20 border-b">
        <div className="mx-auto flex min-h-[4.9rem] w-full max-w-7xl items-center px-4 py-3 sm:px-5">
          <div className="flex w-full items-center gap-3">
            <Link href="/app/zoning" className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-black/5 bg-white/70 text-gray-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="section-eyebrow">Zoning Module</div>
              <h1 className="mt-1 truncate text-[1.2rem] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                Zoning Research
              </h1>
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                Separate zoning workspace with optional address-level project context
              </p>
            </div>
            <button
              className="hidden items-center gap-2 rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-gray-700 opacity-60 dark:border-white/10 dark:text-gray-200 sm:flex"
              disabled
            >
              <FileDown className="h-4 w-4" />
              Export later
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+3rem)] sm:px-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          <ZoningProjectSummary worksheet={worksheet} />

          <details className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                    Report settings
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">Edit report metadata</div>
                </div>
                <div className="text-sm font-semibold text-[var(--accent)]">Open</div>
              </div>
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Report title
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Address
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Borough
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.borough} onChange={(event) => updateDraft('borough', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Block / Lot
                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.block} onChange={(event) => updateDraft('block', event.target.value)} />
                  <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.lot} onChange={(event) => updateDraft('lot', event.target.value)} />
                </div>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Zoning district
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.zoningDistrict} onChange={(event) => updateDraft('zoningDistrict', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Commercial overlay
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.commercialOverlay} onChange={(event) => updateDraft('commercialOverlay', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
                Special district
                <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={draft.specialDistrict} onChange={(event) => updateDraft('specialDistrict', event.target.value)} />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={saveReport}
                disabled={isPending}
                className="rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
              >
                {isPending ? 'Saving' : 'Save report'}
              </button>
              {message ? <span className="text-sm text-gray-500 dark:text-gray-400">{message}</span> : null}
              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          </details>

          <section className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">
                <TableProperties className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Workbook Reference Applied</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  This worksheet is seeded from the uploaded zoning workbook structure, but saved as a separate zoning report in Neon.
                </p>
                <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{workbookReferenceNotes.file}</p>
              </div>
            </div>
          </section>

          <ZoningWorksheet sections={worksheet.sections} editable onSaveItem={saveItem} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-[6rem] lg:self-start">
          <section className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Worksheet Index</h2>
            <div className="mt-3 space-y-1">
              {worksheet.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.key}`}
                  className="block rounded-md px-2 py-2 text-sm text-gray-600 transition hover:bg-black/[0.04] hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  {section.title}
                </a>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Manual Review Queue</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">
                Items that should remain judgment-led until source documents, drawings, or consultant input are confirmed.
              </p>
            </div>
            {worksheet.manualFlags.map((flag) => (
              <ZoningManualReviewCard key={flag.id} flag={flag} />
            ))}
          </section>
        </aside>
      </main>
    </div>
  );
}
