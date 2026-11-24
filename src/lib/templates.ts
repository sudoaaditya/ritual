import type { Category, Item, Milestone } from './types';

type TItem = Omit<Item, 'id' | 'planId' | 'order'>;
export interface Template {
  id: string;
  name: string;
  category: Category;
  blurb: string;
  durationDays?: number;
  items: TItem[];
  milestones?: { title: string; offsetDays: number; icon: string }[];
}

const d = (o: Partial<TItem> & Pick<TItem, 'name' | 'icon' | 'color' | 'slot'>): TItem => ({
  time: undefined,
  schedule: { kind: 'daily' },
  target: 1,
  ...o,
});

export const TEMPLATES: Template[] = [
  {
    id: 'skin-basic',
    name: 'Skin care — AM / PM',
    category: 'skin',
    blurb: 'Cleanse, treat, moisturise, protect. Retinoid three nights a week.',
    durationDays: 84,
    items: [
      d({ name: 'Gentle cleanser', icon: 'droplets', color: '#64d2ff', slot: 'morning', time: '07:30', timer: 60, notes: 'Lukewarm water, massage for 60 seconds.' }),
      d({ name: 'Vitamin C serum', icon: 'flask', color: '#ff9f0a', slot: 'morning', time: '07:35', notes: '3–4 drops on dry skin.' }),
      d({ name: 'Moisturiser', icon: 'droplet', color: '#5ac8fa', slot: 'morning', time: '07:40' }),
      d({ name: 'Sunscreen SPF 50', icon: 'sunscreen', color: '#ffd60a', slot: 'morning', time: '07:45', notes: 'Two finger-lengths for face & neck. Reapply every 2–3 h outdoors.' }),
      d({ name: 'Double cleanse', icon: 'droplets', color: '#64d2ff', slot: 'night', time: '22:00', timer: 120 }),
      d({ name: 'Retinoid', icon: 'moon', color: '#bf5af2', slot: 'night', time: '22:05', schedule: { kind: 'weekdays', days: [1, 3, 5] }, notes: 'Pea-sized amount. Skip if irritated.' }),
      d({ name: 'Night cream', icon: 'droplet', color: '#5e5ce6', slot: 'night', time: '22:10' }),
      d({ name: 'Exfoliating mask', icon: 'sparkles', color: '#ff7a8a', slot: 'any', timer: 600, schedule: { kind: 'weekdays', days: [0] } }),
    ],
    milestones: [
      { title: 'Progress photo', offsetDays: 28, icon: 'smile' },
      { title: 'Dermatologist review', offsetDays: 84, icon: 'doctor' },
    ],
  },
  {
    id: 'hair-growth',
    name: 'Hair care — growth',
    category: 'hair',
    blurb: 'Topicals, supplements, oiling and scalp massage on a weekly rhythm.',
    durationDays: 180,
    items: [
      d({ name: 'Oil + shampoo', icon: 'droplet', color: '#ff9f0a', slot: 'morning', time: '08:00', timer: 1800, schedule: { kind: 'weekdays', days: [3, 6] }, notes: 'Leave oil on 30 min, then shampoo.' }),
      d({ name: 'Scalp massager', icon: 'hand', color: '#ffb340', slot: 'morning', time: '08:15', timer: 300, schedule: { kind: 'weekdays', days: [3, 6] } }),
      d({ name: 'Biotin capsule', icon: 'pill', color: '#8e8e93', slot: 'morning', time: '10:00', notes: '1 capsule after food.' }),
      d({ name: 'Minoxidil', icon: 'waves', color: '#30b0c7', slot: 'night', time: '21:30', schedule: { kind: 'interval', every: 2, anchor: '' }, notes: '1 ml on dry scalp. Wash hands after.' }),
      d({ name: 'Derma stamp', icon: 'stamp', color: '#bf5af2', slot: 'night', time: '21:45', schedule: { kind: 'weekdays', days: [0] } }),
      d({ name: 'Change pillow cover', icon: 'bed', color: '#a2845e', slot: 'any', schedule: { kind: 'weekdays', days: [4] } }),
    ],
    milestones: [
      { title: 'Replace derma stamp', offsetDays: 45, icon: 'stamp' },
      { title: 'Doctor review', offsetDays: 90, icon: 'doctor' },
    ],
  },
  {
    id: 'diet-balanced',
    name: 'Diet — balanced day',
    category: 'diet',
    blurb: 'Meals on time, protein in every meal, 8 glasses of water.',
    items: [
      d({ name: 'Water', icon: 'water', color: '#0a84ff', slot: 'any', target: 8, unit: 'glass', time: '09:00', notes: 'Tap + each time you finish a glass.' }),
      d({ name: 'Breakfast', icon: 'egg', color: '#ffd60a', slot: 'morning', time: '08:30', notes: 'Protein + fibre.' }),
      d({ name: 'Multivitamin', icon: 'tablets', color: '#8e8e93', slot: 'morning', time: '09:00' }),
      d({ name: 'Lunch', icon: 'salad', color: '#34c759', slot: 'afternoon', time: '13:00', notes: 'Half the plate veggies.' }),
      d({ name: 'Fruit snack', icon: 'citrus', color: '#ff9f0a', slot: 'afternoon', time: '16:30' }),
      d({ name: 'Dinner', icon: 'soup', color: '#ff7a8a', slot: 'evening', time: '19:30', notes: 'Finish 3 h before bed.' }),
      d({ name: 'No sugar today', icon: 'candy', color: '#ff453a', slot: 'any' }),
    ],
  },
  {
    id: 'blank',
    name: 'Start from scratch',
    category: 'custom',
    blurb: 'An empty plan — add your own items.',
    items: [],
  },
];

export function milestonesFor(t: Template, planId: string, start: string, addDays: (d: string, n: number) => string, uid: () => string): Milestone[] {
  return (t.milestones ?? []).map((m) => ({ id: uid(), planId, title: m.title, icon: m.icon, date: addDays(start, m.offsetDays) }));
}
