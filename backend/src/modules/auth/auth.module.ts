import { Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { isGoogleOAuthConfigured } from './google-oauth.config';
import { UsersModule } from '../users/users.module';
import type { AppConfig } from '../../common/config/configuration';

// GoogleStrategy's constructor requires clientID/clientSecret — only
// registering it when configured is what lets the app boot without Google
// credentials (see google-oauth.config.ts).
const optionalProviders: Provider[] = isGoogleOAuthConfigured()
  ? [GoogleStrategy]
  : [];

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, AuthIdentity]),
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppConfig, true>) => ({
        secret: configService.get('jwt.accessSecret', { infer: true }),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiresIn', { infer: true }),
        },
      }),
    }),
    ConfigModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, ...optionalProviders],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
