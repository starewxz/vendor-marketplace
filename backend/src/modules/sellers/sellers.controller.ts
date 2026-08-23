import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { SellerProfile } from './entities/seller-profile.entity';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<SellerProfile> {
    return this.sellersService.findProfileById(id);
  }
}
