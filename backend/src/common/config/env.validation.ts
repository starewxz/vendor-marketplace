import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  BACKEND_PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'api';

  @IsString()
  FRONTEND_URL: string = 'http://localhost:5173';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  MEILISEARCH_URL: string = 'http://localhost:7700';

  @IsString()
  MEILISEARCH_API_KEY: string;

  @IsString()
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL_SECONDS: number = 60;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX_REQUESTS: number = 100;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'debug';
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((error) => Object.values(error.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
