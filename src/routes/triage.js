const express = require('express');
const { inputSchema } = require('../llm/schema');
const { runTriage } = require('../llm/triage');

const router = express.Router();

router.post('/triage', async (req, res) => {
  const parsed = inputSchema.safeParse(req.body || {});

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.') || 'body';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  
  const result = await runTriage(parsed.data.text);
  res.status(200).json(result);
});

module.exports = router;