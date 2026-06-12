import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import SmartQALLMService from "./SmartQALLMService";
import type { RetrievedDocument } from "./SmartQADocumentRetriever";
import type { ConversationMessage } from "./SmartQALLMService";

// Mock the Bedrock client module
jest.mock("@aws-sdk/client-bedrock-runtime", () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  InvokeModelCommand: jest.fn().mockImplementation((params) => params),
}));

function createMockDocument(
  overrides: Partial<RetrievedDocument> = {}
): RetrievedDocument {
  return {
    id: `doc-${Math.random().toString(36).substr(2, 8)}`,
    title: "Test Document",
    url: "/doc/test-doc",
    content: "This is test content for the document.",
    ranking: 1,
    ...overrides,
  };
}

function mockBedrockResponse(service: SmartQALLMService, text: string) {
  const responseBody = {
    content: [{ type: "text", text }],
  };
  // Access the mock client's send method
  const client = (service as any).client;
  client.send.mockResolvedValue({
    body: new TextEncoder().encode(JSON.stringify(responseBody)),
  });
}

function getClientSend(service: SmartQALLMService): jest.Mock {
  return (service as any).client.send;
}

describe("SmartQALLMService", () => {
  let service: SmartQALLMService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmartQALLMService();
  });

  describe("#estimateTokens", () => {
    it("should estimate tokens for English text (~4 chars/token)", () => {
      const text = "Hello world"; // 11 chars
      const tokens = service.estimateTokens(text);
      // 11 / 4 = 2.75, ceil = 3
      expect(tokens).toBe(3);
    });

    it("should estimate tokens for Chinese text (~1.5 chars/token)", () => {
      const text = "你好世界测试"; // 6 Chinese chars
      const tokens = service.estimateTokens(text);
      // 6 / 1.5 = 4
      expect(tokens).toBe(4);
    });

    it("should handle mixed Chinese and English text", () => {
      const text = "Hello你好"; // 5 English + 2 Chinese
      const tokens = service.estimateTokens(text);
      // English: ceil(5/4) = 2, Chinese: ceil(2/1.5) = 2 => total = 4
      expect(tokens).toBe(4);
    });

    it("should return 0 for empty string", () => {
      expect(service.estimateTokens("")).toBe(0);
    });
  });

  describe("#selectContextDocuments", () => {
    it("should select top 10 documents from 25", () => {
      const documents = Array.from({ length: 25 }, (_, i) =>
        createMockDocument({
          id: `doc-${i}`,
          ranking: 25 - i,
          content: "Short content.",
        })
      );

      const result = service.selectContextDocuments(documents);

      expect(result.length).toBe(10);
      expect(result[0].id).toBe("doc-0");
      expect(result[9].id).toBe("doc-9");
    });

    it("should return all documents if fewer than 10", () => {
      const documents = Array.from({ length: 5 }, (_, i) =>
        createMockDocument({ id: `doc-${i}`, ranking: 5 - i })
      );

      const result = service.selectContextDocuments(documents);

      expect(result.length).toBe(5);
    });

    it("should remove documents from lowest relevance when token limit exceeded", () => {
      // Create documents with very large content to exceed token limit
      const largeContent = "A".repeat(100000); // ~25000 tokens per doc
      const documents = Array.from({ length: 10 }, (_, i) =>
        createMockDocument({
          id: `doc-${i}`,
          ranking: 10 - i,
          content: largeContent,
        })
      );

      const result = service.selectContextDocuments(documents);

      // Should have fewer than 10 docs due to token limit
      expect(result.length).toBeLessThan(10);
      // Should keep the most relevant ones (first in the array)
      if (result.length > 0) {
        expect(result[0].id).toBe("doc-0");
      }
    });

    it("should return empty array if even one document exceeds token limit", () => {
      // MAX_INPUT_TOKENS = 180000, each English char ~4/token, so need 720000+ chars
      const hugeContent = "A".repeat(800000);
      const documents = [
        createMockDocument({
          id: "doc-huge",
          ranking: 10,
          content: hugeContent,
        }),
      ];

      const result = service.selectContextDocuments(documents);

      expect(result.length).toBe(0);
    });
  });

  describe("#generateAnswer", () => {
    it("should generate an answer with cited document IDs", async () => {
      const docId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const responseText = `Based on the document, here is the answer. [docId:${docId}]`;
      mockBedrockResponse(service, responseText);

      const result = await service.generateAnswer({
        question: "What is TypeScript?",
        documents: [
          createMockDocument({
            id: docId,
            content: "TypeScript is a typed superset of JavaScript.",
          }),
        ],
        history: [],
      });

      expect(result.answer).toBe(responseText);
      expect(result.citedDocumentIds).toEqual([docId]);
    });

    it("should deduplicate cited document IDs", async () => {
      const docId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const responseText = `First reference [docId:${docId}] and second [docId:${docId}]`;
      mockBedrockResponse(service, responseText);

      const result = await service.generateAnswer({
        question: "Tell me more",
        documents: [createMockDocument({ id: docId })],
        history: [],
      });

      expect(result.citedDocumentIds).toEqual([docId]);
      expect(result.citedDocumentIds.length).toBe(1);
    });

    it("should return empty citedDocumentIds when no citations in response", async () => {
      mockBedrockResponse(service, "Here is an answer without any citations.");

      const result = await service.generateAnswer({
        question: "Hello",
        documents: [createMockDocument()],
        history: [],
      });

      expect(result.citedDocumentIds).toEqual([]);
    });

    it("should include conversation history in the request", async () => {
      mockBedrockResponse(service, "Follow-up answer.");
      const mockSend = getClientSend(service);

      const history: ConversationMessage[] = [
        { role: "user", content: "What is React?" },
        { role: "assistant", content: "React is a UI library." },
      ];

      await service.generateAnswer({
        question: "Tell me more about it",
        documents: [createMockDocument()],
        history,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);

      // Verify the request body includes history
      const commandArg = mockSend.mock.calls[0][0];
      const body = JSON.parse(new TextDecoder().decode(commandArg.body));
      expect(body.messages.length).toBe(3); // 2 history + 1 current
      expect(body.messages[0].role).toBe("user");
      expect(body.messages[0].content).toBe("What is React?");
      expect(body.messages[1].role).toBe("assistant");
      expect(body.messages[1].content).toBe("React is a UI library.");
      expect(body.messages[2].role).toBe("user");
      expect(body.messages[2].content).toBe("Tell me more about it");
    });

    it("should throw 'LLM response timeout' on AbortError", async () => {
      const mockSend = getClientSend(service);
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      mockSend.mockRejectedValue(abortError);

      await expect(
        service.generateAnswer({
          question: "Test",
          documents: [createMockDocument()],
          history: [],
        })
      ).rejects.toThrow("LLM response timeout");
    });

    it("should throw descriptive error on other failures", async () => {
      const mockSend = getClientSend(service);
      mockSend.mockRejectedValue(new Error("Service unavailable"));

      await expect(
        service.generateAnswer({
          question: "Test",
          documents: [createMockDocument()],
          history: [],
        })
      ).rejects.toThrow("LLM service error: Service unavailable");
    });

    it("should construct correct system prompt with document context", async () => {
      mockBedrockResponse(service, "Answer based on docs.");
      const mockSend = getClientSend(service);

      const doc = createMockDocument({
        id: "test-uuid-1234",
        title: "Test Title",
        content: "Test content here.",
      });

      await service.generateAnswer({
        question: "What?",
        documents: [doc],
        history: [],
      });

      const commandArg = mockSend.mock.calls[0][0];
      const body = JSON.parse(new TextDecoder().decode(commandArg.body));

      expect(body.system).toContain("知识库问答助手");
      expect(body.system).toContain("[docId:UUID]");
      expect(body.system).toContain("[Test Title] (ID: test-uuid-1234)");
      expect(body.system).toContain("Test content here.");
      expect(body.anthropic_version).toBe("bedrock-2023-05-31");
      expect(body.max_tokens).toBe(4096);
    });

    it("should use correct model ID", async () => {
      mockBedrockResponse(service, "Test");
      const mockSend = getClientSend(service);

      await service.generateAnswer({
        question: "Test",
        documents: [createMockDocument()],
        history: [],
      });

      const commandArg = mockSend.mock.calls[0][0];
      expect(commandArg.modelId).toBe("anthropic.claude-sonnet-4-20250514");
    });

    it("should extract multiple different cited document IDs", async () => {
      const docId1 = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
      const docId2 = "b2c3d4e5-f6a7-8901-bcde-f12345678901";
      const responseText = `Reference one [docId:${docId1}] and reference two [docId:${docId2}]`;
      mockBedrockResponse(service, responseText);

      const result = await service.generateAnswer({
        question: "Compare",
        documents: [
          createMockDocument({ id: docId1 }),
          createMockDocument({ id: docId2 }),
        ],
        history: [],
      });

      expect(result.citedDocumentIds).toEqual([docId1, docId2]);
    });
  });
});
