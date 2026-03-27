'use client';

type AreaNotesCardProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
};

export default function AreaNotesCard({ value, onChange, onBlur }: AreaNotesCardProps) {
  return (
    <div className="card-surface-subtle rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-3">
        <div className="section-eyebrow">General Notes</div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder="Add general notes for this area"
        rows={5}
        className="w-full resize-none rounded-[1.25rem] border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-zinc-600"
      />
    </div>
  );
}
