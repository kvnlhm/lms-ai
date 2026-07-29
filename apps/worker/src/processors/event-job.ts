/** Bentuk job yang dikirim relay outbox ke setiap antrean. */
export interface EventJob {
  eventId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  schemaVersion: number;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

export function readNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
