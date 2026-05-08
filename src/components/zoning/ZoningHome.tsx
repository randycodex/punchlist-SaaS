'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { ArrowRight, FileSearch, Plus } from 'lucide-react';
import { createZoningReport, listZoningReports } from '@/lib/saas/api';
import type { ZoningReportSummary } from '@/lib/zoning/types';

type NewReportForm = {
  title: string;
  address: string;
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
    title: 'Zoning Research Worksheet',
    address: addressSeed ?? '',
    borough: 'Bronx',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let isActive = true;

    async function loadReports() {
      try {
        const response = await listZoningReports();
        if (!isActive) return;
        setReports(response.reports);
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
            {addressSeed || projectSeed ? (
              <div className="mt-4 rounded-md border border-black/10 bg-white/70 p-3 text-sm text-gray-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300">
                Started from project context. Only the project ID and address seed are passed into zoning.
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="border-b border-black/5 px-4 py-4 dark:border-white/10">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Zoning Reports</h2>
            </div>
            {loading ? (
              <div className="p-5 text-sm text-gray-500 dark:text-gray-400">Loading reports...</div>
            ) : reports.length === 0 ? (
              <div className="p-5 text-sm text-gray-500 dark:text-gray-400">No zoning reports yet.</div>
            ) : (
              <div className="divide-y divide-black/5 dark:divide-white/10">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/app/zoning/${report.id}`}
                    className="flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">{report.title}</div>
                      <div className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                        {report.address || 'No address'} · {report.zoningDistrict || 'District pending'}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                  </Link>
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
              <input className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-zinc-900 dark:text-white" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="1760 Jerome Ave" />
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
