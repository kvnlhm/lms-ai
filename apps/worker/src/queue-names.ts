export const QUEUE_NAMES = [
  'critical',
  'notifications',
  'analytics',
  'reports',
  'media',
  'ai',
  'maintenance',
] as const;

export type QueueName = (typeof QUEUE_NAMES)[number];
