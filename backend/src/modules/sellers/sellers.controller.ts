import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SellersService } from './sellers.service';
import { SellerPublicDto } from './dto/seller-public.dto';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SellerPublicDto> {
    const profile = await this.sellersService.findProfileById(id);
    return SellerPublicDto.fromEntity(profile);
  }
}
