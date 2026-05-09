'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section id={section.key} className="border-t border-zinc-300 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setCollapsed((current) => !current)}
        className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_7rem] border-b-2 border-black bg-zinc-100 text-left text-sm font-bold text-black dark:border-zinc-200 dark:bg-zinc-800 dark:text-white"
        aria-expanded={!collapsed}
      >
        <span className="flex items-center justify-center">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
        <span className="py-1 uppercase">{section.title}</span>
        <span className="px-1.5 py-1 text-right text-[0.7rem] uppercase tracking-normal text-zinc-600 dark:text-zinc-300">
          {section.items.length} rows
        </span>
      </button>
      {!collapsed ? (
        <>
          <div className={`${editable ? 'xl:grid-cols-[8.5rem_1.35fr_1.45fr_1.15fr_8.25rem_1fr_3.75rem]' : 'xl:grid-cols-[8.5rem_1.35fr_1.45fr_1.15fr_8.25rem_1fr]'} hidden border-b-2 border-black bg-zinc-200 text-[0.78rem] font-bold text-black dark:border-zinc-200 dark:bg-zinc-800 dark:text-white md:grid`}>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">ZR Sec.</div>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">Item / Description</div>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">Permitted / Required</div>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">Proposed</div>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">Result</div>
            <div className="border-r border-zinc-300 px-1.5 py-0.5 dark:border-zinc-700">Notes</div>
            {editable ? <div className="px-1.5 py-0.5">Action</div> : null}
          </div>
          {section.items.map((item) => (
            <ZoningWorksheetRow key={item.id} item={item} editable={editable} onSave={onSaveItem} />
          ))}
        </>
      ) : null}
    </section>
  );
}
