import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";

export const SmartQAAskSchema = BaseSchema.extend({
  body: z.object({
    /** The user's question text (1-2000 characters, trimmed non-empty) */
    question: z
      .string()
      .min(1)
      .max(2000)
      .refine((val) => val.trim().length > 0, {
        message: "Question cannot be empty or whitespace only",
      }),

    /** Optional conversation identifier for multi-turn dialogue */
    conversationId: z.uuid().optional(),

    /** Optional conversation history for context */
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string(),
        })
      )
      .max(40)
      .optional(),
  }),
});

export type SmartQAAskReq = z.infer<typeof SmartQAAskSchema>;
