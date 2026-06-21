import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";

export const AISummaryGenerateSchema = BaseSchema.extend({
  body: z.object({
    /** The ID of the document to generate a summary for */
    documentId: z.string().uuid(),
  }),
});

export type AISummaryGenerateReq = z.infer<typeof AISummaryGenerateSchema>;
