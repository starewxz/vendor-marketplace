export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  frontendUrl: string;
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  meilisearch: {
    url: string;
    apiKey: string;
  };
  jwt: {
    accessSecret: string;
    accessExpiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  rateLimit: {
    ttlSeconds: number;
    maxRequests: number;
  };
  logLevel: string;
  google: {
    clientId: string | null;
    clientSecret: string | null;
    callbackUrl: string | null;
  };
  auctions: {
    purchaseWindowMinutes: number;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.BACKEND_PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  database: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://marketplace:marketplace@localhost:5432/marketplace',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  meilisearch: {
    url: process.env.MEILISEARCH_URL ?? 'http://localhost:7700',
    apiKey: process.env.MEILISEARCH_API_KEY ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'changeme_access_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'changeme_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  rateLimit: {
    ttlSeconds: parseInt(process.env.RATE_LIMIT_TTL_SECONDS ?? '60', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100', 10),
  },
  logLevel: process.env.LOG_LEVEL ?? 'debug',
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID ?? null,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? null,
    callbackUrl: process.env.GOOGLE_OAUTH_CALLBACK_URL ?? null,
  },
  auctions: {
    purchaseWindowMinutes: parseInt(
      process.env.AUCTION_PURCHASE_WINDOW_MINUTES ?? '30',
      10,
    ),
  },
});
