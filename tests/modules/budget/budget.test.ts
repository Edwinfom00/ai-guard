import { describe, it, expect, vi } from 'vitest';
import { estimateTokens } from '../../../src/modules/budget/tokenizer.js';
import { buildUsage, checkBudget, calculateCost } from '../../../src/modules/budget/sentinel.js';
import { BudgetError } from '../../../src/core/errors.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('returns a positive number for normal text', () => {
    expect(estimateTokens('Hello world, how are you?')).toBeGreaterThan(0);
  });

  it('estimates more tokens for longer text', () => {
    const short = estimateTokens('Hi');
    const long = estimateTokens('Hi, this is a much longer sentence with more words and content.');
    expect(long).toBeGreaterThan(short);
  });
});

describe('calculateCost', () => {
  it('calculates cost for gpt-4o-mini', () => {
    // 1000 input + 500 output at $0.15 / $0.60 per 1M
    const cost = calculateCost(1000, 500, 'gpt-4o-mini');
    expect(cost).toBeCloseTo(0.00015 + 0.0003, 6);
  });

  it('returns 0 for unknown model', () => {
    expect(calculateCost(1000, 500, 'unknown')).toBe(0);
  });

  it('calculates correctly for claude-3-5-sonnet', () => {
    const cost = calculateCost(1_000_000, 1_000_000, 'claude-3-5-sonnet-20241022');
    expect(cost).toBeCloseTo(18, 1); // $3 input + $15 output
  });
});

describe('buildUsage', () => {
  it('uses real token counts when provided', () => {
    const usage = buildUsage('input text', 'output text', 'gpt-4o-mini', 100, 50);
    expect(usage.inputTokens).toBe(100);
    expect(usage.outputTokens).toBe(50);
    expect(usage.totalTokens).toBe(150);
  });

  it('estimates tokens when real counts not provided', () => {
    const usage = buildUsage('hello world', 'response here', 'gpt-4o-mini');
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  });

  it('includes model and cost in result', () => {
    const usage = buildUsage('test', 'test', 'gpt-4o-mini', 100, 100);
    expect(usage.model).toBe('gpt-4o-mini');
    expect(usage.estimatedCostUSD).toBeGreaterThan(0);
  });
});

describe('checkBudget', () => {
  it('passes when under token limit', () => {
    const usage = buildUsage('', '', 'gpt-4o-mini', 100, 100);
    expect(() => checkBudget(usage, { maxTokens: 1000 })).not.toThrow();
  });

  it('throws BudgetError when token limit exceeded', () => {
    const usage = buildUsage('', '', 'gpt-4o-mini', 600, 600);
    expect(() => checkBudget(usage, { maxTokens: 500 })).toThrow(BudgetError);
  });

  it('throws BudgetError when cost limit exceeded', () => {
    // 1M tokens of gpt-4o (most expensive) costs > $0.001
    const usage = buildUsage('', '', 'gpt-4o', 10_000, 10_000);
    expect(() => checkBudget(usage, { maxCostUSD: 0.00001 })).toThrow(BudgetError);
  });

  it('calls onWarning when usage is between 80-100% of limit', () => {
    const onWarning = vi.fn();
    const usage = buildUsage('', '', 'gpt-4o-mini', 850, 0); // 85% of 1000
    checkBudget(usage, { maxTokens: 1000, onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('does not call onWarning when well under limit', () => {
    const onWarning = vi.fn();
    const usage = buildUsage('', '', 'gpt-4o-mini', 100, 0);
    checkBudget(usage, { maxTokens: 1000, onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
