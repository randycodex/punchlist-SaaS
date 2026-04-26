'use client';

import { useMemo } from 'react';
import {
  APARTMENT_UNIT_TYPES,
  AREA_TYPE_DEFINITIONS,
  FACADE_ORIENTATIONS,
  getAreaTypeDefinition,
  type AreaFormValue,
  type AreaTypeKey,
  type ApartmentUnitType,
  type FacadeOrientation,
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
    const preferredOrder: AreaTypeKey[] = ['apartment_unit', 'custom'];
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

  return (
    <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="modal-panel w-full max-w-md rounded-[1.9rem] p-6">
        <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">{title}</h2>
        <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">Choose the area type and label details.</p>

        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
              className="field-shell"
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
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="field-shell"
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

          {selectedDefinition.requiresOrientation && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Orientation
              </label>
              <select
                value={value.unitType}
                onChange={(e) =>
                  onChange({
                    ...value,
                    unitType: e.target.value as FacadeOrientation,
                  })
                }
                className="field-shell"
              >
                <option value="">Select orientation</option>
                {FACADE_ORIENTATIONS.map((orientation) => (
                  <option key={orientation} value={orientation}>
                    {orientation}
                  </option>
                ))}
              </select>
            </div>
          )}

          {selectedDefinition.requiresCustomName && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="field-shell"
                placeholder="Enter custom area name"
              />
            </div>
          )}

          {!selectedDefinition.requiresOrientation && (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
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
                className="field-shell"
                placeholder="e.g., 306, 12F, B1"
              />
            </div>
          )}

        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-300/90 bg-white/70 px-4 py-3 font-medium text-gray-700 transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={
              (selectedDefinition.requiresUnitType && !value.unitType) ||
              (selectedDefinition.requiresOrientation && !value.unitType) ||
              (selectedDefinition.requiresCustomName && !value.customAreaName.trim())
            }
            className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
