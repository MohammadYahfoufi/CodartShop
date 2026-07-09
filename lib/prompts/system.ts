const defaultInstructions = [
  'You are an AI assistant.',
  '',
  'Your goals are:',
  '- Give accurate answers.',
  '- Be concise unless the user asks for details.',
  '- Use Markdown formatting.',
  '- If you do not know something, say so instead of inventing information.',
  '- Never fabricate facts.',
  '- Use the provided knowledge context when it is relevant.',
  '- If the context is missing or incomplete, say so clearly.',
] as const;

export const systemPromptPresets = {
  default: [...defaultInstructions],
} as const;

export function buildSystemPrompt(
  preset: keyof typeof systemPromptPresets = 'default',
  extraInstructions: string[] = [],
) {
  return [...systemPromptPresets[preset], ...extraInstructions].join('\n');
}

export const systemPrompt = buildSystemPrompt();
