const express = require('express');
const { inputSchema } = require('../llm/schema');
const { runTriage, InvalidOutputError } = require('../llm/triage');
const { isTimeout } = require('../llm/model');

const router = express.Router();

function failureFor(error) {
  if (error instanceof InvalidOutputError) {
    return { status: 422, message: 'The model returned an answer that failed validation' };
  }

  if (isTimeout(error)) {
    return { status: 504, message: 'The model took too long to answer' };
  }

  if (error.status === 401 || error.status === 403) {
    return { status: 502, message: 'The model provider rejected the API key' };
  }

  if (error.status === 429) {
    return { status: 503, message: 'The model provider is rate limiting requests, try again later' };
  }

  return { status: 502, message: 'The model provider failed' };
}

router.post('/triage', async (req, res) => {
  const parsed = inputSchema.safeParse(req.body || {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join('.') || 'body';
    return res.status(400).json({ error: `${field}: ${issue.message}` });
  }
  
  try {
    const result = await runTriage(parsed.data.text);
    res.status(200).json(result);
  } 
  catch (error) {
    const failure = failureFor(error);
    res.status(failure.status).json({ error: failure.message });
  }
});

module.exports = router;