'use client';

type AreaNotesCardProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
};

export default function AreaNotesCard({ value, onChange, onBlur }: AreaNotesCardProps) {
  return (
    <div className="px-1 pt-1">
      <div className="section-eyebrow">General Notes</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder="Add general notes for this area"
        rows={4}
        className="mt-2 w-full resize-none rounded-[1rem] bg-gray-50/90 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/65 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
      />
    </div>
  );
}
