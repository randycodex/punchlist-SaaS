import type { ZoningReportSection } from '@/lib/zoning/types';
import ZoningWorksheetSection from '@/components/zoning/ZoningWorksheetSection';

export default function ZoningWorksheet({ sections }: { sections: ZoningReportSection[] }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <ZoningWorksheetSection key={section.id} section={section} />
      ))}
    </div>
  );
}
