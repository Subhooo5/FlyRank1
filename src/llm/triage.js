const { callModel } = require('./model');
const { systemPrompt, version } = require('./prompt');
const { checkOutput } = require('./parse');
const { quarantine } = require('./quarantine');
const { stubAnswer } = require('./stub');

class InvalidOutputError extends Error {}

async function runTriage(text) {
  if (process.env.LLM_STUB === '1') {
    return stubAnswer;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: JSON.stringify({ text }) }
  ];

  const first = await callModel(messages);
  const firstCheck = checkOutput(first.content);
  if (firstCheck.ok) {
    return firstCheck.data;
  }

  const repairMessages = [
    ...messages,
    { role: 'assistant', content: first.content },
    {
      role: 'user',
      content: `Your previous answer was rejected for this reason: ${firstCheck.error}. Return only corrected JSON matching the schema.`
    }
  ];

  const second = await callModel(repairMessages);
  const secondCheck = checkOutput(second.content);
  if (secondCheck.ok) {
    return secondCheck.data;
  }

  quarantine({
    promptVersion: version,
    input: text,
    firstOutput: first.content,
    secondOutput: second.content,
    error: secondCheck.error
  });
  
  throw new InvalidOutputError(secondCheck.error);
}

module.exports = { runTriage, InvalidOutputError };