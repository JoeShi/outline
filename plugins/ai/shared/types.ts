/**
 * Available AI actions that can be performed on text.
 */
export type AiAction =
  | "continue"
  | "summarize"
  | "improve"
  | "shorter"
  | "longer"
  | "fixGrammar"
  | "translate"
  | "brainstorm"
  | "explain"
  | "actionItems"
  | "custom";

/**
 * Request payload for AI completion.
 */
export interface AiCompletionRequest {
  /** The AI action to perform. */
  action: AiAction;
  /** The text content to process (selected text or current paragraph). */
  text: string;
  /** Optional surrounding document content for context. */
  context?: string;
  /** Target language code for translation (e.g., "zh-CN", "ja", "es"). */
  language?: string;
  /** Custom user prompt (used when action is "custom"). */
  customPrompt?: string;
}

/**
 * A single token chunk in the SSE stream.
 */
export interface AiStreamToken {
  token: string;
}

/**
 * The final message indicating stream completion.
 */
export interface AiStreamDone {
  done: true;
}

/**
 * Error response from the AI endpoint.
 */
export interface AiErrorResponse {
  ok: false;
  error: string;
  message: string;
}

/**
 * Status response from the AI status endpoint.
 */
export interface AiStatusResponse {
  configured: boolean;
  model: string | null;
}
