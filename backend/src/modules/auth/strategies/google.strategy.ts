import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile } from 'passport-google-oauth20';
import type { AppConfig } from '../../../common/config/configuration';
import type { GoogleProfileInput } from '../auth.service';

/**
 * Only instantiated when Google credentials are configured (see
 * auth.module.ts) — its constructor throws if clientID/clientSecret are
 * missing, so it must never be registered unconditionally.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService<AppConfig, true>) {
    super({
      clientID: configService.get('google.clientId', { infer: true }),
      clientSecret: configService.get('google.clientSecret', {
        infer: true,
      }),
      callbackURL: configService.get('google.callbackUrl', {
        infer: true,
      }),
      scope: ['email', 'profile'],
    } satisfies StrategyOptions);
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): GoogleProfileInput {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      throw new Error('Google profile did not include an email address');
    }

    return {
      googleId: profile.id,
      email,
      emailVerified: profile.emails?.[0]?.verified === true,
      firstName: profile.name?.givenName ?? profile.displayName ?? 'Google',
      lastName: profile.name?.familyName ?? 'User',
    };
  }
}
