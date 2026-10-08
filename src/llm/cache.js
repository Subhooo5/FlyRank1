const crypto = require('crypto');

const store = new Map();

function keyFor(text, version) {
  return crypto.createHash('sha256').update(`${version}:${text}`).digest('hex');
}

function get(key) {
  return store.get(key);
}

function set(key, value) {
  store.set(key, value);
}

module.exports = { keyFor, get, set };