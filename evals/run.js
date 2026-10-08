require('dotenv').config();
const cases = require('./cases.json');
const { version } = require('../src/llm/prompt');

const url = process.env.EVAL_URL || 'http://localhost:3000/triage';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  let matched = 0;
  const failed = [];

  for (const item of cases) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: item.text })
    });
    
    const body = await res.json();
    if (res.status === 200 && body.category === item.expected) {
      matched += 1;
    } 
    else {
      failed.push({
        id: item.id,
        text: item.text,
        expected: item.expected,
        got: body.category || body.error,
        status: res.status
      });
    }
    await sleep(3500);
  }

  const percent = Math.round((matched / cases.length) * 100);
  const date = new Date().toISOString().slice(0, 10);
  
  console.log(`date=${date} prompt=${version} model=${process.env.LLM_MODEL}`);
  console.log(`score=${matched}/${cases.length} (${percent}%)`);
  console.log('failed:', failed);
}

main();