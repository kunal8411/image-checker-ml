import { CATEGORIES, type VisualCategory } from '../types/index';

const RULES: { category: VisualCategory; terms: string[] }[] = [
  { category: 'traffic-light', terms: ['traffic light', 'traffic signal', 'stoplight'] },
  { category: 'motorcycle', terms: ['moped', 'motor scooter', 'motorcycle', 'trail bike'] },
  { category: 'bicycle', terms: ['bicycle-built-for-two', 'mountain bike', 'all-terrain bike', 'bicycle'] },
  { category: 'bus', terms: ['trolleybus', 'minibus', 'school bus', 'bus'] },
  {
    category: 'car',
    terms: [
      'sports car',
      'sport car',
      'convertible',
      'limousine',
      'taxicab',
      'taxi',
      'cab',
      'pickup truck',
      'pickup',
      'race car',
      'racing car',
      'racer',
      'minivan',
      'jeep',
      'landrover',
      'ambulance',
      'beach wagon',
      'station wagon',
      'police van',
      'model t',
      'go-kart',
      'golfcart',
      'golf cart',
      'car wheel',
      'car mirror',
      'recreational vehicle',
    ],
  },
  { category: 'tree', terms: ['redwood', 'sequoia', 'pine', 'fir tree', 'oak tree', 'timber tree'] },
  {
    category: 'building',
    terms: [
      'palace',
      'castle',
      'church',
      'monastery',
      'bell cote',
      'boathouse',
      'mosque',
      'stupa',
      'library',
      'barn',
      'lighthouse',
      'planetarium',
      'cinema',
      'movie theater',
      'movie theatre',
      'home theater',
      'home theatre',
      'mobile home',
      'birdhouse',
      'yurt',
      'dome',
    ],
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsTerm(className: string, term: string): boolean {
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}([^a-z0-9]|$)`);
  return pattern.test(className.toLowerCase());
}

export function mapClassName(className: string): VisualCategory | 'other' {
  for (const rule of RULES) {
    for (const term of rule.terms) {
      if (containsTerm(className, term)) return rule.category;
    }
  }
  return 'other';
}

export function aggregateCategoryScores(
  classProbabilities: readonly { className: string; probability: number }[],
): { scores: Record<string, number>; sourceLabel: string } {
  const scores: Record<string, number> = { other: 0 };
  for (const category of CATEGORIES) scores[category] = 0;

  let sourceLabel = 'unknown';
  let sourceProbability = -1;

  for (const entry of classProbabilities) {
    if (entry.probability > sourceProbability) {
      sourceProbability = entry.probability;
      sourceLabel = entry.className;
    }
    const category = mapClassName(entry.className);
    scores[category] = (scores[category] ?? 0) + entry.probability;
  }

  return { scores, sourceLabel };
}
