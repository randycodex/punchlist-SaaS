import type { Area } from '@/types';

export type AreaTemplateKey = 'apartment' | 'halfBathroom' | 'notesOnly' | 'stairs';
export type AreaTypeKey =
  | 'amenity_space'
  | 'apartment_unit'
  | 'ats'
  | 'bike_storage'
  | 'corridor'
  | 'custom'
  | 'elevator_control_room'
  | 'egress'
  | 'electrical_closet'
  | 'electrical_room'
  | 'fire_pump'
  | 'hot_water'
  | 'it_closet'
  | 'it_room'
  | 'janitor'
  | 'laundry'
  | 'lobby'
  | 'mail_area'
  | 'mechanical'
  | 'multipurpose'
  | 'office'
  | 'parcel_room'
  | 'public_toilet'
  | 'refuse'
  | 'security'
  | 'stairs'
  | 'storage'
  | 'super_office'
  | 'trash_compactor'
  | 'vestibule'
  | 'water_room';

export type ApartmentUnitType = 'EFF' | '1BR' | '2BR' | '3BR';

export type AreaTypeDefinition = {
  key: AreaTypeKey;
  label: string;
  templateKey: AreaTemplateKey;
  requiresUnitType?: boolean;
  requiresCustomName?: boolean;
};

export type AreaFormValue = {
  areaTypeKey: AreaTypeKey;
  unitType: ApartmentUnitType | '';
  customAreaName: string;
  areaNumber: string;
};

export const APARTMENT_UNIT_TYPES: ApartmentUnitType[] = ['EFF', '1BR', '2BR', '3BR'];

export const AREA_TYPE_DEFINITIONS: AreaTypeDefinition[] = [
  { key: 'amenity_space', label: 'Amenity Space', templateKey: 'notesOnly' },
  { key: 'apartment_unit', label: 'Apartment / Unit', templateKey: 'apartment', requiresUnitType: true },
  { key: 'ats', label: 'ATS', templateKey: 'notesOnly' },
  { key: 'bike_storage', label: 'Bike Storage', templateKey: 'notesOnly' },
  { key: 'corridor', label: 'Corridor', templateKey: 'notesOnly' },
  { key: 'custom', label: 'Custom', templateKey: 'notesOnly', requiresCustomName: true },
  { key: 'egress', label: 'Egress', templateKey: 'notesOnly' },
  { key: 'electrical_closet', label: 'Electrical Closet', templateKey: 'notesOnly' },
  { key: 'electrical_room', label: 'Electrical Room', templateKey: 'notesOnly' },
  { key: 'elevator_control_room', label: 'Elevator Control Room', templateKey: 'notesOnly' },
  { key: 'fire_pump', label: 'Fire Pump', templateKey: 'notesOnly' },
  { key: 'hot_water', label: 'Hot Water', templateKey: 'notesOnly' },
  { key: 'it_closet', label: 'IT Closet', templateKey: 'notesOnly' },
  { key: 'it_room', label: 'IT Room', templateKey: 'notesOnly' },
  { key: 'janitor', label: 'Janitor', templateKey: 'notesOnly' },
  { key: 'laundry', label: 'Laundry', templateKey: 'notesOnly' },
  { key: 'lobby', label: 'Lobby', templateKey: 'notesOnly' },
  { key: 'mail_area', label: 'Mail Area', templateKey: 'notesOnly' },
  { key: 'mechanical', label: 'Mechanical', templateKey: 'notesOnly' },
  { key: 'multipurpose', label: 'Multipurpose', templateKey: 'notesOnly' },
  { key: 'office', label: 'Office', templateKey: 'notesOnly' },
  { key: 'parcel_room', label: 'Parcel Room', templateKey: 'notesOnly' },
  { key: 'public_toilet', label: 'Public Toilet', templateKey: 'notesOnly' },
  { key: 'refuse', label: 'Refuse', templateKey: 'notesOnly' },
  { key: 'security', label: 'Security', templateKey: 'notesOnly' },
  { key: 'stairs', label: 'Stairs', templateKey: 'stairs' },
  { key: 'storage', label: 'Storage', templateKey: 'notesOnly' },
  { key: 'super_office', label: "Super's Office", templateKey: 'notesOnly' },
  { key: 'trash_compactor', label: 'Trash Compactor', templateKey: 'notesOnly' },
  { key: 'vestibule', label: 'Vestibule', templateKey: 'notesOnly' },
  { key: 'water_room', label: 'Water Room', templateKey: 'notesOnly' },
];

const definitionByKey = new Map<string, AreaTypeDefinition>(AREA_TYPE_DEFINITIONS.map((definition) => [definition.key, definition]));

export function getAreaTypeDefinition(areaTypeKey?: string): AreaTypeDefinition {
  return (areaTypeKey ? definitionByKey.get(areaTypeKey) : undefined) ?? definitionByKey.get('apartment_unit')!;
}

function normalizeAreaText(value: string): string {
  return value
    .toLowerCase()
    .replace(/['/]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferAreaTypeKeyFromName(name?: string): AreaTypeKey | undefined {
  const normalizedName = normalizeAreaText(name ?? '');
  if (!normalizedName) return undefined;

  if (
    normalizedName.startsWith('apartment ') ||
    normalizedName.startsWith('unit ') ||
    normalizedName.startsWith('apt ') ||
    normalizedName === 'apt'
  ) {
    return 'apartment_unit';
  }

  const matchedDefinition = AREA_TYPE_DEFINITIONS.find((definition) => {
    const normalizedLabel = normalizeAreaText(definition.label);
    return normalizedName === normalizedLabel || normalizedName.startsWith(`${normalizedLabel} `);
  });

  return matchedDefinition?.key;
}

export function resolveAreaTypeKey(area?: Pick<Area, 'areaTypeKey' | 'name'> | null): AreaTypeKey {
  return area?.areaTypeKey && definitionByKey.has(area.areaTypeKey)
    ? (area.areaTypeKey as AreaTypeKey)
    : inferAreaTypeKeyFromName(area?.name) ?? 'apartment_unit';
}

export function isApartmentArea(area?: Pick<Area, 'areaTypeKey' | 'name'> | null): boolean {
  return resolveAreaTypeKey(area) === 'apartment_unit';
}

export function buildAreaName(form: AreaFormValue): string {
  const definition = getAreaTypeDefinition(form.areaTypeKey);
  const baseName = definition.requiresCustomName ? form.customAreaName.trim() : definition.label;
  const areaNumber = form.areaNumber.trim();

  if (form.areaTypeKey === 'apartment_unit') {
    return [baseName, form.unitType, areaNumber].filter(Boolean).join(' - ').trim();
  }

  return [baseName, areaNumber].filter(Boolean).join(' - ').trim();
}

export function getDefaultAreaFormValue(): AreaFormValue {
  return {
    areaTypeKey: 'apartment_unit',
    unitType: '',
    customAreaName: '',
    areaNumber: '',
  };
}

export function getAreaFormValue(area?: Area | null): AreaFormValue {
  const areaTypeKey = resolveAreaTypeKey(area);
  const unitType = APARTMENT_UNIT_TYPES.includes(area?.unitType as ApartmentUnitType)
    ? (area?.unitType as ApartmentUnitType)
    : '';

  return {
    areaTypeKey,
    unitType,
    customAreaName: areaTypeKey === 'custom' ? area?.name ?? '' : '',
    areaNumber: area?.areaNumber ?? '',
  };
}

export function areaHasRecordedActivity(area: Area): boolean {
  return area.locations.some((location) =>
    location.items.some((item) =>
      item.checkpoints.some(
        (checkpoint) =>
          checkpoint.status !== 'pending' ||
          checkpoint.comments.trim().length > 0 ||
          checkpoint.photos.length > 0 ||
          (checkpoint.files?.length ?? 0) > 0
      )
    )
  );
}
