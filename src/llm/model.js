const client = require('./client');
const { log } = require('./log');

const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isTimeout(error) {
  return error.name === 'APIConnectionTimeoutError';
}

function isRetryable(error) {
  return isTimeout(error) || error.status === 429 || error.status >= 500;
}

function readHeader(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }
  
  return headers[name] || null;
}

function waitTime(error, attempt) {
  const header = readHeader(error.headers, 'retry-after');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds)) {
      return seconds * 1000;
    }

    const date = Date.parse(header);
    if (!Number.isNaN(date)) {
      return Math.max(date - Date.now(), 0);
    }
  }
  return BASE_DELAY_MS * 2 ** (attempt - 1) + Math.random() * 500;
}

async function callModel(messages) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const started = Date.now();
    try {
      const res = await client.chat.completions.create({
        model: process.env.LLM_MODEL,
        temperature: 0,
        messages
      });

      return {
        content: res.choices[0].message.content || '',
        usage: res.usage || {},
        durationMs: Date.now() - started
      };
    } 
    catch (error) {
      const status = error.status || error.name;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        log({ event: 'llm_error', status, attempt });
        throw error;
      }

      const wait = waitTime(error, attempt);
      log({ event: 'llm_retry', status, attempt, waitMs: Math.round(wait) });
      await sleep(wait);
    }
  }
}

module.exports = { callModel, isTimeout };