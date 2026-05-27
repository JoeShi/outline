import type { AiAction } from "../../shared/types";

export interface AiCompleteParams {
  /** The AI action to perform. */
  action: AiAction;
  /** The text content to process. */
  text: string;
  /** Optional surrounding document content for context. */
  context?: string;
  /** Target language code for translation. */
  language?: string;
  /** Custom user prompt (for action "custom"). */
  customPrompt?: string;
}

export interface AiStreamCallbacks {
  /** Called for each token received from the stream. */
  onToken: (token: string) => void;
  /** Called when the stream completes successfully. */
  onDone: () => void;
  /** Called when an error occurs. */
  onError: (error: Error) => void;
}

/**
 * Client-side service for making AI completion requests via SSE streaming.
 */
class AiClient {
  /**
   * Start a streaming AI completion request.
   *
   * @param params - The completion request parameters.
   * @param callbacks - Callbacks for handling stream events.
   * @returns An AbortController that can be used to cancel the request.
   */
  complete(params: AiCompleteParams, callbacks: AiStreamCallbacks): AbortController {
    const controller = new AbortController();

    this.executeStream(params, callbacks, controller.signal).catch(
      (error) => {
        if (error.name !== "AbortError") {
          callbacks.onError(error);
        }
      }
    );

    return controller;
  }

  private async executeStream(
    params: AiCompleteParams,
    callbacks: AiStreamCallbacks,
    signal: AbortSignal
  ): Promise<void> {
    const response = await fetch("/api/ai.complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      signal,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      let errorMessage = `AI request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Use default error message
      }
      throw new Error(errorMessage);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE lines from buffer
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) {
            continue;
          }

          const data = trimmed.slice(6); // Remove "data: " prefix
          try {
            const parsed = JSON.parse(data);

            if (parsed.done) {
              callbacks.onDone();
              return;
            }

            if (parsed.error) {
              throw new Error(parsed.message ?? "AI generation failed");
            }

            if (parsed.token !== undefined) {
              callbacks.onToken(parsed.token);
            }
          } catch (parseError: any) {
            if (parseError.message && !parseError.message.includes("JSON")) {
              throw parseError;
            }
            // Skip malformed JSON lines
          }
        }
      }

      // If we reach here without a done signal, still call onDone
      callbacks.onDone();
    } finally {
      reader.releaseLock();
    }
  }
}

export default new AiClient();
