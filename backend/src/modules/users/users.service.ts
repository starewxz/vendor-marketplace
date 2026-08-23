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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
