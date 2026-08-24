import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '../modules/users/entities/user-role.enum';
import { SocketAuthService } from './socket-auth.service';

describe('SocketAuthService', () => {
  const jwt = { verifyAsync: jest.fn() };
  const config = { get: jest.fn().mockReturnValue('secret') };
  const users = { findById: jest.fn() };
  const sellers = { findProfileByUserId: jest.fn() };
  const service = new SocketAuthService(
    jwt as never,
    config as never,
    users as never,
    sellers as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows a public connection when no token is supplied', async () => {
    await expect(
      service.authenticate({ handshake: { auth: {} } } as never),
    ).resolves.toBeNull();
  });

  it('derives user, role and seller room identity from verified server state', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    users.findById.mockResolvedValue({
      id: 'user-1',
      role: UserRole.SELLER,
      isActive: true,
    });
    sellers.findProfileByUserId.mockResolvedValue({ id: 'seller-1' });

    await expect(
      service.authenticate({ handshake: { auth: { token: 'jwt' } } } as never),
    ).resolves.toEqual({
      userId: 'user-1',
      role: UserRole.SELLER,
      sellerProfileId: 'seller-1',
    });
  });

  it('rejects invalid or expired tokens instead of downgrading to public', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('expired'));
    await expect(
      service.authenticate({
        handshake: { auth: { token: 'expired' } },
      } as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
