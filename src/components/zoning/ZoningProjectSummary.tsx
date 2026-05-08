import { ExternalLink, Layers3, Map, BookOpen, History, FileText, Landmark, Building2, Info, ShieldAlert, TrainFront, Wind, Link as LinkIcon } from 'lucide-react';
import type { ZoningWorksheet } from '@/lib/zoning/types';

export default function ZoningProjectSummary({ worksheet }: { worksheet: ZoningWorksheet }) {
  const report = worksheet.report;
  const hasBlockLot = Boolean(report.block.trim() || report.lot.trim());
  const bblHint = hasBlockLot ? `Block ${report.block || 'TBD'} | Lot ${report.lot || 'TBD'}` : 'BBL pending';
  const districtLabel = [report.zoningDistrict, report.commercialOverlay].filter(Boolean).join(' / ') || 'Zoning district pending';

  return (
    <section className="rounded-lg border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="border-b border-black/5 px-4 py-4 dark:border-white/10">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          Tax lot | {bblHint}
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
          {report.address || 'Address pending'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <span>{report.borough || 'Borough pending'}</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <span>{hasBlockLot ? `Block ${report.block || 'TBD'} | Lot ${report.lot || 'TBD'}` : 'Block/Lot pending'}</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm font-semibold text-gray-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-100">
            Zoning District:
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft-strong)] px-2.5 py-1 text-sm font-semibold text-[color:var(--accent)]">
              {districtLabel}
              <ExternalLink className="h-3.5 w-3.5" />
            </span>
          </span>
          {report.specialDistrict ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-sm font-semibold text-gray-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-200">
              <Landmark className="h-4 w-4 text-gray-500" />
              {report.specialDistrict}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-[13px] text-gray-600 dark:text-gray-300">
          <span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-4 w-4 text-[var(--accent)]" /> E-designation</span>
          <span className="inline-flex items-center gap-1.5"><TrainFront className="h-4 w-4 text-[var(--accent)]" /> Transit zone</span>
          <span className="inline-flex items-center gap-1.5"><Wind className="h-4 w-4 text-[var(--accent)]" /> MIH / housing</span>
          <span className="inline-flex items-center gap-1.5"><Layers3 className="h-4 w-4 text-[var(--accent)]" /> Map layers</span>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Intersecting map layers
          </div>
          <div className="space-y-2">
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              <ExternalLink className="h-4 w-4" />
              Fresh Zone (placeholder)
            </a>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              <ExternalLink className="h-4 w-4" />
              Appendix I (placeholder)
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
            Zoning details
          </div>
          <div className="space-y-2">
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              <Map className="h-4 w-4" />
              Digital Tax Map (placeholder)
            </a>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              <BookOpen className="h-4 w-4" />
              Zoning Map 3a (PDF placeholder)
            </a>
            <a className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] hover:underline" href="#" onClick={(e) => e.preventDefault()}>
              <History className="h-4 w-4" />
              Historical zoning maps (placeholder)
            </a>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="mt-2 overflow-hidden rounded-md border border-black/10 dark:border-white/10">
            <div className="grid grid-cols-2 bg-black/[0.02] text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:bg-white/[0.03] dark:text-gray-400 md:grid-cols-4">
              <div className="px-3 py-2">Owner</div>
              <div className="px-3 py-2">Land use</div>
              <div className="hidden px-3 py-2 md:block">Lot area</div>
              <div className="hidden px-3 py-2 md:block">Lot frontage/depth</div>
            </div>
            <div className="grid grid-cols-2 text-sm text-gray-700 dark:text-gray-200 md:grid-cols-4">
              <div className="px-3 py-3">Manual lookup</div>
              <div className="px-3 py-3">Manual lookup</div>
              <div className="hidden px-3 py-3 md:block">Manual lookup</div>
              <div className="hidden px-3 py-3 md:block">Manual lookup</div>
            </div>
            <div className="grid grid-cols-2 bg-black/[0.02] text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:bg-white/[0.03] dark:text-gray-400 md:grid-cols-4">
              <div className="px-3 py-2">Building class</div>
              <div className="px-3 py-2">Stories</div>
              <div className="hidden px-3 py-2 md:block">Gross floor area</div>
              <div className="hidden px-3 py-2 md:block">Units</div>
            </div>
            <div className="grid grid-cols-2 text-sm text-gray-700 dark:text-gray-200 md:grid-cols-4">
              <div className="px-3 py-3">Manual lookup</div>
              <div className="px-3 py-3">Manual lookup</div>
              <div className="hidden px-3 py-3 md:block">Manual lookup</div>
              <div className="hidden px-3 py-3 md:block">Manual lookup</div>
            </div>
            <div className="flex items-center gap-2 border-t border-black/10 px-3 py-2 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
              <Info className="h-3.5 w-3.5" />
              These facts are intentionally treated as sourced inputs, not computed zoning conclusions.
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-gray-400" />
              Property records and agency links will be added later.
            </span>
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-4 w-4 text-gray-400" />
              Worksheet below is your working paper.
            </span>
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              Manual review queue stays separate from compliance math.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
