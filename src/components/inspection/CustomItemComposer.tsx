'use client';

import { X } from 'lucide-react';

type CustomItemComposerProps = {
  open: boolean;
  value: string;
  submitLabel?: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export default function CustomItemComposer({
  open,
  value,
  submitLabel = 'Add',
  onOpen,
  onClose,
  onChange,
  onSubmit,
}: CustomItemComposerProps) {
  if (!open) {
    return (
      <div className="px-1 pt-1">
        <button
          onClick={onOpen}
          className="flex w-full items-center rounded-[1rem] px-6 py-3 text-left text-sm font-medium text-gray-700 transition dark:text-gray-200"
        >
          Add item
        </button>
      </div>
    );
  }

  return (
    <div className="px-1 pt-1">
      <div className="flex items-center gap-3">
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
          className="flex-1 rounded-[1rem] bg-gray-100/90 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/70 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
          placeholder="Custom item name"
          autoFocus
        />
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="rounded-[1rem] bg-gray-900 px-4 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-700 dark:hover:bg-zinc-600"
        >
          {submitLabel}
        </button>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 transition hover:bg-black/[0.04] hover:text-gray-700 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
          aria-label="Cancel adding item"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
