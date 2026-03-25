'use client';

import { useMemo } from 'react';
import {
  APARTMENT_UNIT_TYPES,
  AREA_TYPE_DEFINITIONS,
  buildAreaName,
  getAreaTypeDefinition,
  type AreaFormValue,
  type AreaTypeKey,
  type ApartmentUnitType,
} from '@/lib/areas';

type AreaEditorModalProps = {
  open: boolean;
  title: string;
  value: AreaFormValue;
  recentAreaTypeKeys: AreaTypeKey[];
  onChange: (value: AreaFormValue) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
};

export default function AreaEditorModal({
  open,
  title,
  value,
  recentAreaTypeKeys,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
}: AreaEditorModalProps) {
  const orderedAreaTypes = useMemo(() => {
    const preferredOrder: AreaTypeKey[] = ['apartment_unit', 'half_bathroom', 'custom'];
    const recentSet = new Set(recentAreaTypeKeys);
    const preferred = preferredOrder
      .filter((key) => !recentSet.has(key))
      .map((key) => AREA_TYPE_DEFINITIONS.find((definition) => definition.key === key))
      .filter((definition): definition is (typeof AREA_TYPE_DEFINITIONS)[number] => !!definition);
    const recent = recentAreaTypeKeys
      .map((key) => AREA_TYPE_DEFINITIONS.find((definition) => definition.key === key))
      .filter((definition): definition is (typeof AREA_TYPE_DEFINITIONS)[number] => !!definition);

    const alphabetical = [...AREA_TYPE_DEFINITIONS]
      .filter((definition) => !recentSet.has(definition.key) && !preferredOrder.includes(definition.key))
      .sort((a, b) => a.label.localeCompare(b.label));

    return [...recent, ...preferred, ...alphabetical];
  }, [recentAreaTypeKeys]);

  if (!open) return null;

  const selectedDefinition = getAreaTypeDefinition(value.areaTypeKey);
  const previewName = buildAreaName(value);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Area
            </label>
            <select
              value={value.areaTypeKey}
              onChange={(e) =>
                onChange({
                  ...value,
                  areaTypeKey: e.target.value as AreaTypeKey,
                  unitType: e.target.value === 'apartment_unit' ? value.unitType : '',
                  customAreaName: e.target.value === 'custom' ? value.customAreaName : '',
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              autoFocus
            >
              {orderedAreaTypes.map((definition) => (
                <option key={definition.key} value={definition.key}>
                  {definition.label}
                </option>
              ))}
            </select>
          </div>

          {selectedDefinition.requiresUnitType && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Unit Type
              </label>
              <select
                value={value.unitType}
                onChange={(e) =>
                  onChange({
                    ...value,
                    unitType: e.target.value as ApartmentUnitType,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select unit type</option>
                {APARTMENT_UNIT_TYPES.map((unitType) => (
                  <option key={unitType} value={unitType}>
                    {unitType}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDefinition.requiresCustomName && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Area Name
              </label>
              <input
                type="text"
                value={value.customAreaName}
                onChange={(e) =>
                  onChange({
                    ...value,
                    customAreaName: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter custom area name"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Number / Floor
            </label>
            <input
              type="text"
              value={value.areaNumber}
              onChange={(e) =>
                onChange({
                  ...value,
                  areaNumber: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., 306, 12F, B1"
            />
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-3 py-2">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Preview</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {previewName || 'Select an area'}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={
              (selectedDefinition.requiresUnitType && !value.unitType) ||
              (selectedDefinition.requiresCustomName && !value.customAreaName.trim())
            }
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
