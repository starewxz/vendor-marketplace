import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerProfile } from './entities/seller-profile.entity';
import { SellerApplication } from './entities/seller-application.entity';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { SellerApplicationsController } from './seller-applications.controller';
import { AdminSellerApplicationsController } from './admin-seller-applications.controller';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SellerProfile, SellerApplication]),
    OutboxModule,
  ],
  controllers: [
    SellersController,
    SellerApplicationsController,
    AdminSellerApplicationsController,
  ],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
