'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

type CustomItemComposerProps = {
  open: boolean;
  value: string;
  triggerLabel?: string;
  valuePlaceholder?: string;
  secondaryValue?: string;
  secondaryValuePlaceholder?: string;
  submitLabel?: string;
  onOpen: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
  onSecondaryChange?: (value: string) => void;
  onSubmit: () => void;
};

export default function CustomItemComposer({
  open,
  value,
  triggerLabel = '+ Item',
  valuePlaceholder = 'Custom item name',
  secondaryValue,
  secondaryValuePlaceholder = 'Sub-item name',
  submitLabel = 'Add',
  onOpen,
  onClose,
  onChange,
  onSecondaryChange,
  onSubmit,
}: CustomItemComposerProps) {
  const composerRef = useRef<HTMLDivElement | null>(null);
  const requiresSecondaryValue = typeof secondaryValue === 'string' && typeof onSecondaryChange === 'function';
  const canSubmit = value.trim() && (!requiresSecondaryValue || secondaryValue.trim());

  useEffect(() => {
    if (!open) return;

    function handleDocumentClick(event: MouseEvent) {
      if (composerRef.current?.contains(event.target as Node)) return;

      const isEmptyPrimary = !value.trim();
      const isEmptySecondary = !requiresSecondaryValue || !secondaryValue.trim();
      if (isEmptyPrimary && isEmptySecondary) {
        onClose();
      }
    }

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [open, onClose, requiresSecondaryValue, secondaryValue, value]);

  if (!open) {
    return (
      <div className="px-1 pt-1">
        <button
          onClick={onOpen}
          className="flex w-full items-center rounded-[1rem] px-6 py-3 text-left text-sm font-medium text-gray-700 transition dark:text-gray-200"
        >
          {triggerLabel}
        </button>
      </div>
    );
  }

  return (
    <div ref={composerRef} className="px-1 pt-1">
      <div className="space-y-3">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canSubmit) {
              e.preventDefault();
              onSubmit();
            }
          }}
          className="w-full rounded-[1rem] bg-gray-100/90 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/70 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
          placeholder={valuePlaceholder}
          autoFocus
        />
        {requiresSecondaryValue && (
          <input
            type="text"
            value={secondaryValue}
            onChange={(e) => onSecondaryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            className="w-full rounded-[1rem] bg-gray-100/90 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ef4e24]/20 dark:bg-zinc-900/70 dark:text-white dark:placeholder:text-gray-500 dark:focus:ring-[#ef4e24]/25"
            placeholder={secondaryValuePlaceholder}
          />
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
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
    </div>
  );
}
