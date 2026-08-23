import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplication } from './entities/seller-application.entity';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SellerProfile, SellerApplication])],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
