import { Module } from '@nestjs/common';
import { SearchSyncService } from './search-sync.service';

@Module({
  providers: [SearchSyncService],
  exports: [SearchSyncService],
})
export class SearchSyncModule {}
