/** Single QA message in a conversation */
export interface QAMessage {
  /** Client-generated UUID */
  id: string;
  /** Role identifier */
  role: "user" | "assistant";
  /** Message content (user question or Markdown answer) */
  content: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Source citations, only present in assistant messages */
  citations?: Citation[];
  /** Error information */
  error?: QAError;
}

/** Source citation referencing a document */
export interface Citation {
  /** Document UUID */
  id: string;
  /** Document title */
  title: string;
  /** Document relative path (e.g. /doc/slug-xxx) */
  url: string;
}

/** Error type for QA operations */
export interface QAError {
  /** Error category */
  type: "timeout" | "rate_limit" | "retrieval_failed" | "unknown";
  /** Human-readable error message */
  message: string;
  /** Whether the operation can be retried */
  retryable: boolean;
}

/** Request body for the smartQA.ask API endpoint */
export interface SmartQAAskRequest {
  /** User's question text (1-2000 characters, trimmed non-empty) */
  question: string;
  /** Optional conversation identifier (UUID format) */
  conversationId?: string;
  /** Optional conversation history (up to 20 rounds / 40 messages) */
  history?: { role: "user" | "assistant"; content: string }[];
}

/** Response from the smartQA.ask API endpoint */
export interface SmartQAResponse {
  /** Markdown-formatted answer */
  answer: string;
  /** Source citations (up to 10) */
  citations: Citation[];
  /** Conversation identifier */
  conversationId: string;
}
