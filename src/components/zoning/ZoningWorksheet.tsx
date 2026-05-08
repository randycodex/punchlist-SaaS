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
    <div className="space-y-4">
      {sections.map((section) => (
        <ZoningWorksheetSection key={section.id} section={section} editable={editable} onSaveItem={onSaveItem} />
      ))}
    </div>
  );
}
