const express = require('express');
const { inputSchema, outputSchema } = require('../llm/schema');
const { stubAnswer } = require('../llm/stub');

const router = express.Router();

router.post('/triage', (req, res) => {
  const parsed = inputSchema.safeParse(req.body || {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.') || 'body';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  
  res.status(200).json(outputSchema.parse(stubAnswer));
});

module.exports = router;