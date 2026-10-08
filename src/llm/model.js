const client = require('./client');

async function callModel(messages) {
  const res = await client.chat.completions.create({
    model: process.env.LLM_MODEL,
    temperature: 0,
    messages
  });
  
  return { content: res.choices[0].message.content || '', usage: res.usage || {} };
}

module.exports = { callModel };