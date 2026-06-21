import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";

jest.mock("@aws-sdk/client-bedrock-runtime");

jest.mock("@server/logging/Logger", () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@server/models", () => ({
  Document: {
    findByPk: jest.fn(),
  },
  Event: {
    create: jest.fn(),
  },
}));

jest.mock("@server/models/helpers/DocumentHelper", () => ({
  DocumentHelper: {
    toPlainText: jest.fn(),
  },
}));

jest.mock("../env", () => ({
  __esModule: true,
  default: {
    AI_SUMMARY_BEDROCK_REGION: "us-east-1",
    AI_SUMMARY_BEDROCK_MODEL_ID: "us.anthropic.claude-sonnet-4-20250514",
    AI_SUMMARY_BEDROCK_ACCESS_KEY_ID: "test-key",
    AI_SUMMARY_BEDROCK_SECRET_ACCESS_KEY: "test-secret",
  },
}));

import { Document, Event } from "@server/models";
import { DocumentHelper } from "@server/models/helpers/DocumentHelper";
import AISummaryTask from "./AISummaryTask";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AISummaryTask", () => {
  it("should generate a summary and update the document", async () => {
    const mockSummary = "This is a test summary of the document.";
    const mockResponseBody = JSON.stringify({
      content: [{ type: "text", text: mockSummary }],
    });

    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(mockResponseBody),
    });
    jest.mocked(BedrockRuntimeClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as unknown as BedrockRuntimeClient
    );

    const mockDocument = {
      id: "test-doc-id",
      title: "Test Document",
      teamId: "test-team-id",
      collectionId: "test-collection-id",
      summary: "",
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(Document.findByPk).mockResolvedValue(mockDocument as never);
    jest
      .mocked(DocumentHelper.toPlainText)
      .mockReturnValue("Hello world content");
    jest.mocked(Event.create).mockResolvedValue(undefined as never);

    const task = new AISummaryTask();
    await task.perform({ documentId: "test-doc-id", userId: "test-user-id" });

    expect(Document.findByPk).toHaveBeenCalledWith("test-doc-id");
    expect(DocumentHelper.toPlainText).toHaveBeenCalledWith(mockDocument);
    expect(mockSend).toHaveBeenCalled();
    expect(mockDocument.summary).toEqual(mockSummary);
    expect(mockDocument.save).toHaveBeenCalled();
    expect(Event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "documents.update",
        documentId: "test-doc-id",
        actorId: "test-user-id",
      })
    );
  });

  it("should not proceed if document is not found", async () => {
    jest.mocked(Document.findByPk).mockResolvedValue(null);

    const mockSend = jest.fn();
    jest.mocked(BedrockRuntimeClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as unknown as BedrockRuntimeClient
    );

    const task = new AISummaryTask();
    await task.perform({ documentId: "missing-id", userId: "test-user-id" });

    expect(mockSend).not.toHaveBeenCalled();
  });

  it("should not proceed if document has no text content", async () => {
    const mockDocument = {
      id: "test-doc-id",
      title: "Empty Document",
      teamId: "test-team-id",
      collectionId: "test-collection-id",
      summary: "",
      save: jest.fn(),
    };

    jest.mocked(Document.findByPk).mockResolvedValue(mockDocument as never);
    jest.mocked(DocumentHelper.toPlainText).mockReturnValue("");

    const mockSend = jest.fn();
    jest.mocked(BedrockRuntimeClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as unknown as BedrockRuntimeClient
    );

    const task = new AISummaryTask();
    await task.perform({ documentId: "test-doc-id", userId: "test-user-id" });

    expect(mockSend).not.toHaveBeenCalled();
    expect(mockDocument.save).not.toHaveBeenCalled();
  });

  it("should truncate summary to 1000 characters", async () => {
    const longSummary = "a".repeat(1500);
    const mockResponseBody = JSON.stringify({
      content: [{ type: "text", text: longSummary }],
    });

    const mockSend = jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(mockResponseBody),
    });
    jest.mocked(BedrockRuntimeClient).mockImplementation(
      () =>
        ({
          send: mockSend,
        }) as unknown as BedrockRuntimeClient
    );

    const mockDocument = {
      id: "test-doc-id",
      title: "Test Document",
      teamId: "test-team-id",
      collectionId: "test-collection-id",
      summary: "",
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.mocked(Document.findByPk).mockResolvedValue(mockDocument as never);
    jest
      .mocked(DocumentHelper.toPlainText)
      .mockReturnValue("Some content here");
    jest.mocked(Event.create).mockResolvedValue(undefined as never);

    const task = new AISummaryTask();
    await task.perform({ documentId: "test-doc-id", userId: "test-user-id" });

    expect(mockDocument.summary.length).toBe(1000);
  });
});
