// Peerly Global Animation System
// Centralized motion tokens for consistent, fintech-grade animations

export const durations = {
  fast: 150,
  normal: 250,
  slow: 400,
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0.0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

export const transitions = {
  default: `all ${durations.normal}ms ${easing.standard}`,
  fast: `all ${durations.fast}ms ${easing.standard}`,
  slow: `all ${durations.slow}ms ${easing.standard}`,
  opacity: `opacity ${durations.normal}ms ${easing.standard}`,
  transform: `transform ${durations.normal}ms ${easing.standard}`,
  colors: `color ${durations.fast}ms ${easing.standard}, background-color ${durations.fast}ms ${easing.standard}, border-color ${durations.fast}ms ${easing.standard}`,
} as const;

// Tailwind-compatible class helpers
export const motionClasses = {
  fadeIn: 'animate-fade-in',
  slideUp: 'animate-slide-up',
  float: 'animate-float',
  pulseSlow: 'animate-pulse-slow',
  glow: 'animate-glow',
} as const;

// Style objects for inline use
export const motionStyles = {
  transition: (type: keyof typeof transitions = 'default') => ({
    transition: transitions[type],
  }),
  fadeIn: {
    animation: `fadeIn ${durations.normal}ms ${easing.standard} forwards`,
  },
  slideUp: {
    animation: `slideUp ${durations.slow}ms ${easing.standard} forwards`,
  },
} as const;
