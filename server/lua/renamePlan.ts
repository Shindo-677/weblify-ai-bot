import { z } from 'zod';
import { heuristicSuggest } from './suggestHeuristic.js';
import { aiSuggest } from './suggestOpenAI.js';
import { collectIdentifiers } from './scan.js';

export type Rename = {
  from: string;
  to: string;
  kind: 'local' | 'param' | 'function' | 'global';
};

export type RenamePlan = {
  renames: Rename[];
};

const OptsSchema = z.object({
  openAiApiKey: z.string().min(1).optional(),
  openAiModel: z.string().min(1).optional(),
});

export async function buildRenamePlan(luaCode: string, ast: any, opts: unknown): Promise<RenamePlan> {
  const { openAiApiKey, openAiModel } = OptsSchema.parse(opts);

  const ids = collectIdentifiers(ast);
  // Filter to "bad" names (short/meaningless), while avoiding Lua keywords.
  const candidates = ids.filter((i) => i.name.length <= 2 || /^[a-z]$/.test(i.name));

  if (candidates.length === 0) return { renames: [] };

  // Limit to keep responses safe and fast
  const maxCandidates = 60;
  const trimmed = candidates.slice(0, maxCandidates);

  // Build suggestions
  let suggestions: { from: string; to: string }[] = [];

  // ✅ IMPROVED: Add error handling for AI with fallback to heuristic
  if (openAiApiKey) {
    try {
      suggestions = await aiSuggest({
        apiKey: openAiApiKey,
        model: openAiModel,
        luaCode,
        identifiers: trimmed,
      });
    } catch (e: any) {
      console.warn(`AI suggestion failed, falling back to heuristic: ${e?.message ?? e}`);
      suggestions = heuristicSuggest(luaCode, trimmed);
    }
  } else {
    suggestions = heuristicSuggest(luaCode, trimmed);
  }

  const taken = new Set(ids.map((x) => x.name));
  const renames: Rename[] = [];

  for (const s of suggestions) {
    const from = s.from;
    let to = s.to;
    const meta = trimmed.find((x) => x.name === from);
    if (!meta) continue;

    // Sanitize: Lua identifiers
    to = to.replace(/[^a-zA-Z0-9_]/g, '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(to)) continue;
    if (to === from) continue;

    // Avoid collisions; add suffix if needed
    if (taken.has(to)) {
      let n = 2;
      while (taken.has(`${to}${n}`)) n++;
      to = `${to}${n}`;
    }

    taken.add(to);
    renames.push({ from, to, kind: meta.kind });
  }

  return { renames };
}
