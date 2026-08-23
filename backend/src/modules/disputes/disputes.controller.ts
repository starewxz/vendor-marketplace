import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { Dispute } from './entities/dispute.entity';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Get(':id')
  findById(@Param('id', ParseUUIDPipe) id: string): Promise<Dispute> {
    return this.disputesService.findById(id);
  }
}
