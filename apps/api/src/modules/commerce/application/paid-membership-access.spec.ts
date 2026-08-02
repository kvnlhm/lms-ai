import { mergeMembershipWindows } from './paid-membership-access.service';

describe('course publishing membership access', () => {
  it('keeps the longest paid access window for each user', () => {
    const shorter = new Date('2027-01-01T00:00:00.000Z');
    const longer = new Date('2027-07-01T00:00:00.000Z');
    const result = mergeMembershipWindows([
      { provisionedUserId: 'user-1', accessEndsAt: shorter },
      { provisionedUserId: 'user-1', accessEndsAt: longer },
    ]);

    expect(result.get('user-1')).toEqual(longer);
  });

  it('treats one lifetime purchase as lifetime access', () => {
    const result = mergeMembershipWindows([
      { provisionedUserId: 'user-1', accessEndsAt: new Date('2027-01-01T00:00:00.000Z') },
      { provisionedUserId: 'user-1', accessEndsAt: null },
      { provisionedUserId: 'user-1', accessEndsAt: new Date('2028-01-01T00:00:00.000Z') },
      { provisionedUserId: null, accessEndsAt: null },
    ]);

    expect(result.get('user-1')).toBeNull();
    expect(result.size).toBe(1);
  });
});
