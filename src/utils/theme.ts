import { PinkTheme } from './colors';
import { AppTheme } from '../types';

// Keep old stored ids readable; the product has one fixed light palette.
export function useThemeId(): AppTheme {
  return 'pink';
}

export function useThemeColors() {
  return PinkTheme;
}
