'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowLeft, FileDown } from 'lucide-react';
import {
  createZoningReport,
  getZoningReport,
  updateZoningReport,
  updateZoningReportItem,
} from '@/lib/saas/api';
import { workbookReferenceNotes } from '@/lib/zoning/mockZoningData';
import type { ZoningReport, ZoningReportItem, ZoningWorksheet as ZoningWorksheetType } from '@/lib/zoning/types';
import ZoningManualReviewCard from '@/components/zoning/ZoningManualReviewCard';
import ZoningParcelMap from '@/components/zoning/ZoningParcelMap';
import ZoningProjectSummary from '@/components/zoning/ZoningProjectSummary';
import ZoningWorksheet from '@/components/zoning/ZoningWorksheet';

type ZoningDashboardProps = {
  reportId?: string;
  projectSeed?: string;
  addressSeed?: string;
};

type ReportDraft = Pick<
  ZoningReport,
  'title' | 'address' | 'borough' | 'block' | 'lot' | 'bbl' | 'zipCode' | 'zoningDistrict' | 'zoningMap'
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
    bbl: report.bbl ?? '',
    zipCode: report.zipCode ?? '',
    zoningDistrict: report.zoningDistrict,
    zoningMap: report.zoningMap ?? '',
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
      zrSection: item.zrSection,
      itemDescription: item.itemDescription,
      permittedRequired: item.permittedRequired,
      proposed: item.proposed,
      result: item.result,
      evaluationMode: item.evaluationMode,
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
        <div className="mx-auto flex min-h-12 w-full max-w-[96rem] items-center px-2 py-1.5 sm:px-3">
          <div className="flex w-full items-center gap-3">
            <Link href="/app/zoning" className="flex h-8 w-8 items-center justify-center border border-black/10 bg-white/70 text-gray-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-gray-900 dark:text-white">
                Zoning Research
              </h1>
            </div>
            <button
              className="hidden h-8 items-center gap-2 border border-black/10 px-2 text-xs font-semibold text-gray-700 opacity-60 dark:border-white/10 dark:text-gray-200 sm:flex"
              disabled
            >
              <FileDown className="h-4 w-4" />
              Export later
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[96rem] px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-3">
        <div className="min-w-0 space-y-2">
          <ZoningProjectSummary worksheet={worksheet} />
          <ZoningParcelMap worksheet={worksheet} />

          <details className="border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3 bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-900">
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Report Settings</div>
                </div>
                <div className="text-xs font-semibold text-[var(--accent)]">Open</div>
              </div>
            </summary>
            <div className="grid gap-2 p-2 md:grid-cols-4">
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Report title
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Address
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Borough
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.borough} onChange={(event) => updateDraft('borough', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Zip code
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.zipCode} onChange={(event) => updateDraft('zipCode', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Block / Lot
                <div className="grid grid-cols-2 gap-2">
                  <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.block} onChange={(event) => updateDraft('block', event.target.value)} />
                  <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.lot} onChange={(event) => updateDraft('lot', event.target.value)} />
                </div>
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                BBL
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.bbl} onChange={(event) => updateDraft('bbl', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Zoning district
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.zoningDistrict} onChange={(event) => updateDraft('zoningDistrict', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Commercial overlay
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.commercialOverlay} onChange={(event) => updateDraft('commercialOverlay', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
                Zoning map
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.zoningMap} onChange={(event) => updateDraft('zoningMap', event.target.value)} />
              </label>
              <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200 md:col-span-2">
                Special district
                <input className="w-full border border-zinc-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white" value={draft.specialDistrict} onChange={(event) => updateDraft('specialDistrict', event.target.value)} />
              </label>
            </div>
            <div className="flex items-center gap-3 border-t border-zinc-300 p-2 dark:border-zinc-700">
              <button
                type="button"
                onClick={saveReport}
                disabled={isPending}
                className="border border-black bg-white px-3 py-1 text-xs font-bold uppercase text-black disabled:opacity-50 dark:border-white dark:bg-zinc-950 dark:text-white"
              >
                {isPending ? 'Saving' : 'Save report'}
              </button>
              {message ? <span className="text-sm text-gray-500 dark:text-gray-400">{message}</span> : null}
              {error ? <span className="text-sm text-red-600">{error}</span> : null}
            </div>
          </details>

          <section className="border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-zinc-950 dark:text-white">Workbook Reference Applied</span>
              <span>{workbookReferenceNotes.file}</span>
            </div>
          </section>

          <ZoningWorksheet sections={worksheet.sections} editable onSaveItem={saveItem} />

          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.45fr)]">
            <section className="border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              <h2 className="border-b border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-bold text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">Worksheet Index</h2>
              <div className="grid grid-cols-2 gap-px p-1 sm:grid-cols-3 lg:grid-cols-4">
              {worksheet.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.key}`}
                    className="block bg-zinc-50 px-2 py-1 text-xs font-semibold text-gray-600 transition hover:bg-zinc-100 hover:text-gray-900 dark:bg-zinc-900 dark:text-gray-300 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  {section.title}
                </a>
              ))}
              </div>
            </section>

            <section className="border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950">
              <h2 className="border-b border-zinc-300 bg-zinc-100 px-2 py-1 text-sm font-bold text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">Manual Review Queue</h2>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {worksheet.manualFlags.map((flag) => (
                  <ZoningManualReviewCard key={flag.id} flag={flag} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
