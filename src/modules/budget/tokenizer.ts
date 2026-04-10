/**
 * Lightweight token estimator — no external dependency.
 *
 * Uses a heuristic based on the GPT tokenization rule of thumb:
 * ~4 characters per token for English text, ~3 for code.
 *
 * For production accuracy, users can inject their provider's real token count
 * via the NormalizedResponse interface (inputTokens / outputTokens fields).
 */

export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Count words and apply multiplier
  // Words: ~1.3 tokens each on average (accounts for subword tokenization)
  // Punctuation/special chars: ~1 token each
  const words = text.trim().split(/\s+/).length;
  const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) ?? []).length;

  return Math.ceil(words * 1.3 + specialChars * 0.5);
}

/**
 * More accurate estimation by character count (fallback method).
 */
export function estimateTokensByChars(text: string): number {
  return Math.ceil(text.length / 4);
}
