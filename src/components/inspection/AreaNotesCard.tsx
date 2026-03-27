'use client';

type AreaNotesCardProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
};

export default function AreaNotesCard({ value, onChange, onBlur }: AreaNotesCardProps) {
  return (
    <div className="rounded-2xl border border-gray-300 bg-white/90 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          General Notes
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Capture context for this area that does not belong to a specific checklist item.
        </p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder="Add general notes for this area"
        rows={5}
        className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-zinc-600"
      />
    </div>
  );
}
