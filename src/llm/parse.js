const { outputSchema } = require('./schema');

function extractJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new Error('No JSON object found in the output');
  }

  return JSON.parse(text.slice(start, end + 1));
}

function checkOutput(raw) {
  let data;
  try {
    data = extractJson(raw);
  } 
  catch (error) {
    return { ok: false, error: error.message };
  }

  const result = outputSchema.safeParse(data);

  if (!result.success) {
    const error = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ');
    return { ok: false, error };
  }

  return { ok: true, data: result.data };
}

module.exports = { checkOutput };