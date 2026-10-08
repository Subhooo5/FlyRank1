const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', '..', 'logs', 'quarantine.jsonl');

function quarantine(entry) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
  fs.appendFileSync(file, line + '\n');
}

module.exports = { quarantine };