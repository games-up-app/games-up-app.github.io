// JSON canônico (chaves ordenadas): a assinatura não depende da ordem dos campos.
export function canonico(v) {
  if (Array.isArray(v)) return `[${v.map(canonico).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonico(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}
