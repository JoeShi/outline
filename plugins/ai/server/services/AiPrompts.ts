import type { AiAction } from "../../shared/types";

const BASE_SYSTEM_PROMPT = `You are a helpful AI writing assistant embedded in a knowledge base editor. You help users write, edit, and improve their documents. Always respond with well-formatted markdown. Do not include any preamble, explanations, or meta-commentary — output only the requested content.`;

const SYSTEM_PROMPTS: Record<AiAction, string> = {
  continue: `${BASE_SYSTEM_PROMPT}
Your task is to continue writing from where the user left off. Match the tone, style, and formatting of the existing content. Write 1-3 natural paragraphs.`,

  summarize: `${BASE_SYSTEM_PROMPT}
Your task is to summarize the given text concisely. Capture the key points in a brief, clear summary. Use bullet points if the content has multiple distinct topics.`,

  improve: `${BASE_SYSTEM_PROMPT}
Your task is to improve the writing quality of the given text. Make it clearer, more professional, and better structured while preserving the original meaning. Fix any issues with flow, word choice, and readability.`,

  shorter: `${BASE_SYSTEM_PROMPT}
Your task is to make the given text more concise. Remove unnecessary words, redundancy, and filler while preserving all key information and meaning.`,

  longer: `${BASE_SYSTEM_PROMPT}
Your task is to expand the given text with more detail, examples, or explanations. Maintain the same tone and style while making the content more comprehensive.`,

  fixGrammar: `${BASE_SYSTEM_PROMPT}
Your task is to fix all spelling, grammar, and punctuation errors in the given text. Do not change the meaning, tone, or style — only correct language mistakes. Return the corrected text.`,

  translate: `${BASE_SYSTEM_PROMPT}
Your task is to translate the given text to the specified target language. Preserve formatting, tone, and meaning as closely as possible. Do not add explanations.`,

  brainstorm: `${BASE_SYSTEM_PROMPT}
Your task is to brainstorm ideas related to the given text or topic. Generate a list of creative, relevant ideas formatted as bullet points. Aim for 5-10 distinct ideas.`,

  explain: `${BASE_SYSTEM_PROMPT}
Your task is to explain the given text in simpler terms. Break down complex concepts, define jargon, and make the content accessible to a general audience.`,

  actionItems: `${BASE_SYSTEM_PROMPT}
Your task is to extract action items and next steps from the given text. Format them as a clear checklist using markdown task list syntax (- [ ] item). Only include concrete, actionable items.`,

  custom: `${BASE_SYSTEM_PROMPT}
Follow the user's instructions precisely. Output only the requested content in well-formatted markdown.`,
};

/**
 * Build the system prompt for a given AI action.
 */
export function buildSystemPrompt(action: AiAction): string {
  return SYSTEM_PROMPTS[action] ?? SYSTEM_PROMPTS.custom;
}

/**
 * Build the user prompt for a given AI action with the provided text and options.
 */
export function buildUserPrompt(
  action: AiAction,
  text: string,
  context?: string,
  language?: string,
  customPrompt?: string
): string {
  const parts: string[] = [];

  // Add context if provided
  if (context) {
    parts.push(`<document_context>\n${context}\n</document_context>\n`);
  }

  // Build action-specific user message
  switch (action) {
    case "continue":
      parts.push(
        `Continue writing from the following text:\n\n${text}`
      );
      break;

    case "translate":
      parts.push(
        `Translate the following text to ${language ?? "English"}:\n\n${text}`
      );
      break;

    case "custom":
      parts.push(
        `${customPrompt ?? "Process the following text"}:\n\n${text}`
      );
      break;

    case "summarize":
      parts.push(`Summarize the following text:\n\n${text}`);
      break;

    case "improve":
      parts.push(`Improve the following text:\n\n${text}`);
      break;

    case "shorter":
      parts.push(`Make the following text more concise:\n\n${text}`);
      break;

    case "longer":
      parts.push(`Expand the following text with more detail:\n\n${text}`);
      break;

    case "fixGrammar":
      parts.push(
        `Fix the spelling and grammar in the following text:\n\n${text}`
      );
      break;

    case "brainstorm":
      parts.push(`Brainstorm ideas related to:\n\n${text}`);
      break;

    case "explain":
      parts.push(`Explain the following in simpler terms:\n\n${text}`);
      break;

    case "actionItems":
      parts.push(
        `Extract action items from the following text:\n\n${text}`
      );
      break;

    default:
      parts.push(text);
  }

  return parts.join("\n");
}
