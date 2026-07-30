import { PaymentOrderStatus } from '@prisma/client';
import { amountMatches, mapPaymentStatus, normalizePhone } from './commerce.service';

const baseStatus = {
  order_id: 'REG-test',
  status_code: '200',
  gross_amount: '999000.00',
  transaction_status: 'settlement',
};

describe('commerce payment rules', () => {
  it('only marks a successful, non-challenged settlement as paid', () => {
    expect(mapPaymentStatus(baseStatus)).toBe(PaymentOrderStatus.PAID);
    expect(mapPaymentStatus({ ...baseStatus, fraud_status: 'challenge' })).toBe(
      PaymentOrderStatus.PENDING,
    );
    expect(mapPaymentStatus({ ...baseStatus, transaction_status: 'deny' })).toBe(
      PaymentOrderStatus.CANCELLED,
    );
  });

  it('maps terminal provider states without granting access', () => {
    expect(mapPaymentStatus({ ...baseStatus, transaction_status: 'expire' })).toBe(
      PaymentOrderStatus.EXPIRED,
    );
    expect(mapPaymentStatus({ ...baseStatus, transaction_status: 'refund' })).toBe(
      PaymentOrderStatus.REFUNDED,
    );
  });

  it('compares the provider amount to the server-side snapshot', () => {
    expect(amountMatches('999000.00', 999000)).toBe(true);
    expect(amountMatches('999001.00', 999000)).toBe(false);
    expect(amountMatches('999000.40', 999000)).toBe(false);
    expect(amountMatches('invalid', 999000)).toBe(false);
  });

  it('normalizes common Indonesian phone input', () => {
    expect(normalizePhone('0812-3456-7890')).toBe('6281234567890');
    expect(normalizePhone('+62 812 3456 7890')).toBe('6281234567890');
  });
});
