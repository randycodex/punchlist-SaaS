'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowRight, FileSearch, Plus, Trash2 } from 'lucide-react';
import { createZoningReport, deleteZoningReport, listZoningReports } from '@/lib/saas/api';
import type { ZoningReportSummary } from '@/lib/zoning/types';

type NewReportForm = {
  title: string;
  address: string;
  zipCode: string;
  borough: string;
};

export default function ZoningHome({
  projectSeed,
  addressSeed,
}: {
  projectSeed?: string;
  addressSeed?: string;
}) {
  const [reports, setReports] = useState<ZoningReportSummary[]>([]);
  const [form, setForm] = useState<NewReportForm>({
    title: '',
    address: '',
    zipCode: '',
    borough: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isActive = true;

    async function loadReports() {
      try {
        const response = await listZoningReports();
        if (!isActive) return;
        setReports(response.reports);
        setSelectedReportIds((current) => current.filter((id) => response.reports.some((report) => report.id === id)));
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load zoning reports.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadReports();

    return () => {
      isActive = false;
    };
  }, []);

  function createReport() {
    setError(null);
    startTransition(async () => {
      try {
        const worksheet = await createZoningReport({ ...form, projectId: projectSeed });
        window.location.href = `/app/zoning/${worksheet.report.id}`;
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Unable to create zoning report.');
      }
    });
  }

  function removeReport(reportId: string, reportTitle: string) {
    const confirmed = window.confirm(`Delete zoning report "${reportTitle}"?`);
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const previous = reports;
      const previousSelection = selectedReportIds;
      setReports((current) => current.filter((report) => report.id !== reportId));
      setSelectedReportIds((current) => current.filter((id) => id !== reportId));
      try {
        await deleteZoningReport(reportId);
      } catch (deleteError) {
        setReports(previous);
        setSelectedReportIds(previousSelection);
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete zoning report.');
      }
    });
  }

  function toggleReportSelection(reportId: string) {
    setSelectedReportIds((current) =>
      current.includes(reportId) ? current.filter((id) => id !== reportId) : [...current, reportId]
    );
  }

  function toggleSelectAll() {
    if (selectedReportIds.length === reports.length) {
      setSelectedReportIds([]);
      return;
    }
    setSelectedReportIds(reports.map((report) => report.id));
  }

  function removeSelectedReports() {
    if (selectedReportIds.length === 0) return;
    const confirmed = window.confirm(`Delete ${selectedReportIds.length} selected zoning report(s)?`);
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const selectedSet = new Set(selectedReportIds);
      const previous = reports;
      const previousSelection = selectedReportIds;
      setReports((current) => current.filter((report) => !selectedSet.has(report.id)));
      setSelectedReportIds([]);
      try {
        await Promise.all(previousSelection.map((reportId) => deleteZoningReport(reportId)));
      } catch (deleteError) {
        setReports(previous);
        setSelectedReportIds(previousSelection);
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete selected zoning reports.');
      }
    });
  }

  return (
    <div className="app-page h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] overflow-y-auto">
      <main className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-5">
          <div>
            <div className="section-eyebrow">Architecture Module</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">Zoning Research</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              Separate zoning workspace for worksheet-driven due diligence. Project address can be reused, but punchlist data stays separate.
            </p>
            {projectSeed ? (
              <div className="mt-4 rounded-md border border-black/10 bg-white/70 p-3 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                Started from project context. No form values are prefilled.
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-4 dark:border-white/10">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Zoning Reports</h2>
              {reports.length > 0 ? (
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={selectedReportIds.length > 0 && selectedReportIds.length === reports.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-black/20"
                      aria-label="Select all reports"
                    />
                    Select all
                  </label>
                  <button
                    type="button"
                    onClick={removeSelectedReports}
                    disabled={isPending || selectedReportIds.length === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete selected
                  </button>
                </div>
              ) : null}
            </div>
            {loading ? (
              <div className="p-5 text-sm text-gray-500 dark:text-gray-400">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="p-5 text-sm text-gray-500 dark:text-gray-400">No zoning reports yet.</div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <div className="shrink-0">
                      <input
                        type="checkbox"
                        checked={selectedReportIds.includes(report.id)}
                        onChange={() => toggleReportSelection(report.id)}
                        className="h-4 w-4 rounded border-black/20"
                        aria-label={`Select ${report.title}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/app/zoning/${report.id}`} className="block min-w-0">
                        <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{report.title}</div>
                        <div className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                          {report.address || 'No address'} · {report.zoningDistrict || 'District pending'}
                        </div>
                      </Link>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={`/app/zoning/${report.id}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-black/10 text-gray-500 transition hover:bg-black/[0.04] hover:text-gray-900 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/[0.06] dark:hover:text-white"
                        aria-label={`Open ${report.title}`}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => removeReport(report.id, report.title)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                        aria-label={`Delete ${report.title}`}
                        title="Delete report"
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04] lg:self-start">
          <div className="flex items-center gap-2">
            <FileSearch className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">New zoning report</h2>
          </div>
          <div className="mt-4 space-y-3">
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Title
              <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Address
              <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Zip Code
              <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={form.zipCode} onChange={(event) => setForm((current) => ({ ...current, zipCode: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm font-medium text-gray-700 dark:text-gray-200">
              Borough
              <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={form.borough} onChange={(event) => setForm((current) => ({ ...current, borough: event.target.value }))} />
            </label>
          </div>
          {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          <button
            type="button"
            onClick={createReport}
            disabled={isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-gray-900"
          >
            <Plus className="h-4 w-4" />
            {isPending ? 'Creating' : 'Create report'}
          </button>
        </aside>
      </main>
    </div>
  );
}
