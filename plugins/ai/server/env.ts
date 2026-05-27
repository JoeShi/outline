import { IsOptional, IsNumber } from "class-validator";
import { Environment } from "@server/env";
import environment from "@server/utils/environment";

class AiPluginEnvironment extends Environment {
  /**
   * API key for the LLM provider (OpenAI-compatible).
   * Required to enable the AI writing assistant feature.
   */
  @IsOptional()
  public AI_API_KEY = this.toOptionalString(environment.AI_API_KEY);

  /**
   * Base URL for the OpenAI-compatible API endpoint.
   * Override this to use Azure OpenAI, Ollama, vLLM, LM Studio, or other providers.
   */
  @IsOptional()
  public AI_BASE_URL =
    this.toOptionalString(environment.AI_BASE_URL) ??
    "https://api.openai.com/v1";

  /**
   * The model identifier to use for AI completions.
   */
  @IsOptional()
  public AI_MODEL =
    this.toOptionalString(environment.AI_MODEL) ?? "gpt-4o-mini";

  /**
   * Maximum number of tokens the LLM should generate per response.
   */
  @IsOptional()
  @IsNumber()
  public AI_MAX_TOKENS =
    this.toOptionalNumber(environment.AI_MAX_TOKENS) ?? 2048;

  /**
   * Maximum number of context tokens to send to the LLM (document content).
   */
  @IsOptional()
  @IsNumber()
  public AI_MAX_CONTEXT_TOKENS =
    this.toOptionalNumber(environment.AI_MAX_CONTEXT_TOKENS) ?? 4096;
}

export default new AiPluginEnvironment();
