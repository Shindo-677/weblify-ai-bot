export type IdentifierMeta = {
  name: string;
  kind: 'local' | 'param' | 'function' | 'global';
};

// Collect declared identifiers (not all references). This keeps renames safer.
export function collectIdentifiers(ast: any): IdentifierMeta[] {
  const out: IdentifierMeta[] = [];

  function pushUnique(name: string, kind: IdentifierMeta['kind']) {
    if (!name) return;
    if (out.some((x) => x.name === name && x.kind === kind)) return;
    out.push({ name, kind });
  }

  function walk(node: any) {
    if (!node || typeof node !== 'object') return;

    switch (node.type) {
      case 'LocalStatement':
        for (const v of node.variables ?? []) {
          if (v?.type === 'Identifier') pushUnique(v.name, 'local');
        }
        break;
      case 'FunctionDeclaration':
        // function name
        if (node.identifier?.type === 'Identifier') {
          pushUnique(node.identifier.name, node.isLocal ? 'local' : 'global');
        }
        // parameters
        for (const p of node.parameters ?? []) {
          if (p?.type === 'Identifier') pushUnique(p.name, 'param');
        }
        break;
      case 'ForNumericStatement':
      case 'ForGenericStatement':
        if (node.variable?.type === 'Identifier') pushUnique(node.variable.name, 'local');
        for (const v of node.variables ?? []) {
          if (v?.type === 'Identifier') pushUnique(v.name, 'local');
        }
        break;
      default:
        break;
    }

    for (const key of Object.keys(node)) {
      const val = node[key];
      if (Array.isArray(val)) {
        for (const child of val) walk(child);
      } else if (val && typeof val === 'object') {
        walk(val);
      }
    }
  }

  walk(ast);

  // Exclude common Lua globals/keywords
  const blocked = new Set([
    'and','break','do','else','elseif','end','false','for','function','goto','if','in','local','nil','not','or','repeat','return','then','true','until','while',
    '_G','_VERSION','assert','collectgarbage','dofile','error','getmetatable','ipairs','load','loadfile','next','pairs','pcall','print','rawequal','rawget','rawlen','rawset','require','select','setmetatable','tonumber','tostring','type','xpcall',
    'coroutine','string','table','math','io','os','debug','utf8','package'
  ]);

  return out.filter((x) => !blocked.has(x.name));
}
