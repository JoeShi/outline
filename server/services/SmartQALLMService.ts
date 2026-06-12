import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import env from "@server/env";
import Logger from "@server/logging/Logger";
import type { RetrievedDocument } from "./SmartQADocumentRetriever";

/**
 * A single message in a conversation context sent to the LLM.
 */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Response structure from the LLM service.
 */
export interface LLMResponse {
  /** Markdown-formatted answer text */
  answer: string;
  /** Document IDs referenced in the answer using [docId:UUID] format */
  citedDocumentIds: string[];
}

/**
 * Service responsible for interacting with Amazon Bedrock to generate
 * answers based on retrieved context documents and conversation history.
 *
 * Implements the following key behaviors:
 * - Selects top 10 documents by relevance from up to 25 retrieved documents
 * - Estimates token usage and trims documents if they exceed the context limit
 * - Constructs a system prompt enforcing document-only answers with citations
 * - Enforces a 30-second timeout via AbortController
 * - Parses LLM response to extract answer text and cited document IDs
 */
class SmartQALLMService {
  private client: BedrockRuntimeClient;
  private readonly MODEL_ID = "anthropic.claude-sonnet-4-20250514";
  private readonly MAX_CONTEXT_DOCS = 10;
  private readonly MAX_INPUT_TOKENS = 180000;
  private readonly TIMEOUT_MS = 30000;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: env.AWS_REGION ?? "us-east-1",
      ...(env.AWS_ACCESS_KEY_ID &&
        env.AWS_SECRET_ACCESS_KEY && {
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        }),
    });
  }

  /**
   * Generate an answer based on context documents and conversation history.
   *
   * @param params.question - The user's current question
   * @param params.documents - Retrieved documents (up to 25), sorted by relevance
   * @param params.history - Previous conversation messages (up to 20 rounds)
   * @returns LLMResponse containing the answer and cited document IDs
   * @throws Error with "LLM response timeout" message on 30-second timeout
   * @throws Error with descriptive message on other failures
   */
  async generateAnswer(params: {
    question: string;
    documents: RetrievedDocument[];
    history: ConversationMessage[];
  }): Promise<LLMResponse> {
    const { question, documents, history } = params;

    // Step 1: Select top documents by relevance and fit within token budget
    const contextDocs = this.selectContextDocuments(documents);

    // Step 2: Build the system prompt with document context
    const systemPrompt = this.buildSystemPrompt(contextDocs);

    // Step 3: Build the messages array (history + current question)
    const messages = this.buildMessages(history, question);

    // Step 4: Invoke the model with timeout control
    const responseText = await this.invokeModel(systemPrompt, messages);

    // Step 5: Parse the response to extract answer and citations
    return this.parseResponse(responseText);
  }

  /**
   * Select up to MAX_CONTEXT_DOCS documents from the retrieved set,
   * ensuring total token count stays within MAX_INPUT_TOKENS.
   * Documents are assumed to be sorted by relevance (highest first).
   * If the top 10 exceed the token limit, remove from lowest relevance.
   */
  selectContextDocuments(documents: RetrievedDocument[]): RetrievedDocument[] {
    // Take top 10 by relevance (documents are already sorted by ranking desc)
    const topDocs = documents.slice(0, this.MAX_CONTEXT_DOCS);

    // Check if total tokens are within budget
    let totalTokens = this.estimateDocumentsTokens(topDocs);

    if (totalTokens <= this.MAX_INPUT_TOKENS) {
      return topDocs;
    }

    // Remove documents from lowest relevance until under limit
    const result = [...topDocs];
    while (result.length > 0 && totalTokens > this.MAX_INPUT_TOKENS) {
      result.pop(); // Remove least relevant (last in the sorted array)
      totalTokens = this.estimateDocumentsTokens(result);
    }

    return result;
  }

  /**
   * Estimate the total token count for a set of documents.
   * Uses a character-based heuristic:
   * - Chinese characters: ~1.5 chars per token
   * - English/ASCII characters: ~4 chars per token
   */
  estimateTokens(text: string): number {
    let chineseCharCount = 0;
    let otherCharCount = 0;

    for (const char of text) {
      const code = char.codePointAt(0)!;
      // CJK Unified Ideographs range and common CJK ranges
      if (
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
        (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
        (code >= 0x3000 && code <= 0x303f) || // CJK Symbols and Punctuation
        (code >= 0xff00 && code <= 0xffef) // Fullwidth Forms
      ) {
        chineseCharCount++;
      } else {
        otherCharCount++;
      }
    }

    // Chinese: ~1.5 chars/token, English: ~4 chars/token
    const chineseTokens = Math.ceil(chineseCharCount / 1.5);
    const otherTokens = Math.ceil(otherCharCount / 4);

    return chineseTokens + otherTokens;
  }

  /**
   * Estimate total tokens for all documents including their titles and content.
   */
  private estimateDocumentsTokens(documents: RetrievedDocument[]): number {
    let total = 0;
    for (const doc of documents) {
      // Account for title, ID formatting, and content
      const docText = `[${doc.title}] (ID: ${doc.id})\n${doc.content}\n\n`;
      total += this.estimateTokens(docText);
    }
    return total;
  }

  /**
   * Build the system prompt including document context.
   */
  private buildSystemPrompt(documents: RetrievedDocument[]): string {
    const documentContext = documents
      .map((doc) => `[${doc.title}] (ID: ${doc.id})\n${doc.content}`)
      .join("\n\n");

    return `你是一个知识库问答助手。请基于以下文档内容回答用户问题。
规则：
1. 仅基于提供的文档内容回答，不要使用外部知识
2. 如果文档中没有相关信息，请明确告知用户
3. 在回答中引用来源文档，使用 [docId:UUID] 格式标记引用
4. 回答使用 Markdown 格式

文档上下文：
${documentContext}`;
  }

  /**
   * Build the messages array for the Bedrock Messages API.
   * Includes conversation history and the current question.
   */
  private buildMessages(
    history: ConversationMessage[],
    question: string
  ): Array<{ role: "user" | "assistant"; content: string }> {
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

    // Add conversation history
    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current question
    messages.push({
      role: "user",
      content: question,
    });

    return messages;
  }

  /**
   * Invoke the Bedrock model with timeout control.
   * Uses AbortController with a 30-second setTimeout.
   */
  private async invokeModel(
    systemPrompt: string,
    messages: Array<{ role: "user" | "assistant"; content: string }>
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.TIMEOUT_MS);

    try {
      const requestBody = JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });

      const command = new InvokeModelCommand({
        modelId: this.MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: new TextEncoder().encode(requestBody),
      });

      const response = await this.client.send(command, {
        abortSignal: controller.signal,
      });

      clearTimeout(timeout);

      // Parse the response body from Uint8Array
      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      );

      // Extract text content from the Bedrock Messages API response
      if (responseBody.content && responseBody.content.length > 0) {
        return responseBody.content
          .filter(
            (block: { type: string; text?: string }) => block.type === "text"
          )
          .map((block: { type: string; text: string }) => block.text)
          .join("");
      }

      return "";
    } catch (error) {
      clearTimeout(timeout);

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new Error("LLM response timeout");
      }

      Logger.error(
        "SmartQA LLM invocation failed",
        error instanceof Error ? error : new Error(String(error)),
        {
          model: this.MODEL_ID,
        }
      );

      throw new Error(
        `LLM service error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse the LLM response text to extract the answer and cited document IDs.
   * Looks for citations in the format [docId:UUID].
   */
  private parseResponse(responseText: string): LLMResponse {
    // Extract cited document IDs using the [docId:UUID] pattern
    const citationPattern =
      /\[docId:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;
    const citedDocumentIds: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = citationPattern.exec(responseText)) !== null) {
      const docId = match[1];
      // Deduplicate IDs while preserving first-occurrence order
      if (!citedDocumentIds.includes(docId)) {
        citedDocumentIds.push(docId);
      }
    }

    return {
      answer: responseText,
      citedDocumentIds,
    };
  }
}

export default SmartQALLMService;
