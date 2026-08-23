import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserResponseDto } from './dto/user-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedRequestUser } from '../auth/types/jwt-payload';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the currently authenticated user' })
  async me(
    @CurrentUser() currentUser: AuthenticatedRequestUser,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(currentUser.id);
    return UserResponseDto.fromEntity(user);
  }

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findById(id);
  }
}
