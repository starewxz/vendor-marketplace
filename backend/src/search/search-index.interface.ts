/**
 * Provider-agnostic contract for catalog search. ProductService (and any
 * future indexable domain) depends on this interface, never on Meilisearch
 * directly — swapping providers later means writing a new implementation,
 * not touching callers.
 *
 * Callers must never invoke this directly from a write path (e.g.
 * ProductService.create). The intended flow is:
 *   DB transaction -> OutboxEvent -> BullMQ job -> processor calls this.
 * See README "Consistency model" for why.
 */
export interface SearchIndexPort {
  indexDocument(
    index: string,
    document: Record<string, unknown>,
  ): Promise<void>;
  deleteDocument(index: string, documentId: string): Promise<void>;
  search<T extends Record<string, unknown> = Record<string, unknown>>(
    index: string,
    query: string,
    options?: { limit?: number; offset?: number; filter?: string },
  ): Promise<{ hits: T[]; estimatedTotalHits: number }>;
}

export const SEARCH_INDEX_PORT = Symbol('SEARCH_INDEX_PORT');
