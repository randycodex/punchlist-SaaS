import type { ZoningReportSection } from '@/lib/zoning/types';
import ZoningWorksheetSection from '@/components/zoning/ZoningWorksheetSection';

export default function ZoningWorksheet({
  sections,
  editable = false,
  onSaveItem,
}: {
  sections: ZoningReportSection[];
  editable?: boolean;
  onSaveItem?: Parameters<typeof ZoningWorksheetSection>[0]['onSaveItem'];
}) {
  return (
    <div className="overflow-hidden border-x border-b border-zinc-300 bg-white text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50">
      {sections.map((section) => (
        <ZoningWorksheetSection key={section.id} section={section} editable={editable} onSaveItem={onSaveItem} />
      ))}
    </div>
  );
}
