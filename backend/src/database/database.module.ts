import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../common/config/configuration';
import { ALL_ENTITIES } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        type: 'postgres',
        url: configService.get('database.url', { infer: true }),
        entities: ALL_ENTITIES,
        migrations: [__dirname + '/migrations/*.{ts,js}'],
        // Schema changes always go through migrations, never auto-sync —
        // required for production safety and predictable deploys.
        synchronize: false,
        migrationsRun: false,
        logging:
          configService.get('nodeEnv', { infer: true }) === 'development',
      }),
    }),
  ],
})
export class DatabaseModule {}
