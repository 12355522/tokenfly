'use strict';

// Pricing per million tokens (USD) as of 2026
const MODEL_PRICING = {
  // Claude 4 Sonnet
  'claude-sonnet-4': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  // Claude 4 Opus
  'claude-opus-4': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
  'claude-opus-4-5': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
  'claude-opus-4-7': {
    input: 15.0,
    output: 75.0,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
  // Claude 4 Haiku
  'claude-haiku-4': {
    input: 0.80,
    output: 4.0,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
  'claude-haiku-4-5': {
    input: 0.80,
    output: 4.0,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
  // Claude 3.7 Sonnet
  'claude-3-7-sonnet': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  // Claude 3.5 Sonnet/Haiku fallback
  'claude-3-5-sonnet': {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-3-5-haiku': {
    input: 0.80,
    output: 4.0,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
  // Default fallback
  default: {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
};

function getPricing(model) {
  if (!model) return MODEL_PRICING.default;
  const lower = model.toLowerCase();
  // Match by prefix (longest match first)
  const keys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (key !== 'default' && lower.includes(key)) {
      return MODEL_PRICING[key];
    }
  }
  return MODEL_PRICING.default;
}

/**
 * Calculate USD cost for a usage record.
 * @param {object} usage - The usage object from Claude API response
 * @param {string} model - Model name
 * @returns {number} cost in USD
 */
function calculateCost(usage, model) {
  const pricing = getPricing(model);
  const M = 1_000_000;

  const inputCost = ((usage.input_tokens || 0) / M) * pricing.input;
  const outputCost = ((usage.output_tokens || 0) / M) * pricing.output;
  const cacheWriteCost = ((usage.cache_creation_input_tokens || 0) / M) * pricing.cacheWrite;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) / M) * pricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Format USD amount with appropriate precision.
 */
function formatCost(usd) {
  if (usd === 0) return '$0.00';
  if (usd < 0.001) return `$${(usd * 1000).toFixed(4)}m`; // show in milli-dollars
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

/**
 * Format token count for display.
 */
function formatTokens(n) {
  if (n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

module.exports = { calculateCost, formatCost, formatTokens, getPricing };
