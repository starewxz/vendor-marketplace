import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from './entities/refresh-token.entity';

/**
 * Placeholder for Stage 2: password/Google OAuth login, JWT issuance, and
 * refresh-token rotation. Only the repository wiring exists today so the
 * module boundary and entity are in place without faking auth behavior.
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}
}
