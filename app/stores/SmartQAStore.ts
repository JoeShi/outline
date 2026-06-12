import { action, computed, observable, runInAction } from "mobx";
import { v4 as uuidv4 } from "uuid";
import type { QAMessage, QAError, SmartQAResponse } from "@shared/types/smartQA";
import { client } from "~/utils/ApiClient";
import { RateLimitExceededError } from "~/utils/errors";
import type RootStore from "./RootStore";

class SmartQAStore {
  // Observable state
  @observable isPanelOpen: boolean = false;
  @observable messages: QAMessage[] = [];
  @observable isLoading: boolean = false;
  @observable error: QAError | null = null;
  @observable retryCount: number = 0;
  @observable preservedInput: string = "";
  @observable isRateLimited: boolean = false;

  // Constants
  readonly MAX_ROUNDS = 50;
  readonly MAX_MESSAGES = 100; // 50 rounds × 2
  readonly MAX_CONTEXT_ROUNDS = 20;
  readonly MAX_RETRY = 3;
  readonly RATE_LIMIT_COOLDOWN = 60000; // 60s

  // Private state
  private conversationId: string | undefined;
  private rateLimitTimer: ReturnType<typeof setTimeout> | undefined;
  rootStore: RootStore;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
  }

  // Actions
  @action
  openPanel(): void {
    this.isPanelOpen = true;
  }

  @action
  closePanel(): void {
    this.isPanelOpen = false;
  }

  @action
  togglePanel(): void {
    this.isPanelOpen = !this.isPanelOpen;
  }

  @action
  async submitQuestion(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || this.isLoading || this.isRateLimited) {
      return;
    }

    // Reset error and retry count for new question
    this.error = null;
    this.retryCount = 0;
    this.preservedInput = "";
    this.isLoading = true;

    // Add user message
    const userMessage: QAMessage = {
      id: uuidv4(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    this.messages.push(userMessage);

    // Enforce sliding window: remove oldest round if over limit
    this.enforceMessageLimit();

    // Build history for API (recent 20 rounds = 40 messages)
    const history = this.recentHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const response = await client.post("/smartQA.ask", {
        question: trimmed,
        conversationId: this.conversationId,
        history,
      });

      runInAction(() => {
        const data = (response as { data: SmartQAResponse }).data ?? (response as unknown as SmartQAResponse);
        const answer = data.answer;
        const citations = data.citations;
        const convId = data.conversationId;

        if (convId) {
          this.conversationId = convId;
        }

        // Add assistant message
        const assistantMessage: QAMessage = {
          id: uuidv4(),
          role: "assistant",
          content: answer,
          timestamp: Date.now(),
          citations,
        };
        this.messages.push(assistantMessage);

        // Enforce sliding window after adding assistant message
        this.enforceMessageLimit();
        this.isLoading = false;
      });
    } catch (err: unknown) {
      runInAction(() => {
        this.isLoading = false;
        this.preservedInput = trimmed;
        this.handleError(err);
      });
    }
  }

  @action
  newConversation(): void {
    this.messages = [];
    this.error = null;
    this.retryCount = 0;
    this.preservedInput = "";
    this.conversationId = undefined;
  }

  @action
  retry(): void {
    if (!this.canRetry) {
      return;
    }
    const input = this.preservedInput;
    if (!input) {
      return;
    }

    this.retryCount += 1;

    // Remove the last user message that failed (to avoid duplicate)
    if (
      this.messages.length > 0 &&
      this.messages[this.messages.length - 1].role === "user"
    ) {
      this.messages.pop();
    }

    this.error = null;
    this.submitQuestion(input);
  }

  // Computed
  @computed
  get canSubmit(): boolean {
    return !this.isLoading && !this.isRateLimited;
  }

  @computed
  get canRetry(): boolean {
    return this.retryCount < this.MAX_RETRY && this.error?.retryable === true;
  }

  @computed
  get recentHistory(): QAMessage[] {
    // Last 20 rounds = last 40 messages
    const maxMessages = this.MAX_CONTEXT_ROUNDS * 2;
    if (this.messages.length <= maxMessages) {
      return this.messages.slice();
    }
    return this.messages.slice(-maxMessages);
  }

  // Private helpers
  private enforceMessageLimit(): void {
    while (this.messages.length > this.MAX_MESSAGES) {
      // Remove oldest 2 messages (one round = one Q + one A)
      this.messages.splice(0, 2);
    }
  }

  private handleError(err: unknown): void {
    if (err instanceof RateLimitExceededError) {
      this.error = {
        type: "rate_limit",
        message: "Request rate limit exceeded. Please wait before retrying.",
        retryable: false,
      };
      this.isRateLimited = true;
      this.startRateLimitCooldown();
      return;
    }

    const statusCode = (err as { status?: number }).status;
    const message =
      (err as { message?: string }).message || "An unexpected error occurred";

    if (
      statusCode === 408 ||
      message.toLowerCase().includes("timeout") ||
      message.includes("408")
    ) {
      this.error = {
        type: "timeout",
        message: "Request timed out. Please try again.",
        retryable: true,
      };
      return;
    }

    if (statusCode === 429) {
      this.error = {
        type: "rate_limit",
        message: "Too many requests. Please wait before retrying.",
        retryable: false,
      };
      this.isRateLimited = true;
      this.startRateLimitCooldown();
      return;
    }

    // Default: retrieval_failed or unknown
    this.error = {
      type: message.toLowerCase().includes("retrieval") ? "retrieval_failed" : "unknown",
      message,
      retryable: true,
    };
  }

  private startRateLimitCooldown(): void {
    if (this.rateLimitTimer) {
      clearTimeout(this.rateLimitTimer);
    }
    this.rateLimitTimer = setTimeout(() => {
      runInAction(() => {
        this.isRateLimited = false;
      });
    }, this.RATE_LIMIT_COOLDOWN);
  }
}

export default SmartQAStore;
