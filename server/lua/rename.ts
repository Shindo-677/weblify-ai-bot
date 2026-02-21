import luaparse from 'luaparse';
import { buildRenamePlan } from './renamePlan.js';
import { applyRenamePlan } from './rewrite.js';

export type RenameOptions = {
  openAiApiKey?: string;
  openAiModel?: string;
};

export async function renameLuaCode(luaCode: string, opts: RenameOptions): Promise<string> {
  // Parse to ensure valid Lua and to extract identifiers.
  let ast: any;
  try {
    ast = luaparse.parse(luaCode, {
      luaVersion: '5.3',
      locations: true,
      ranges: true,
      comments: false,
      scope: true,
    });
  } catch (e: any) {
    throw new Error(`Lua parse error: ${e?.message ?? e}`);
  }

  const plan = await buildRenamePlan(luaCode, ast, opts);
  if (plan.renames.length === 0) return luaCode;
  return applyRenamePlan(luaCode, plan);
}
