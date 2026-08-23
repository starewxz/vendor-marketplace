import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';

/**
 * Used exclusively by the TypeORM CLI (migration generate/run/revert).
 * The running application gets its config from TypeOrmModule.forRootAsync
 * in database.module.ts instead — kept separate because the CLI can't
 * consume Nest's DI container.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://marketplace:marketplace@localhost:5432/marketplace',
  entities: ALL_ENTITIES,
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
