import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { Document, Event } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import { BaseTask } from "@server/queues/tasks/base/BaseTask";
import Logger from "@server/logging/Logger";
import env from "../env";

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

    const summary = await this.generateSummary(plainText);

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
   *
   * @param text - The plain text content of the document.
   * @returns A summary string (2-3 sentences).
   */
  private async generateSummary(text: string): Promise<string> {
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

    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    const summaryText: string = responseBody.content?.[0]?.text ?? "";

    // Truncate to 1000 characters (Document.summary max length)
    return summaryText.slice(0, 1000);
  }
}
