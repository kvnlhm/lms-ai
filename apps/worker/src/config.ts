function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Environment variable ${name} wajib diisi.`);
  }
  return value;
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export interface WorkerConfig {
  databaseUrl: string;
  redisUrl: string;
  queuePrefix: string;
  outbox: {
    /** Jeda antar-polling ketika batch sebelumnya kosong. */
    idlePollMs: number;
    batchSize: number;
    maxAttempts: number;
  };
  concurrency: {
    analytics: number;
    notifications: number;
    maintenance: number;
  };
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    databaseUrl: required('DATABASE_URL'),
    redisUrl: required('REDIS_URL'),
    queuePrefix: process.env.REDIS_QUEUE_PREFIX ?? 'lms:queue',
    outbox: {
      idlePollMs: positiveInt(process.env.OUTBOX_POLL_INTERVAL_MS, 1000),
      batchSize: positiveInt(process.env.OUTBOX_BATCH_SIZE, 100),
      maxAttempts: positiveInt(process.env.OUTBOX_MAX_ATTEMPTS, 10),
    },
    concurrency: {
      analytics: positiveInt(process.env.QUEUE_CONCURRENCY_ANALYTICS, 4),
      notifications: positiveInt(process.env.QUEUE_CONCURRENCY_NOTIFICATIONS, 4),
      maintenance: positiveInt(process.env.QUEUE_CONCURRENCY_MAINTENANCE, 2),
    },
  };
}
