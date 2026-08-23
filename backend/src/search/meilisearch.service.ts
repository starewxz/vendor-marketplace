import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';
import { AppConfig } from '../common/config/configuration';
import { SearchIndexPort } from './search-index.interface';

@Injectable()
export class MeilisearchService implements SearchIndexPort {
  private readonly client: Meilisearch;

  constructor(configService: ConfigService<AppConfig, true>) {
    this.client = new Meilisearch({
      host: configService.get('meilisearch.url', { infer: true }),
      apiKey: configService.get('meilisearch.apiKey', { infer: true }),
    });
  }

  async indexDocument(
    index: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    await this.client.index(index).addDocuments([document]);
  }

  async deleteDocument(index: string, documentId: string): Promise<void> {
    await this.client.index(index).deleteDocument(documentId);
  }

  async search<T extends Record<string, unknown> = Record<string, unknown>>(
    index: string,
    query: string,
    options?: { limit?: number; offset?: number; filter?: string },
  ): Promise<{ hits: T[]; estimatedTotalHits: number }> {
    const result = await this.client.index<T>(index).search(query, options);
    return {
      hits: result.hits,
      estimatedTotalHits: result.estimatedTotalHits ?? 0,
    };
  }
}
