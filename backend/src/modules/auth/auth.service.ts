import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { AuthProvider } from './entities/auth-provider.enum';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.enum';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { parseDurationToMs } from './utils/parse-duration';
import type { AppConfig } from '../../common/config/configuration';
import type { JwtPayload } from './types/jwt-payload';

const BCRYPT_SALT_ROUNDS = 12;

export interface RequestMeta {
  userAgent: string | null;
  ipAddress: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleProfileInput {
  googleId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
    @InjectRepository(AuthIdentity)
    private readonly authIdentitiesRepository: Repository<AuthIdentity>,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async register(
    dto: RegisterDto,
    meta: RequestMeta,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: UserRole.CUSTOMER,
    });

    this.logger.log({ msg: 'user registered', userId: user.id });
    const tokens = await this.issueTokens(user, meta);
    return { user, tokens };
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);

    // Same generic error whether the email doesn't exist, the account has
    // no local password (Google-only), or the password is wrong — never
    // reveal which case it was.
    if (
      !user?.passwordHash ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      this.logger.warn({ msg: 'login failed', email: dto.email });
      throw new UnauthorizedException('Invalid email or password');
    }

    this.logger.log({ msg: 'login succeeded', userId: user.id });
    const tokens = await this.issueTokens(user, meta);
    return { user, tokens };
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a new one
   * issued in its place. If the presented token was already revoked, that
   * means it was replayed after rotation (theft or a race) — every token
   * for that user is revoked as a precaution and the caller is signed out.
   */
  async refresh(
    plainRefreshToken: string,
    meta: RequestMeta,
  ): Promise<{ user: User; tokens: IssuedTokens }> {
    const tokenHash = this.hashToken(plainRefreshToken);

    const { user, tokens } =
      await this.refreshTokensRepository.manager.transaction(
        async (manager) => {
          const existing = await manager
            .createQueryBuilder(RefreshToken, 'rt')
            .setLock('pessimistic_write')
            .where('rt.tokenHash = :tokenHash', { tokenHash })
            .getOne();

          if (!existing) {
            throw new UnauthorizedException('Invalid refresh token');
          }

          if (existing.revokedAt || existing.expiresAt < new Date()) {
            if (existing.revokedAt) {
              this.logger.warn({
                msg: 'refresh token reuse detected',
                userId: existing.userId,
              });
              await manager.update(
                RefreshToken,
                { userId: existing.userId },
                { revokedAt: new Date() },
              );
            }
            throw new UnauthorizedException('Refresh token is no longer valid');
          }

          const foundUser = await manager.findOne(User, {
            where: { id: existing.userId },
          });
          if (!foundUser) {
            throw new UnauthorizedException('Invalid refresh token');
          }

          await manager.update(
            RefreshToken,
            { id: existing.id },
            { revokedAt: new Date() },
          );

          const newTokens = await this.issueTokens(foundUser, meta, manager);
          this.logger.log({ msg: 'refresh performed', userId: foundUser.id });
          return { user: foundUser, tokens: newTokens };
        },
      );

    return { user, tokens };
  }

  async logout(plainRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(plainRefreshToken);
    await this.refreshTokensRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
    this.logger.log({ msg: 'logout' });
  }

  /**
   * Finds-or-creates the local User for a verified Google profile and
   * ensures a linked AuthIdentity row exists.
   *
   * - No user with this email and no existing GOOGLE identity: create a new
   *   CUSTOMER account (no password) and link it.
   * - A user with this email already exists (registered locally or via
   *   another flow) and has no GOOGLE identity yet: link it to that
   *   existing account rather than creating a duplicate user.
   * - The GOOGLE identity is already linked: return that user (normal
   *   login).
   *
   * Google's email is only trusted here because `emailVerified` is checked
   * by the caller before this is invoked — unverified provider emails must
   * never merge into an existing account.
   */
  async findOrCreateFromGoogleProfile(
    profile: GoogleProfileInput,
  ): Promise<User> {
    const existingIdentity = await this.authIdentitiesRepository.findOne({
      where: {
        provider: AuthProvider.GOOGLE,
        providerUserId: profile.googleId,
      },
    });
    if (existingIdentity) {
      return this.usersService.findById(existingIdentity.userId);
    }

    if (!profile.emailVerified) {
      throw new UnauthorizedException('Google account email is not verified');
    }

    let user = await this.usersService.findByEmail(profile.email);
    if (!user) {
      user = await this.usersService.create({
        email: profile.email,
        passwordHash: null,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: UserRole.CUSTOMER,
        isEmailVerified: true,
      });
      this.logger.log({
        msg: 'user registered',
        userId: user.id,
        provider: 'GOOGLE',
      });
    }

    await this.authIdentitiesRepository.save(
      this.authIdentitiesRepository.create({
        userId: user.id,
        provider: AuthProvider.GOOGLE,
        providerUserId: profile.googleId,
      }),
    );
    this.logger.log({ msg: 'google account linked', userId: user.id });

    return user;
  }

  async issueTokens(
    user: User,
    meta: RequestMeta,
    manager = this.refreshTokensRepository.manager,
  ): Promise<IssuedTokens> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    const plainRefreshToken = randomBytes(32).toString('hex');
    const refreshExpiresIn = this.configService.get('jwt.refreshExpiresIn', {
      infer: true,
    });
    const expiresAt = new Date(
      Date.now() + parseDurationToMs(refreshExpiresIn),
    );

    await manager.save(
      manager.create(RefreshToken, {
        userId: user.id,
        tokenHash: this.hashToken(plainRefreshToken),
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      }),
    );

    return { accessToken, refreshToken: plainRefreshToken };
  }

  getRefreshCookieMaxAgeMs(): number {
    return parseDurationToMs(
      this.configService.get('jwt.refreshExpiresIn', { infer: true }),
    );
  }

  private hashToken(plainToken: string): string {
    return createHash('sha256').update(plainToken).digest('hex');
  }
}
