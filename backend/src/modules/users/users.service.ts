import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserRole } from './entities/user-role.enum';

export interface CreateUserInput {
  email: string;
  passwordHash: string | null;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified?: boolean;
}

export interface SyncSeedAdminInput {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
}

export interface SyncSeedAdminResult {
  user: User;
  created: boolean;
  /** Whether role/name/verification changed for an existing account — does
   * not cover passwordHash, since a freshly-salted bcrypt hash never
   * string-equals the previous one even for the same plaintext; the caller
   * (which holds the plaintext) is responsible for deciding whether the
   * password itself actually changed. */
  profileChanged: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: this.normalizeEmail(email) },
    });
  }

  /** passwordHash has `select: false` on the entity — must opt in explicitly for login. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      ...input,
      email: this.normalizeEmail(input.email),
      isEmailVerified: input.isEmailVerified ?? false,
    });
    return this.usersRepository.save(user);
  }

  async setRole(userId: string, role: UserRole): Promise<void> {
    await this.usersRepository.update({ id: userId }, { role });
  }

  /**
   * Backend-only, narrowly scoped to the `seed:admin` script: creates the
   * development admin if it doesn't exist yet, or brings an existing
   * account's name/password/role/verification in line with the current
   * seed input. Deliberately not a generic "update user" path — the exact
   * fixed set of fields it touches (firstName, lastName, passwordHash,
   * role, isEmailVerified) is not client-controllable from any controller.
   */
  async syncSeedAdmin(input: SyncSeedAdminInput): Promise<SyncSeedAdminResult> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.findByEmail(email);

    if (!existing) {
      const user = await this.create({
        email,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.ADMIN,
        isEmailVerified: true,
      });
      return { user, created: true, profileChanged: true };
    }

    const profileChanged =
      existing.role !== UserRole.ADMIN ||
      existing.firstName !== input.firstName ||
      existing.lastName !== input.lastName ||
      !existing.isEmailVerified;

    // Password is always (re)written for an existing account: this is an
    // explicit sync command, not an automatic startup check, and a bcrypt
    // hash is salted per-call so there's no cheap way to tell "unchanged"
    // apart from "changed" here without the plaintext.
    await this.usersRepository.update(
      { id: existing.id },
      {
        role: UserRole.ADMIN,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        isEmailVerified: true,
      },
    );

    const user = await this.findById(existing.id);
    return { user, created: false, profileChanged };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
