/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment -- jest.fn() mock typing */
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthIdentity } from './entities/auth-identity.entity';
import { AuthProvider } from './entities/auth-provider.enum';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/entities/user-role.enum';
import type { User } from '../users/entities/user.entity';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    passwordHash: null,
    firstName: 'Jane',
    lastName: 'Doe',
    role: UserRole.CUSTOMER,
    isEmailVerified: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'findByEmailWithPassword' | 'create' | 'findById'
    >
  >;
  let authIdentitiesRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let refreshTokensRepository: {
    manager: { transaction: jest.Mock };
    update: jest.Mock;
  };
  let fakeManager: {
    createQueryBuilder: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      findByEmailWithPassword: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
    };
    authIdentitiesRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((x) => x),
    };

    fakeManager = {
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((x) => x),
      create: jest.fn((_entity, data) => data),
    };
    refreshTokensRepository = {
      manager: {
        ...fakeManager,
        transaction: jest.fn((cb: (m: unknown) => unknown) => cb(fakeManager)),
      },
      update: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: refreshTokensRepository,
        },
        {
          provide: getRepositoryToken(AuthIdentity),
          useValue: authIdentitiesRepository,
        },
        { provide: UsersService, useValue: usersService },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'jwt.refreshExpiresIn') return '7d';
              if (key === 'jwt.accessSecret') return 'secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  describe('register', () => {
    it('creates a CUSTOMER account and issues tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const created = buildUser();
      usersService.create.mockResolvedValue(created);

      const result = await authService.register(
        {
          email: 'jane@example.com',
          password: 'Str0ngPass',
          firstName: 'Jane',
          lastName: 'Doe',
        },
        { userAgent: null, ipAddress: null },
      );

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.CUSTOMER,
          email: 'jane@example.com',
        }),
      );
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
      expect(result.tokens.refreshToken).toHaveLength(64); // 32 bytes hex
    });

    it('rejects duplicate emails with 409', async () => {
      usersService.findByEmail.mockResolvedValue(buildUser());

      await expect(
        authService.register(
          {
            email: 'jane@example.com',
            password: 'Str0ngPass',
            firstName: 'Jane',
            lastName: 'Doe',
          },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('login', () => {
    it('succeeds with correct credentials', async () => {
      const passwordHash = await bcrypt.hash('Str0ngPass', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        buildUser({ passwordHash }),
      );

      const result = await authService.login(
        { email: 'jane@example.com', password: 'Str0ngPass' },
        { userAgent: null, ipAddress: null },
      );

      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });

    it('rejects a wrong password without revealing which field was wrong', async () => {
      const passwordHash = await bcrypt.hash('Str0ngPass', 4);
      usersService.findByEmailWithPassword.mockResolvedValue(
        buildUser({ passwordHash }),
      );

      await expect(
        authService.login(
          { email: 'jane@example.com', password: 'wrong' },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow('Invalid email or password');
    });

    it('rejects a nonexistent email with the same generic error', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);

      await expect(
        authService.login(
          { email: 'nobody@example.com', password: 'x' },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toThrow('Invalid email or password');
    });

    it('rejects a Google-only account (no password) attempting local login', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(
        buildUser({ passwordHash: null }),
      );

      await expect(
        authService.login(
          { email: 'jane@example.com', password: 'x' },
          { userAgent: null, ipAddress: null },
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('rotates a valid token: revokes the old one and issues a new one', async () => {
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'rt-1',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() + 100_000),
        }),
      };
      fakeManager.createQueryBuilder.mockReturnValue(qb);
      fakeManager.findOne.mockResolvedValue(buildUser());

      const result = await authService.refresh('plain-token', {
        userAgent: null,
        ipAddress: null,
      });

      expect(fakeManager.update).toHaveBeenCalledWith(
        RefreshToken,
        { id: 'rt-1' },
        { revokedAt: expect.any(Date) },
      );
      expect(result.tokens.accessToken).toBe('signed.jwt.token');
    });

    it('rejects an unknown token', async () => {
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      fakeManager.createQueryBuilder.mockReturnValue(qb);

      await expect(
        authService.refresh('bogus', { userAgent: null, ipAddress: null }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('detects reuse of an already-revoked token and revokes all tokens for that user', async () => {
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'rt-1',
          userId: 'user-1',
          revokedAt: new Date(),
          expiresAt: new Date(Date.now() + 100_000),
        }),
      };
      fakeManager.createQueryBuilder.mockReturnValue(qb);

      await expect(
        authService.refresh('stolen-token', {
          userAgent: null,
          ipAddress: null,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fakeManager.update).toHaveBeenCalledWith(
        RefreshToken,
        { userId: 'user-1' },
        { revokedAt: expect.any(Date) },
      );
    });

    it('rejects an expired token', async () => {
      const qb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'rt-1',
          userId: 'user-1',
          revokedAt: null,
          expiresAt: new Date(Date.now() - 1000),
        }),
      };
      fakeManager.createQueryBuilder.mockReturnValue(qb);

      await expect(
        authService.refresh('expired', { userAgent: null, ipAddress: null }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the presented refresh token', async () => {
      await authService.logout('some-token');
      expect(refreshTokensRepository.update).toHaveBeenCalledWith(
        { tokenHash: expect.any(String) },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('findOrCreateFromGoogleProfile', () => {
    const profile = {
      googleId: 'google-123',
      email: 'jane@example.com',
      emailVerified: true,
      firstName: 'Jane',
      lastName: 'Doe',
    };

    it('creates a new CUSTOMER account when no user or identity exists', async () => {
      authIdentitiesRepository.findOne.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(buildUser());

      await authService.findOrCreateFromGoogleProfile(profile);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: null, isEmailVerified: true }),
      );
      expect(authIdentitiesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: AuthProvider.GOOGLE,
          providerUserId: 'google-123',
        }),
      );
    });

    it('links an existing account with the same email instead of creating a duplicate user', async () => {
      authIdentitiesRepository.findOne.mockResolvedValue(null);
      const existing = buildUser();
      usersService.findByEmail.mockResolvedValue(existing);

      await authService.findOrCreateFromGoogleProfile(profile);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(authIdentitiesRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: existing.id,
          provider: AuthProvider.GOOGLE,
        }),
      );
    });

    it('returns the linked user directly when the identity already exists (normal login)', async () => {
      authIdentitiesRepository.findOne.mockResolvedValue({ userId: 'user-1' });
      usersService.findById.mockResolvedValue(buildUser());

      const user = await authService.findOrCreateFromGoogleProfile(profile);

      expect(user.id).toBe('user-1');
      expect(usersService.create).not.toHaveBeenCalled();
      expect(authIdentitiesRepository.save).not.toHaveBeenCalled();
    });

    it('refuses to merge on an unverified Google email', async () => {
      authIdentitiesRepository.findOne.mockResolvedValue(null);

      await expect(
        authService.findOrCreateFromGoogleProfile({
          ...profile,
          emailVerified: false,
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });
  });
});
