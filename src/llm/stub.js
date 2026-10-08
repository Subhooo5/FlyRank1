const stubAnswer = {
  category: 'other',
  priority: 'low',
  confidence: 0.5,
  reason: 'Stub answer, no model was called.'
};

const fallbackAnswer = {
  category: 'other',
  priority: 'normal',
  confidence: 0,
  reason: 'The AI feature is switched off, so this is a safe default.'
};

module.exports = { stubAnswer, fallbackAnswer };