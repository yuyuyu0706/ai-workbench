const VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function extractPromptVariables(body: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const match of body.matchAll(VAR_PATTERN)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export function resolvePromptVariables(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(VAR_PATTERN, (original, name: string) => {
    const val = values[name];
    return val !== undefined && val !== '' ? val : original;
  });
}
