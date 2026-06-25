export const Colors = {
  bg:        '#0D0D1A',
  surface:   '#13132A',
  card:      '#1A1A35',
  border:    '#2A2A50',
  primary:   '#7C3AED',
  secondary: '#4F46E5',
  accent:    '#A78BFA',
  neon:      '#8B5CF6',
  text:      '#F8FAFC',
  muted:     '#94A3B8',
  success:   '#22C55E',
  warning:   '#F59E0B',
  danger:    '#EF4444',
  overlay:   'rgba(13,13,26,0.85)',
} as const;

export const Gradients = {
  primary:    [Colors.primary, Colors.secondary] as [string, string],
  primaryBtn: ['#4F8EF7', '#7C3AED'] as [string, string],
  neon:       ['#8B5CF6', '#6366F1'] as [string, string],
  dark:       ['#1A1A35', '#0D0D1A'] as [string, string],
} as const;
