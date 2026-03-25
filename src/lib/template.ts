import { Area, Location } from '@/types';
import { createLocation, createItem, createCheckpoint } from './db';
import { getAreaTypeDefinition, resolveAreaTypeKey } from './areas';

interface TemplateItem {
  name: string;
  checkpoints: string[];
}

interface TemplateLocation {
  name: string;
  items: TemplateItem[];
}

const bathroomItems: TemplateItem[] = [
  { name: 'Door', checkpoints: ['Finish', 'Hardware operation', 'Stop', 'Frame Paint'] },
  { name: 'Saddle / Threshold', checkpoints: ['Level', '< 1/2" Transition'] },
  { name: 'Paint', checkpoints: ['Walls', 'Ceiling'] },
  { name: 'Wall Tile', checkpoints: ['Chipping', 'Grout', 'Edging', 'Caulk', 'Square'] },
  { name: 'Floor Tile', checkpoints: ['Chipping', 'Grout', 'Edging', 'Caulk', 'Square'] },
  { name: 'Toilet', checkpoints: ['18" Ctr to Wall?', 'Seat', 'Flush', 'Caulk', 'ADA-Comp'] },
  { name: 'Lavatory', checkpoints: ['Faucets', 'Caulked', 'Mount', 'Escutcheon', '15" O.C ?'] },
  { name: 'Tub / Shower', checkpoints: ['Shower Faucet', 'Tub Spout', 'Controls', 'Caulk', 'Escutcheon', 'Grab Bars', 'Rod', 'Curtain'] },
  { name: 'Med Cabinet', checkpoints: ['Shelves', 'Mirror', 'Clean'] },
  { name: 'Accessories', checkpoints: ['Towel Bar', 'Tooth Brush Holder', 'TP Holder', 'Robe Hook', 'Square'] },
  { name: 'Vanity Light', checkpoints: ['Operational', 'Bulb', 'Centered', 'Clean'] },
  { name: 'Ceiling Light', checkpoints: ['Operational', 'Bulb', 'Clean'] },
  { name: 'Outlets', checkpoints: ['Operational', 'Cover', 'Clean', 'Square', 'GFI'] },
  { name: 'Ventilation', checkpoints: ['Cover', 'Clean', 'Square'] },
  { name: 'Clean', checkpoints: ['Yes'] },
];

const apartmentTemplate: TemplateLocation[] = [
  {
    name: 'Entry / Foyer',
    items: [
      { name: 'Entry Door', checkpoints: ['Paint', 'Closer', 'Chime', 'Peep', 'Stop', 'Sweep', 'Hardware operation', 'Latch', 'Swing', 'FireRating Label'] },
      { name: 'Saddle / Threshold', checkpoints: ['Level', '< 1/2" Transition'] },
      { name: 'Paint', checkpoints: ['Walls', 'Ceiling'] },
      { name: 'Flooring', checkpoints: ['Adhesion', 'Edges', 'Joints', 'Finish'] },
      { name: 'Base', checkpoints: ['Paint', 'Flush', 'Corners', 'Caulk'] },
      { name: 'Closet 1 Door', checkpoints: ['Finish', 'Magnetic Catch', 'Hardware', 'Stop', 'Frame Paint'] },
      { name: 'Closet 1 Interior', checkpoints: ['Paint', 'Shelving', 'Rod', 'Ceiling'] },
      { name: 'Verizon / Cable', checkpoints: ['Boxes in place', 'Door', 'Clean', 'Caulk'] },
      { name: 'Closet 2 Door', checkpoints: ['Finish', 'Magnetic Catch', 'Hardware', 'Stop', 'Frame Paint'] },
      { name: 'Closet 2 Interior', checkpoints: ['Paint', 'Shelving', 'Rod', 'Ceiling'] },
      { name: 'General Paint', checkpoints: ['Wall', 'Ceiling'] },
      { name: 'Light Fixture', checkpoints: ['Operational', 'Bulb', 'Clean', 'Square'] },
      { name: 'Sprinkler', checkpoints: ['Cover', 'Clean', 'Flush'] },
      { name: 'Overall Clean', checkpoints: ['Yes'] },
      { name: 'Elec. Panel', checkpoints: ['Door', 'Clean', 'Flush'] },
      { name: 'Outlets', checkpoints: ['Operational', 'Cover', 'Clean', 'Square'] },
    ],
  },
  {
    name: 'Bathroom',
    items: bathroomItems,
  },
  {
    name: 'Kitchen',
    items: [
      { name: 'Floor Transition', checkpoints: ['Level'] },
      { name: 'Cabinets', checkpoints: ['Hardware', 'Silencer', 'Finish', 'Shelves', 'Kickplate'] },
      { name: 'Counter', checkpoints: ['Finish', 'Caulk', 'Clean'] },
      { name: 'Outlets', checkpoints: ['Operational', 'Cover', 'Clean', 'Square', 'GFI'] },
      { name: 'Paint', checkpoints: ['Walls', 'Ceiling'] },
      { name: 'Wall Tile', checkpoints: ['Chipping', 'Grout', 'Edging', 'Caulk', 'Square'] },
      { name: 'Sink', checkpoints: ['Operational', 'Strainer', 'Clean', 'Edging'] },
      { name: 'Sprinkler', checkpoints: ['Cover', 'Clean', 'Flush'] },
      { name: 'Light Fixture', checkpoints: ['Operational', 'Bulb', 'Clean'] },
      { name: 'Ventilation', checkpoints: ['Cover', 'Square', 'Clean'] },
      { name: 'Range', checkpoints: ['Operational', 'Back Cover', 'Level', 'Clean'] },
      { name: 'Refrigerator', checkpoints: ['Operational', 'Level', 'Clean', 'Shelves', 'Swing'] },
      { name: 'Convection Oven', checkpoints: ['Operational', 'Level', 'Clean'] },
      { name: 'Conv. Oven Outlet', checkpoints: ['Cover', 'Clean', 'Square', 'GFI', 'Hole in Cabinet for Oven Plug'] },
      { name: 'Clean', checkpoints: ['Yes'] },
    ],
  },
  {
    name: 'Living/Bedroom',
    items: [
      { name: 'Paint', checkpoints: ['Walls', 'Ceiling'] },
      { name: 'Wood Flooring', checkpoints: ['Adhesion', 'Edges', 'Joints', 'Finish'] },
      { name: 'Base', checkpoints: ['Paint', 'Flush', 'Corners', 'Caulk'] },
      { name: 'PTAC Enclosure', checkpoints: ['Operational', 'Thermostat', 'Cover', 'Edges', 'Clean'] },
      { name: 'Intercom', checkpoints: ['Operational', 'Square', 'Clean'] },
      { name: 'Light Fixture', checkpoints: ['Operational', 'Bulb', 'Clean'] },
      { name: 'Outlets', checkpoints: ['TV/Phone/Elec', 'Cover', 'Square', 'Clean', 'CATV/Ant Label'] },
      { name: 'Window', checkpoints: ['Operational', 'Locks', 'Limiter', 'Caulking', 'Frame'] },
      { name: 'Exterior Clean', checkpoints: ['Screen', 'Glass', 'Jamb', 'Clean', 'Blinds'] },
      { name: 'Window Sill', checkpoints: ['Flush', 'Caulk', 'Clean'] },
      { name: 'Sprinkler', checkpoints: ['Cover', 'Clean', 'Flush'] },
      { name: 'Clean', checkpoints: ['Yes'] },
    ],
  },
];

const halfBathroomTemplate: TemplateLocation[] = [
  {
    name: 'Half Bathroom',
    items: bathroomItems.filter((item) => item.name !== 'Tub / Shower'),
  },
];

function createNotesLocation(area: Area, sortOrder: number): Location {
  return createLocation(area.id, 'Other', sortOrder);
}

function populateArea(area: Area, templateLocations: TemplateLocation[]): void {
  templateLocations.forEach((templateLocation, locationIndex) => {
    const location = createLocation(area.id, templateLocation.name, locationIndex);

    templateLocation.items.forEach((templateItem, itemIndex) => {
      const item = createItem(location.id, templateItem.name, itemIndex);

      templateItem.checkpoints.forEach((checkpointName, checkpointIndex) => {
        const checkpoint = createCheckpoint(item.id, checkpointName, checkpointIndex);
        item.checkpoints.push(checkpoint);
      });

      location.items.push(item);
    });

    area.locations.push(location);
  });

  area.locations.push(createNotesLocation(area, templateLocations.length));
}

export function applyTemplateToArea(area: Area): void {
  area.locations = [];
  const definition = getAreaTypeDefinition(resolveAreaTypeKey(area));

  if (definition.templateKey === 'apartment') {
    populateArea(area, apartmentTemplate);
    return;
  }

  if (definition.templateKey === 'halfBathroom') {
    populateArea(area, halfBathroomTemplate);
    return;
  }

  area.locations.push(createNotesLocation(area, 0));
}
