const { z } = require('zod');

const categories = ['work', 'study', 'personal', 'shopping', 'other'];
const priorities = ['low', 'normal', 'high'];

const inputSchema = z.object({
  text: z.string().min(1).max(2000)
});

const outputSchema = z
  .object({
    category: z.enum(categories),
    priority: z.enum(priorities),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(200)
  })
  .strict();

const outputJsonSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: categories },
    priority: { type: 'string', enum: priorities },
    confidence: { type: 'number' },
    reason: { type: 'string' }
  },
  required: ['category', 'priority', 'confidence', 'reason'],
  additionalProperties: false
};

module.exports = { inputSchema, outputSchema, outputJsonSchema };