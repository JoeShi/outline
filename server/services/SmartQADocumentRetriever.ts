import type User from "@server/models/User";
import Logger from "@server/logging/Logger";
import SearchProviderManager from "@server/utils/SearchProviderManager";
import { StatusFilter } from "@shared/types";

/**
 * Represents a document retrieved for Smart QA context.
 */
export interface RetrievedDocument {
  /** Document UUID */
  id: string;
  /** Document title */
  title: string;
  /** Document relative path (e.g. /doc/slug-xxx) */
  url: string;
  /** Document text content (Markdown) */
  content: string;
  /** Search relevance ranking */
  ranking: number;
}

/** Maximum number of documents to retrieve for QA context. */
const MAX_RESULTS = 25;

/**
 * Service responsible for retrieving documents relevant to a user's question
 * for use as context in the Smart QA RAG pipeline.
 *
 * Reuses the existing SearchProviderManager infrastructure, which handles:
 * - Full-text search with relevance ranking
 * - User permission filtering (Collection membership + document-level permissions)
 *
 * Additional filtering ensures only published, non-archived, non-deleted
 * documents are included in QA context.
 */
class SmartQADocumentRetriever {
  /**
   * Retrieve documents the user has access to that are relevant to the query.
   *
   * @param user - The authenticated user performing the query.
   * @param query - The user's question text.
   * @returns Up to 25 relevant documents sorted by relevance ranking.
   * @throws Error when the search service encounters an error.
   */
  async retrieve(user: User, query: string): Promise<RetrievedDocument[]> {
    try {
      const provider = SearchProviderManager.getProvider();

      const { results } = await provider.searchForUser(user, {
        query,
        limit: MAX_RESULTS,
        statusFilter: [StatusFilter.Published],
      });

      // Filter results to ensure only valid documents are included:
      // - publishedAt IS NOT NULL (handled by StatusFilter.Published)
      // - archivedAt IS NULL (handled by StatusFilter.Published)
      // - deletedAt IS NULL (handled by searchForUser's buildWhere base clause)
      // Apply explicit post-filter as a safety net
      const filteredResults = results.filter(({ document }) => {
        return (
          document.publishedAt !== null &&
          document.archivedAt === null &&
          document.deletedAt === null
        );
      });

      // Map to RetrievedDocument interface, sorted by ranking (most relevant first)
      return filteredResults
        .sort((a, b) => b.ranking - a.ranking)
        .slice(0, MAX_RESULTS)
        .map(({ document, ranking }) => ({
          id: document.id,
          title: document.title,
          url: document.path,
          content: document.text,
          ranking,
        }));
    } catch (error) {
      Logger.error(
        "SmartQA document retrieval failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          userId: user.id,
          query,
        }
      );
      throw new Error(
        `Document retrieval failed: ${error instanceof Error ? error.message : "Search service unavailable"}`
      );
    }
  }
}

export default SmartQADocumentRetriever;
