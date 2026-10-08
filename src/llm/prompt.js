const fs = require('fs');
const path = require('path');

const version = process.env.PROMPT_VERSION || 'v1';
const file = path.join(__dirname, '..', '..', 'prompts', `triage-${version}.md`);
const systemPrompt = fs.readFileSync(file, 'utf-8');

module.exports = { version, systemPrompt };