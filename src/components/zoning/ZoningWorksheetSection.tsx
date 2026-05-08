import type { ZoningReportSection } from '@/lib/zoning/types';
import ZoningWorksheetRow from '@/components/zoning/ZoningWorksheetRow';

export default function ZoningWorksheetSection({
  section,
  editable = false,
  onSaveItem,
}: {
  section: ZoningReportSection;
  editable?: boolean;
  onSaveItem?: Parameters<typeof ZoningWorksheetRow>[0]['onSave'];
}) {
  return (
    <section id={section.key} className="overflow-hidden rounded-lg border border-black/10 bg-white/80 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="border-b border-black/5 px-4 py-4 dark:border-white/10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{section.title}</h2>
            {section.description ? (
              <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">{section.description}</p>
            ) : null}
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">{section.items.length} rows</span>
        </div>
      </div>
      <div className={`${editable ? 'lg:grid-cols-[1fr_1.1fr_1fr_10rem_1.1fr_5.5rem]' : 'md:grid-cols-[1.1fr_1.1fr_1fr_9rem_1.2fr]'} hidden gap-3 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-gray-400 md:grid`}>
        <div>Field</div>
        <div>Value</div>
        <div>Source</div>
        <div>Status</div>
        <div>Notes</div>
        {editable ? <div>Action</div> : null}
      </div>
      {section.items.map((item) => (
        <ZoningWorksheetRow key={item.id} item={item} editable={editable} onSave={onSaveItem} />
      ))}
    </section>
  );
}
