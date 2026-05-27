import Router from "koa-router";
import { z } from "zod";
import { TeamPreference } from "@shared/types";
import { NotFoundError, ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { rateLimiter } from "@server/middlewares/rateLimiter";
import type { APIContext } from "@server/types";
import AiProvider from "../services/AiProvider";
import env from "../env";
import type { AiAction, AiCompletionRequest } from "../../shared/types";

const router = new Router();

// Validation schema for the ai.complete endpoint
const AiCompleteSchema = z.object({
  body: z.object({
    action: z.enum([
      "continue",
      "summarize",
      "improve",
      "shorter",
      "longer",
      "fixGrammar",
      "translate",
      "brainstorm",
      "explain",
      "actionItems",
      "custom",
    ]),
    text: z.string().min(1).max(100_000),
    context: z.string().max(100_000).optional(),
    language: z.string().max(20).optional(),
    customPrompt: z.string().max(2000).optional(),
  }),
});

/**
 * @api {post} /ai.complete Generate AI completion (streaming)
 * @apiGroup AI
 * @apiDescription Generates AI text completion with Server-Sent Events streaming.
 */
router.post(
  "ai.complete",
  rateLimiter({ duration: 60, requests: 20 }),
  auth(),
  async (ctx: APIContext) => {
    const { user } = ctx.state.auth;

    // Check if AI assistant is enabled for this team
    if (!user.team.getPreference(TeamPreference.AiAssistant)) {
      throw NotFoundError("AI assistant is not enabled for this workspace");
    }

    // Check if AI provider is configured
    if (!AiProvider.isConfigured) {
      ctx.status = 503;
      ctx.body = {
        ok: false,
        error: "ai_not_configured",
        message:
          "AI provider is not configured. Please ask your admin to set AI_API_KEY.",
      };
      return;
    }

    // Validate input
    const result = AiCompleteSchema.safeParse({ body: ctx.request.body });
    if (!result.success) {
      throw ValidationError(result.error.issues[0]?.message ?? "Invalid input");
    }

    const { action, text, context, language, customPrompt } =
      result.data.body;

    // Truncate context to max configured token limit (rough char estimate)
    const maxContextChars = env.AI_MAX_CONTEXT_TOKENS * 4; // ~4 chars per token
    const truncatedContext = context?.slice(0, maxContextChars);

    const request: AiCompletionRequest = {
      action: action as AiAction,
      text,
      context: truncatedContext,
      language,
      customPrompt,
    };

    // Set SSE headers
    ctx.respond = false;
    ctx.res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    });

    try {
      const provider = new AiProvider();

      // Handle client disconnect
      const abortController = new AbortController();
      ctx.req.on("close", () => {
        abortController.abort();
      });

      for await (const token of provider.stream(request)) {
        if (abortController.signal.aborted) {
          break;
        }
        ctx.res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // Send completion signal
      if (!abortController.signal.aborted) {
        ctx.res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      }
    } catch (error: any) {
      // If headers already sent, send error as SSE event
      const errorMessage =
        error.message ?? "An unexpected error occurred";
      ctx.res.write(
        `data: ${JSON.stringify({ error: true, message: errorMessage })}\n\n`
      );
    } finally {
      ctx.res.end();
    }
  }
);

/**
 * @api {post} /ai.status Check AI configuration status
 * @apiGroup AI
 * @apiDescription Returns whether the AI provider is configured and the model in use.
 */
router.post("ai.status", auth(), async (ctx: APIContext) => {
  const { user } = ctx.state.auth;

  // Only admins can check AI status
  if (!user.isAdmin) {
    ctx.body = {
      data: {
        configured: AiProvider.isConfigured,
        model: null,
      },
    };
    return;
  }

  ctx.body = {
    data: {
      configured: AiProvider.isConfigured,
      model: AiProvider.isConfigured ? AiProvider.model : null,
    },
  };
});

export default router;
