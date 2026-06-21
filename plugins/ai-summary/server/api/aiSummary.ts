import Router from "koa-router";
import { Document } from "@server/models";
import auth from "@server/middlewares/authentication";
import validate from "@server/middlewares/validate";
import { authorize } from "@server/policies";
import { presentDocument } from "@server/presenters";
import type { APIContext } from "@server/types";
import AISummaryTask from "../tasks/AISummaryTask";
import * as T from "./schema";

const router = new Router();

/**
 * Triggers AI summary generation for a document. The summary is generated
 * asynchronously via a background task using Amazon Bedrock.
 */
router.post(
  "aiSummary.generate",
  auth(),
  validate(T.AISummaryGenerateSchema),
  async (ctx: APIContext<T.AISummaryGenerateReq>) => {
    const { documentId } = ctx.input.body;
    const { user } = ctx.state.auth;

    const document = await Document.findByPk(documentId, {
      userId: user.id,
    });

    authorize(user, "read", document);

    const task = new AISummaryTask();
    await task.schedule({
      documentId: document.id,
      userId: user.id,
    });

    ctx.body = {
      data: presentDocument(document),
      success: true,
    };
  }
);

export default router;
