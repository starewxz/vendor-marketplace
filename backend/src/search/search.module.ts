import { Global, Module } from '@nestjs/common';
import { MeilisearchService } from './meilisearch.service';
import { SEARCH_INDEX_PORT } from './search-index.interface';

@Global()
@Module({
  providers: [{ provide: SEARCH_INDEX_PORT, useClass: MeilisearchService }],
  exports: [SEARCH_INDEX_PORT],
})
export class SearchModule {}
