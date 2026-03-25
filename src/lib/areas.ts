import type { Area } from '@/types';

export type AreaTemplateKey = 'apartment' | 'halfBathroom' | 'notesOnly';
export type AreaTypeKey =
  | 'amenity_space'
  | 'apartment_unit'
  | 'ats'
  | 'bike_storage'
  | 'corridor'
  | 'elevator_control_room'
  | 'egress'
  | 'electrical_closet'
  | 'electrical_room'
  | 'fire_pump'
  | 'half_bathroom'
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
};

export type AreaFormValue = {
  areaTypeKey: AreaTypeKey;
  unitType: ApartmentUnitType | '';
  areaNumber: string;
};

export const APARTMENT_UNIT_TYPES: ApartmentUnitType[] = ['EFF', '1BR', '2BR', '3BR'];

export const AREA_TYPE_DEFINITIONS: AreaTypeDefinition[] = [
  { key: 'amenity_space', label: 'Amenity Space', templateKey: 'notesOnly' },
  { key: 'apartment_unit', label: 'Apartment / Unit', templateKey: 'apartment', requiresUnitType: true },
  { key: 'ats', label: 'ATS', templateKey: 'notesOnly' },
  { key: 'bike_storage', label: 'Bike Storage', templateKey: 'notesOnly' },
  { key: 'corridor', label: 'Corridor', templateKey: 'notesOnly' },
  { key: 'egress', label: 'Egress', templateKey: 'notesOnly' },
  { key: 'electrical_closet', label: 'Electrical Closet', templateKey: 'notesOnly' },
  { key: 'electrical_room', label: 'Electrical Room', templateKey: 'notesOnly' },
  { key: 'elevator_control_room', label: 'Elevator Control Room', templateKey: 'notesOnly' },
  { key: 'fire_pump', label: 'Fire Pump', templateKey: 'notesOnly' },
  { key: 'half_bathroom', label: 'Half Bathroom', templateKey: 'halfBathroom' },
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
  { key: 'stairs', label: 'Stairs', templateKey: 'notesOnly' },
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

export function buildAreaName(form: AreaFormValue): string {
  const definition = getAreaTypeDefinition(form.areaTypeKey);
  const parts = [definition.label];

  if (form.areaTypeKey === 'apartment_unit' && form.unitType) {
    parts.push(form.unitType);
  }

  const areaNumber = form.areaNumber.trim();
  if (areaNumber) {
    parts.push(areaNumber);
  }

  return parts.join(' ').trim();
}

export function getDefaultAreaFormValue(): AreaFormValue {
  return {
    areaTypeKey: 'apartment_unit',
    unitType: '',
    areaNumber: '',
  };
}

export function getAreaFormValue(area?: Area | null): AreaFormValue {
  const areaTypeKey = getAreaTypeDefinition(area?.areaTypeKey).key;
  const unitType = APARTMENT_UNIT_TYPES.includes(area?.unitType as ApartmentUnitType)
    ? (area?.unitType as ApartmentUnitType)
    : '';

  return {
    areaTypeKey,
    unitType,
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
