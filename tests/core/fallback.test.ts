import { describe, it, expect, vi } from 'vitest';
import { Guardian } from '../../src/core/Guardian.js';
import { GuardianSession } from '../../src/core/GuardianSession.js';

function makeOpenAIResponse(content: string, inputTokens = 5, outputTokens = 5) {
  return {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens },
  };
}

describe('Provider Fallback & Budget Auto-healing', () => {
  it('should fall back to secondary provider if primary throws', async () => {
    const primaryCall = vi.fn().mockRejectedValue(new Error('OpenAI Down'));
    const fallbackCall = vi.fn().mockResolvedValue(makeOpenAIResponse('Fallback reply'));

    const guard = new Guardian({
      fallbacks: [{ callFn: fallbackCall, model: 'gpt-4o-mini' }],
    });

    const result = await guard.protect(primaryCall, 'Hello');
    expect(result.raw).toBe('Fallback reply');
    expect(primaryCall).toHaveBeenCalledTimes(1);
    expect(fallbackCall).toHaveBeenCalledTimes(1);
  });

  it('should try fallbacks sequentially and throw if all fail', async () => {
    const primaryCall = vi.fn().mockRejectedValue(new Error('OpenAI Down'));
    const fallback1 = vi.fn().mockRejectedValue(new Error('Anthropic Down'));
    const fallback2 = vi.fn().mockResolvedValue(makeOpenAIResponse('Gemini reply'));

    const guard = new Guardian({
      budget: { model: 'gpt-4o' },
      fallbacks: [
        { callFn: fallback1 },
        { callFn: fallback2, model: 'gemini-2.0-flash' },
      ],
    });

    const result = await guard.protect(primaryCall, 'Hello');
    expect(result.raw).toBe('Gemini reply');
    expect(primaryCall).toHaveBeenCalledTimes(1);
    expect(fallback1).toHaveBeenCalledTimes(1);
    expect(fallback2).toHaveBeenCalledTimes(1);
    expect(result.meta.budget?.model).toBe('gemini-2.0-flash');
  });

  it('should proactively swap to fallback model if session budget is >80% exhausted', async () => {
    // Session budget limit: 100 tokens
    const primaryCall = vi.fn().mockResolvedValue(makeOpenAIResponse('Premium result', 40, 45)); // 85 tokens used
    const fallbackCall = vi.fn().mockResolvedValue(makeOpenAIResponse('Fallback result', 5, 5));

    const guard = new Guardian({
      budget: { maxTokens: 100, model: 'gpt-4o' },
      fallbacks: [{ callFn: fallbackCall, model: 'gpt-4o-mini' }],
    });

    const session = new GuardianSession();

    // Call 1 uses 85 tokens (85% of limit, which is > 80%)
    const res1 = await guard.protect(primaryCall, 'Prompt 1', { session });
    expect(res1.meta.budget?.model).toBe('gpt-4o');
    expect(session.getCumulativeTokens()).toBe(85);

    // Call 2: since budget is at 85% (>80%), it should proactively swap to the fallbackCall and use 'gpt-4o-mini'
    const res2 = await guard.protect(primaryCall, 'Prompt 2', { session });
    
    expect(fallbackCall).toHaveBeenCalledTimes(1);
    expect(res2.meta.budget?.model).toBe('gpt-4o-mini');
    expect(res2.raw).toBe('Fallback result');
  });
});
