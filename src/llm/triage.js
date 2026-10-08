const client = require('./client');
const { systemPrompt } = require('./prompt');
const { stubAnswer } = require('./stub');

async function runTriage(text) {
  if (process.env.LLM_STUB === '1') {
    return stubAnswer;
  }

  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: JSON.stringify({ text }) }
    ]
  });
  
  return { raw: res.choices[0].message.content };
}

module.exports = { runTriage };