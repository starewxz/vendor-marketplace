import 'reflect-metadata';
import { validateEnv } from './env.validation';

const validConfig = {
  NODE_ENV: 'development',
  BACKEND_PORT: '3000',
  API_PREFIX: 'api',
  FRONTEND_URL: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  MEILISEARCH_URL: 'http://localhost:7700',
  MEILISEARCH_API_KEY: 'test-key',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
};

describe('validateEnv', () => {
  it('accepts a valid configuration and coerces types', () => {
    const result = validateEnv(validConfig);
    expect(result.BACKEND_PORT).toBe(3000);
    expect(result.NODE_ENV).toBe('development');
  });

  it('rejects a configuration missing required variables', () => {
    const incomplete: Record<string, unknown> = { ...validConfig };
    delete incomplete.DATABASE_URL;
    expect(() => validateEnv(incomplete)).toThrow(
      /Environment validation failed/,
    );
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() =>
      validateEnv({ ...validConfig, NODE_ENV: 'not-a-real-env' }),
    ).toThrow();
  });
});
