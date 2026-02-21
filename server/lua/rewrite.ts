import type { RenamePlan } from './renamePlan.js';

// Applies renames using token-boundary regex to reduce accidental replacements.
// Note: This is a pragmatic MVP approach. For perfect safety, rewrite via AST codegen.
export function applyRenamePlan(luaCode: string, plan: RenamePlan): string {
  let out = luaCode;

  // Longer names first to avoid partial overlaps
  const renames = [...plan.renames].sort((a, b) => b.from.length - a.from.length);

  for (const r of renames) {
    // Replace identifier tokens only.
    // Lua identifier: [A-Za-z_][A-Za-z0-9_]*
    // Use negative lookbehind/lookahead for token boundaries.
    // Also avoid replacing after '.' or ':' to reduce touching table fields/methods.
    const pattern = new RegExp(
      String.raw`(?<![A-Za-z0-9_\.\:])${escapeRegExp(r.from)}(?![A-Za-z0-9_])`,
      'g'
    );
    out = out.replace(pattern, r.to);
  }

  return out;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
