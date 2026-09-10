/**
 * Initial cheer categories and messages for Kenchiko.
 * Provides mood categories and warm cheering responses.
 */
import { OuenCategory, OuenItem } from '../types';

export const INITIAL_OUEN_CATEGORIES: OuenCategory[] = [
  { id: 'tired', label: 'つかれた' },
  { id: 'irritated', label: 'いらいらする' },
  { id: 'angry', label: 'はらがたつ' },
];

export const INITIAL_OUEN_LIST: OuenItem[] = [
  {
    id: 'ouen_default_1',
    categoryId: 'tired',
    message: 'よしよし',
    createdAt: 1741334400000,
  },
];

