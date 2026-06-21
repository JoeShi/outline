import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Document, Event } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { BaseTask } from "@server/queues/tasks/base/BaseTask";
import Logger from "@server/logging/Logger";
import env from "../env";

/**
 * Maximum number of characters to send to the Bedrock model.
 * Claude Sonnet supports roughly 200k tokens; 150k characters provides
 * a safe margin while covering the vast majority of documents.
 */
const MAX_INPUT_CHARACTERS = 150_000;

type Props = {
  /** The ID of the document to summarize */
  documentId: string;
  /** The ID of the user who triggered the summary generation */
  userId: string;
};

/**
 * A background task that generates an AI summary for a document using
 * Amazon Bedrock (Claude Sonnet model) and stores it in the document's
 * summary field.
 */
export default class AISummaryTask extends BaseTask<Props> {
  public async perform({ documentId, userId }: Props): Promise<void> {
    const document = await Document.findByPk(documentId);

    if (!document) {
      Logger.warn("AISummaryTask: Document not found", { documentId });
      return;
    }

    const plainText = DocumentHelper.toPlainText(document);

    if (!plainText || plainText.trim().length === 0) {
      Logger.info("AISummaryTask: Document has no text content", {
        documentId,
      });
      return;
    }

    // Truncate input to stay within model context window limits
    const truncatedText = plainText.slice(0, MAX_INPUT_CHARACTERS);

    const summary = await this.generateSummary(truncatedText, documentId);

    if (!summary) {
      return;
    }

    document.summary = summary;
    await document.save();

    await Event.create({
      name: "documents.update",
      documentId: document.id,
      collectionId: document.collectionId,
      teamId: document.teamId,
      actorId: userId,
      data: { title: document.title },
    });
  }

  /**
   * Call the Amazon Bedrock API to generate a summary of the given text.
   * Catches non-retryable errors (4xx) and returns undefined to prevent
   * futile retries. Retryable errors (5xx, network) are re-thrown so the
   * task queue can retry with exponential backoff.
   *
   * @param text - The plain text content of the document (already truncated).
   * @param documentId - The document ID for logging context.
   * @returns A summary string (2-3 sentences), or undefined on permanent failure.
   */
  private async generateSummary(
    text: string,
    documentId: string
  ): Promise<string | undefined> {
    const client = new BedrockRuntimeClient({
      region: env.AI_SUMMARY_BEDROCK_REGION,
      credentials: env.AI_SUMMARY_BEDROCK_ACCESS_KEY_ID
        ? {
            accessKeyId: env.AI_SUMMARY_BEDROCK_ACCESS_KEY_ID,
            secretAccessKey: env.AI_SUMMARY_BEDROCK_SECRET_ACCESS_KEY ?? "",
          }
        : undefined,
    });

    const prompt = `Summarize the following document in 2-3 concise sentences:\n\n${text}`;

    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId: env.AI_SUMMARY_BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    try {
      const response = await client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      const summaryText: string = responseBody.content?.[0]?.text ?? "";

      // Truncate to 1000 characters (Document.summary max length)
      return summaryText.slice(0, 1000);
    } catch (err: unknown) {
      const statusCode =
        err instanceof Error && "$metadata" in err
          ? (err as Error & { $metadata: { httpStatusCode?: number } })
              .$metadata.httpStatusCode
          : undefined;

      // Non-retryable errors (4xx): log and bail without retrying
      if (statusCode && statusCode >= 400 && statusCode < 500) {
        Logger.error(
          `AISummaryTask: Bedrock returned non-retryable error (${statusCode})`,
          err instanceof Error ? err : new Error(String(err)),
          { documentId }
        );
        return undefined;
      }

      // Retryable errors (5xx, network issues): re-throw to allow task retry
      Logger.warn("AISummaryTask: Bedrock call failed, will retry", {
        documentId,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}
