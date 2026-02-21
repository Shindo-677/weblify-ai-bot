import type { IdentifierMeta } from './scan.js';

// Very simple fallback naming if AI is not configured.
export function heuristicSuggest(_luaCode: string, identifiers: IdentifierMeta[]): { from: string; to: string }[] {
  const res: { from: string; to: string }[] = [];
  const counters: Record<string, number> = {};

  function next(base: string) {
    counters[base] = (counters[base] ?? 0) + 1;
    return counters[base] === 1 ? base : `${base}${counters[base]}`;
  }

  for (const id of identifiers) {
    const base =
      id.kind === 'param'
        ? 'param'
        : id.kind === 'function'
          ? 'doWork'
          : id.kind === 'global'
            ? 'globalValue'
            : 'localValue';

    res.push({ from: id.name, to: next(base) });
  }

  return res;
}
