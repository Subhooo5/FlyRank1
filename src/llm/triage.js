const { callModel } = require('./model');
const { systemPrompt, version } = require('./prompt');
const { checkOutput } = require('./parse');
const { quarantine } = require('./quarantine');
const { stubAnswer, fallbackAnswer } = require('./stub');
const { log } = require('./log');
const { keyFor, get, set } = require('./cache');

class InvalidOutputError extends Error {}

async function runTriage(text) {
  if (process.env.LLM_ENABLED === 'false') {
    log({ event: 'llm_disabled' });
    return fallbackAnswer;
  }
  
  if (process.env.LLM_STUB === '1') {
    return stubAnswer;
  }

  const key = keyFor(text, version);
  const cached = get(key);
  if (cached) {
    log({ event: 'cache_hit', promptVersion: version });
    return cached;
  }

  const totals = { inputTokens: 0, outputTokens: 0, durationMs: 0 };

  const ask = async (messages) => {
    const call = await callModel(messages);
    totals.inputTokens += call.usage.prompt_tokens || 0;
    totals.outputTokens += call.usage.completion_tokens || 0;
    totals.durationMs += call.durationMs;
    return call.content;
  };

  const record = (repaired, failed) => {
    log({
      event: 'llm_call',
      promptVersion: version,
      model: process.env.LLM_MODEL,
      ...totals,
      repaired,
      failed
    });
  };

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify({ text }) }
  ];

  const firstOutput = await ask(messages);
  const first = checkOutput(firstOutput);

  if (first.ok) {
    record(0, false);
    return first.data;
  }

  const repairMessages = [
    ...messages,
    { role: 'assistant', content: firstOutput },
    {
      role: 'user',
      content: `Your previous answer was rejected for this reason: ${first.error}. Return only corrected JSON matching the schema.`
    }
  ];

  const secondOutput = await ask(repairMessages);
  const second = checkOutput(secondOutput);
  if (second.ok) {
    record(1, false);
    return second.data;
  }

  record(1, true);

  quarantine({
    promptVersion: version,
    input: text,
    firstOutput,
    secondOutput,
    error: second.error
  });

  throw new InvalidOutputError(second.error);
}

module.exports = { runTriage, InvalidOutputError };