import { QUEUE_NAMES } from './queue-names';

describe('queue names', () => {
  it('sesuai queue group pada ADR-012', () => {
    expect(QUEUE_NAMES).toEqual([
      'critical',
      'notifications',
      'analytics',
      'reports',
      'media',
      'ai',
      'maintenance',
    ]);
  });
});
