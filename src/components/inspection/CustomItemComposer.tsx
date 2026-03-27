'use client';

type CustomItemComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function CustomItemComposer({
  value,
  onChange,
  onSubmit,
}: CustomItemComposerProps) {
  return (
    <div className="card-surface-subtle rounded-[1.5rem] p-4 sm:p-5">
      <div className="mb-3">
        <div className="section-eyebrow">
          Custom Items
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add field notes or one-off components without changing the template.
        </p>
      </div>
      <div className="flex gap-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="flex-1 rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 dark:border-zinc-600 dark:bg-zinc-700 dark:text-white"
          placeholder="Custom item name"
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="rounded-2xl bg-gray-900 px-4 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          Add
        </button>
      </div>
    </div>
  );
}
