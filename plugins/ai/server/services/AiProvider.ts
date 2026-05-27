import OpenAI from "openai";
import env from "../env";
import type { AiCompletionRequest } from "../../shared/types";
import { buildSystemPrompt, buildUserPrompt } from "./AiPrompts";

/**
 * AiProvider wraps the OpenAI SDK to provide streaming text generation
 * using any OpenAI-compatible API endpoint.
 */
class AiProvider {
  private client: OpenAI;

  constructor() {
    if (!env.AI_API_KEY) {
      throw new Error("AI_API_KEY is not configured");
    }

    this.client = new OpenAI({
      apiKey: env.AI_API_KEY,
      baseURL: env.AI_BASE_URL,
      timeout: 60_000, // 60 second timeout
      maxRetries: 2,
    });
  }

  /**
   * Returns whether the AI provider is configured and ready to use.
   */
  static get isConfigured(): boolean {
    return !!env.AI_API_KEY;
  }

  /**
   * Returns the configured model name.
   */
  static get model(): string {
    return env.AI_MODEL;
  }

  /**
   * Stream a completion response from the LLM.
   * Returns an async iterable that yields string tokens.
   */
  async *stream(request: AiCompletionRequest): AsyncIterable<string> {
    const systemPrompt = buildSystemPrompt(request.action);
    const userPrompt = buildUserPrompt(
      request.action,
      request.text,
      request.context,
      request.language,
      request.customPrompt
    );

    const response = await this.client.chat.completions.create({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      temperature: this.getTemperature(request.action),
      stream: true,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Get appropriate temperature for the given action.
   * Lower temperature for precise tasks, higher for creative ones.
   */
  private getTemperature(action: string): number {
    switch (action) {
      case "fixGrammar":
      case "translate":
        return 0.3;
      case "summarize":
      case "actionItems":
      case "shorter":
        return 0.5;
      case "improve":
      case "longer":
      case "explain":
      case "continue":
        return 0.7;
      case "brainstorm":
      case "custom":
        return 0.9;
      default:
        return 0.7;
    }
  }
}

export default AiProvider;
