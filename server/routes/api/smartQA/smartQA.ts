import Router from "koa-router";
import { v4 as uuidv4 } from "uuid";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import validate from "@server/middlewares/validate";
import type { APIContext } from "@server/types";
import { RateLimiterStrategy } from "@server/utils/RateLimiter";
import SmartQADocumentRetriever from "@server/services/SmartQADocumentRetriever";
import SmartQALLMService from "@server/services/SmartQALLMService";
import Logger from "@server/logging/Logger";
import type { Citation } from "@shared/types/smartQA";
import { SmartQAAskSchema, type SmartQAAskReq } from "./schema";

const router = new Router();

const documentRetriever = new SmartQADocumentRetriever();
const llmService = new SmartQALLMService();

router.post(
  "smartQA.ask",
  auth(),
  rateLimiter(RateLimiterStrategy.TwentyFivePerMinute),
  validate(SmartQAAskSchema),
  async (ctx: APIContext<SmartQAAskReq>) => {
    const { question, conversationId, history } = ctx.input.body;
    const user = ctx.state.auth.user;

    // Step 1: Retrieve relevant documents
    let documents;
    try {
      documents = await documentRetriever.retrieve(user, question);
    } catch (error) {
      Logger.error(
        "SmartQA retrieval error in route handler",
        error instanceof Error ? error : new Error(String(error)),
        { userId: user.id }
      );
      ctx.status = 500;
      ctx.body = {
        error: "retrieval_failed",
        message: "Failed to retrieve documents. Please try again later.",
      };
      return;
    }

    // Step 2: If no documents found, return informational message without calling LLM
    if (documents.length === 0) {
      ctx.body = {
        data: {
          answer:
            "未找到与您的问题相关的授权文档。请尝试换一种方式提问，或确认您有权限访问相关内容。",
          citations: [],
          conversationId: conversationId || uuidv4(),
        },
      };
      return;
    }

    // Step 3: Call LLM service to generate answer
    let llmResponse;
    try {
      llmResponse = await llmService.generateAnswer({
        question,
        documents,
        history: history || [],
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      if (errorMessage === "LLM response timeout") {
        ctx.status = 408;
        ctx.body = {
          error: "timeout",
          message:
            "The request timed out. Please try again.",
        };
        return;
      }

      Logger.error(
        "SmartQA LLM service error in route handler",
        error instanceof Error ? error : new Error(String(error)),
        { userId: user.id }
      );
      ctx.status = 500;
      ctx.body = {
        error: "service_error",
        message: "An error occurred while generating the answer. Please try again later.",
      };
      return;
    }

    // Step 4: Build citations from cited document IDs
    const citations: Citation[] = [];
    const seenIds = new Set<string>();

    for (const docId of llmResponse.citedDocumentIds) {
      if (seenIds.has(docId)) {
        continue;
      }
      const doc = documents.find((d) => d.id === docId);
      if (doc) {
        seenIds.add(docId);
        citations.push({
          id: doc.id,
          title: doc.title,
          url: doc.url,
        });
      }
      if (citations.length >= 10) {
        break;
      }
    }

    // Step 5: Return response
    ctx.body = {
      data: {
        answer: llmResponse.answer,
        citations,
        conversationId: conversationId || uuidv4(),
      },
    };
  }
);

export default router;
