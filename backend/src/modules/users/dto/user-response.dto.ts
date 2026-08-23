import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../entities/user-role.enum';
import { User } from '../entities/user.entity';

/**
 * Never return the User entity directly from a controller — passwordHash is
 * excluded from default queries via `select: false`, but this DTO makes the
 * omission explicit and stops a future `relations`/`select` change from
 * accidentally leaking it.
 */
export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() firstName: string;
  @ApiProperty() lastName: string;
  @ApiProperty({ enum: UserRole }) role: UserRole;
  @ApiProperty() isEmailVerified: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.role = user.role;
    dto.isEmailVerified = user.isEmailVerified;
    dto.createdAt = user.createdAt;
    return dto;
  }
}
