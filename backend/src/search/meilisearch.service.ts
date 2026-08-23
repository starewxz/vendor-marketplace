import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Meilisearch } from 'meilisearch';
import type { EnqueuedTaskPromise, Task } from 'meilisearch';
import { AppConfig } from '../common/config/configuration';
import {
  IndexSettings,
  SearchIndexPort,
  SearchOptions,
  SearchResult,
} from './search-index.interface';

/** Callers rely on this to fail fast (see CatalogService's fallback) rather than hang if Meilisearch is unreachable. */
const REQUEST_TIMEOUT_MS = 2000;
const TASK_WAIT_TIMEOUT_MS = 5000;

/**
 * Every document indexed through this port must have an `id` field — the
 * primary key is declared explicitly rather than left to Meilisearch's
 * auto-detection, which fails outright when a document has more than one
 * field ending in "id" (e.g. our products also have sellerId/categoryId).
 */
const PRIMARY_KEY = 'id';

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

/**
 * Meilisearch's write endpoints (add/delete documents) return as soon as
 * the task is *enqueued*, not once it's actually applied — a task can still
 * fail afterwards (bad primary key, malformed document, ...) without the
 * original call ever rejecting. Waiting for the task and checking its
 * status turns that into a normal thrown error our retry/idempotency logic
 * already knows how to handle, instead of a silent no-op.
 */
async function waitAndVerify(
  enqueued: EnqueuedTaskPromise,
  label: string,
  ignoreErrorCodes: string[] = [],
): Promise<void> {
  const task: Task = await withTimeout(
    enqueued.waitTask({ timeout: TASK_WAIT_TIMEOUT_MS }),
    TASK_WAIT_TIMEOUT_MS + 500,
    label,
  );
  if (
    task.status === 'failed' &&
    !ignoreErrorCodes.includes(task.error?.code ?? '')
  ) {
    throw new Error(
      `${label} failed: ${task.error?.message ?? 'unknown Meilisearch task error'}`,
    );
  }
}

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
    await waitAndVerify(
      this.client
        .index(index)
        .addDocuments([document], { primaryKey: PRIMARY_KEY }),
      'indexDocument',
    );
  }

  async indexDocuments(
    index: string,
    documents: Record<string, unknown>[],
  ): Promise<void> {
    await waitAndVerify(
      this.client
        .index(index)
        .addDocuments(documents, { primaryKey: PRIMARY_KEY }),
      'indexDocuments',
    );
  }

  async deleteDocument(index: string, documentId: string): Promise<void> {
    await waitAndVerify(
      this.client.index(index).deleteDocument(documentId),
      'deleteDocument',
    );
  }

  async search<T extends Record<string, unknown> = Record<string, unknown>>(
    index: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchResult<T>> {
    const result = await withTimeout(
      this.client.index<T>(index).search(query, {
        limit: options?.limit,
        offset: options?.offset,
        filter: options?.filter,
        sort: options?.sort,
        facets: options?.facets,
      }),
      REQUEST_TIMEOUT_MS,
      'search',
    );
    return {
      hits: result.hits,
      estimatedTotalHits: result.estimatedTotalHits ?? 0,
      facetDistribution: result.facetDistribution,
    };
  }

  async configureIndex(index: string, settings: IndexSettings): Promise<void> {
    // Ensures the index (and its primary key) exists even before the first
    // document is written. Meilisearch fails index creation outright if the
    // index already exists — that's the expected, idempotent-rerun case
    // here, so it's the one error code we deliberately swallow.
    await waitAndVerify(
      this.client.createIndex(index, { primaryKey: PRIMARY_KEY }),
      'createIndex',
      ['index_already_exists'],
    );

    const idx = this.client.index(index);
    await Promise.all([
      settings.searchableAttributes
        ? waitAndVerify(
            idx.updateSearchableAttributes(settings.searchableAttributes),
            'updateSearchableAttributes',
          )
        : null,
      settings.filterableAttributes
        ? waitAndVerify(
            idx.updateFilterableAttributes(settings.filterableAttributes),
            'updateFilterableAttributes',
          )
        : null,
      settings.sortableAttributes
        ? waitAndVerify(
            idx.updateSortableAttributes(settings.sortableAttributes),
            'updateSortableAttributes',
          )
        : null,
    ]);
  }
}
