import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken])],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
