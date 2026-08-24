import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import type { AppConfig } from '../common/config/configuration';
import type { JwtPayload } from '../modules/auth/types/jwt-payload';
import { SellersService } from '../modules/sellers/sellers.service';
import { UserRole } from '../modules/users/entities/user-role.enum';
import { UsersService } from '../modules/users/users.service';
import type { SocketIdentity } from './realtime.types';

@Injectable()
export class SocketAuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly usersService: UsersService,
    private readonly sellersService: SellersService,
  ) {}

  async authenticate(socket: Socket): Promise<SocketIdentity | null> {
    const handshakeAuth = socket.handshake.auth as Record<string, unknown>;
    const raw = handshakeAuth.token;
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw !== 'string') {
      throw new UnauthorizedException('Invalid socket access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(raw, {
        secret: this.config.get('jwt.accessSecret', { infer: true }),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user.isActive) throw new Error('inactive user');

      const sellerProfile =
        user.role === UserRole.SELLER
          ? await this.sellersService.findProfileByUserId(user.id)
          : null;
      return {
        userId: user.id,
        role: user.role,
        sellerProfileId: sellerProfile?.id ?? null,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired socket access token');
    }
  }
}
