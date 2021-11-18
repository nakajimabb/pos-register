export const Brands = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'danger',
  'pink',
  'purple',
  'light',
  'dark',
  'none',
] as const;

export type Brand = typeof Brands[number];
export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'none';
export type Size2 = Size | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | 'full' | 'max';
