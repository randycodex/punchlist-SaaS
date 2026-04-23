'use client';

type AreaNotesCardProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur: (value: string) => void;
};

export default function AreaNotesCard({ value, onChange, onBlur }: AreaNotesCardProps) {
  return (
    <div className="card-surface-subtle rounded-[1.6rem] px-4 py-4">
      <div className="section-eyebrow">General Notes</div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onBlur(e.target.value)}
        placeholder="Add general notes for this area"
        rows={4}
        className="field-shell mt-3 min-h-[128px] resize-none text-sm"
      />
    </div>
  );
}
