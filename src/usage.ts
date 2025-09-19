import { estimateTokens, type Usage } from './utils.js';
import type { MaybeUsage } from './types.js';

export function extractUsage(
  res: unknown,
  modelId: string | undefined,
  promptText: string,
  completionText: string
): Usage {
  const u = (res as { usage?: MaybeUsage } | undefined)?.usage ?? {};
  const promptTokens =
    typeof u.promptTokens === 'number'
      ? u.promptTokens
      : estimateTokens(promptText, modelId);
  const completionTokens =
    typeof u.completionTokens === 'number'
      ? u.completionTokens
      : estimateTokens(completionText, modelId);
  const totalTokens =
    typeof u.totalTokens === 'number'
      ? u.totalTokens
      : promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}
