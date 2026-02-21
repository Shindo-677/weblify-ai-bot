import OpenAI from 'openai';
import { z } from 'zod';
import type { IdentifierMeta } from './scan.js';

const SuggestionSchema = z.object({
  suggestions: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
    })
  ),
});

export async function aiSuggest(args: {
  apiKey: string;
  model?: string;
  luaCode: string;
  identifiers: IdentifierMeta[];
}): Promise<{ from: string; to: string }[]> {
  const client = new OpenAI({ apiKey: args.apiKey });

  const idList = args.identifiers.map((i) => ({ name: i.name, kind: i.kind }));

  const prompt = `You are refactoring Lua code. Suggest clearer names for identifiers.

Rules:
- Output STRICT JSON only: {"suggestions":[{"from":"...","to":"..."}]}
- Keep 'from' exactly as provided.
- 'to' must be a valid Lua identifier: ^[A-Za-z_][A-Za-z0-9_]*$
- Prefer descriptive camelCase.
- Avoid Lua keywords and standard library names.
- Do NOT rename fields accessed as tbl.x unless x is a declared local/function/param name in the provided list.

Identifiers to rename (declared names): ${JSON.stringify(idList)}

Lua code:
\n\n${args.luaCode}`;

  // ✅ FIXED: Use chat.completions.create() instead of responses.create()
  const resp = await client.chat.completions.create({
    model: args.model ?? 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_tokens: 1000,
  });

  // ✅ FIXED: Extract text from correct response structure
  const text = resp.choices[0]?.message?.content ?? '';

  if (!text) {
    throw new Error('AI response was empty');
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    // Try to recover if model wrapped JSON in markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        json = JSON.parse(jsonMatch[1]);
      } catch {
        throw new Error(`Failed to parse JSON from AI response: ${text.slice(0, 200)}`);
      }
    } else {
      // Try to extract JSON object directly
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          json = JSON.parse(text.slice(start, end + 1));
        } catch {
          throw new Error(`Failed to parse JSON from AI response: ${text.slice(0, 200)}`);
        }
      } else {
        throw new Error('AI response was not valid JSON');
      }
    }
  }

  const parsed = SuggestionSchema.parse(json);
  return parsed.suggestions;
        }
