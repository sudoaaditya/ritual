import type { Schedule } from './schedule';
export type { Schedule };

export type Category = 'skin' | 'hair' | 'diet' | 'fitness' | 'custom';
export type Slot = 'morning' | 'afternoon' | 'evening' | 'night' | 'any';

export interface Plan {
  id: string;
  name: string;
  category: Category;
  color: string;
  icon: string;
  startDate: string;
  durationDays?: number;
  notes?: string;
  archived?: boolean;
  createdAt: number;
}

export interface Item {
  id: string;
  planId: string;
  name: string;
  icon: string;
  color: string;
  notes?: string;
  slot: Slot;
  time?: string; // HH:MM
  schedule: Schedule;
  target: number; // completions per day (e.g. 8 glasses of water)
  unit?: string;
  timer?: number; // seconds, used by routine mode (e.g. 60s cleanse, 10 min mask)
  startDate?: string;
  endDate?: string;
  order: number;
  archived?: boolean;
}

export type LogStatus = 'done' | 'skipped';

export interface Log {
  id: string; // `${itemId}|${date}`
  itemId: string;
  planId: string;
  date: string;
  status: LogStatus;
  count: number;
  at: number;
}

export interface Milestone {
  id: string;
  planId: string;
  title: string;
  date: string;
  icon: string;
  done?: boolean;
}

export const SLOTS: { id: Slot; label: string; range: string }[] = [
  { id: 'morning', label: 'Morning', range: '5 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', range: '12 – 5 PM' },
  { id: 'evening', label: 'Evening', range: '5 – 9 PM' },
  { id: 'night', label: 'Night', range: '9 PM – late' },
  { id: 'any', label: 'Any time', range: 'Whenever' },
];

export const CATEGORIES: { id: Category; label: string; color: string; icon: string }[] = [
  { id: 'skin', label: 'Skin care', color: '#ff7a8a', icon: 'sparkles' },
  { id: 'hair', label: 'Hair care', color: '#ffb340', icon: 'scissors' },
  { id: 'diet', label: 'Diet', color: '#34c759', icon: 'apple' },
  { id: 'fitness', label: 'Fitness', color: '#5ac8fa', icon: 'dumbbell' },
  { id: 'custom', label: 'Custom', color: '#af52de', icon: 'star' },
];

export const PALETTE = [
  '#ff453a', '#ff7a8a', '#ff9f0a', '#ffb340', '#ffd60a', '#34c759', '#30d158',
  '#64d2ff', '#5ac8fa', '#0a84ff', '#5e5ce6', '#af52de', '#bf5af2', '#a2845e', '#8e8e93',
];

export interface CheckIn {
  id: string; // `${planId}|${date}`
  planId: string;
  date: string;
  rating?: number; // 1–5
  flags: string[];
  note?: string;
  at: number;
}

export interface Photo {
  id: string;
  planId: string;
  date: string;
  blob: Blob;
  createdAt: number;
}

export const CHECKIN: Record<Category, { question: string; label: string; flags: string[] }> = {
  skin: { question: 'How is your skin today?', label: 'Skin', flags: ['Irritation', 'Breakout', 'Dryness', 'Redness', 'Oily', 'Glowing'] },
  hair: { question: 'How are your hair & scalp?', label: 'Hair & scalp', flags: ['Shedding', 'Itchy scalp', 'Flakes', 'Oily scalp', 'New growth'] },
  diet: { question: 'How do you feel today?', label: 'Energy', flags: ['Low energy', 'Bloated', 'Cravings', 'Slept well', 'Headache'] },
  fitness: { question: 'How does your body feel?', label: 'Body', flags: ['Sore', 'Tired', 'Strong', 'Slept well', 'Injury'] },
  custom: { question: 'How did today go?', label: 'Mood', flags: ['Stressed', 'Tired', 'Motivated', 'Slept well'] },
};

export const MOODS = ['😣', '😕', '😐', '🙂', '😄'];
