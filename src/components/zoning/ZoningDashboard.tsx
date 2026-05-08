import Link from 'next/link';
import { ArrowLeft, FileDown, TableProperties } from 'lucide-react';
import { mockZoningWorksheet, workbookReferenceNotes } from '@/lib/zoning/mockZoningData';
import ZoningManualReviewCard from '@/components/zoning/ZoningManualReviewCard';
import ZoningProjectSummary from '@/components/zoning/ZoningProjectSummary';
import ZoningWorksheet from '@/components/zoning/ZoningWorksheet';

export default function ZoningDashboard({ projectId }: { projectId: string }) {
  const worksheet = {
    ...mockZoningWorksheet,
    report: {
      ...mockZoningWorksheet.report,
      projectId,
    },
  };

  return (
    <div className="app-page h-[calc(100dvh-env(safe-area-inset-top)-3.5rem)] overflow-y-auto">
      <header className="header-stable sticky top-0 z-20 border-b">
        <div className="mx-auto flex min-h-[4.9rem] w-full max-w-7xl items-center px-4 py-3 sm:px-5">
          <div className="flex w-full items-center gap-3">
            <Link href={`/app/project/${projectId}`} className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-black/5 bg-white/70 text-gray-600 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="section-eyebrow">Project Module</div>
              <h1 className="mt-1 truncate text-[1.2rem] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                Zoning Research
              </h1>
              <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                Worksheet-driven zoning review for project due diligence
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

          <section className="rounded-lg border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">
                <TableProperties className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Workbook Reference Applied</h2>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  This first pass follows the uploaded workbook hierarchy: primary zoning worksheet, area tabulation, unit distribution, MIH review, and separate base-plane calculation.
                </p>
                <p className="mt-2 text-xs font-semibold text-gray-500 dark:text-gray-400">{workbookReferenceNotes.file}</p>
              </div>
            </div>
          </section>

          <ZoningWorksheet sections={worksheet.sections} />
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
