export const PROMPT_TAG_MAX_LENGTH = 24;
export const PROMPT_TAG_MAX_COUNT = 10;

export function normalizePromptTag(tag: string): string {
  return tag.trim();
}

export function isValidPromptTagLength(tag: string): boolean {
  const normalized = normalizePromptTag(tag);
  return normalized.length > 0 && normalized.length <= PROMPT_TAG_MAX_LENGTH;
}

export function addPromptTag(
  tags: readonly string[],
  tag: string,
): readonly string[] {
  const normalized = normalizePromptTag(tag);
  if (normalized.length === 0) return tags;
  if (normalized.length > PROMPT_TAG_MAX_LENGTH) return tags;
  if (tags.length >= PROMPT_TAG_MAX_COUNT) return tags;
  const lower = normalized.toLowerCase();
  if (tags.some((existing) => existing.toLowerCase() === lower)) return tags;
  return [...tags, normalized];
}

export function removePromptTag(
  tags: readonly string[],
  tag: string,
): readonly string[] {
  return tags.filter((existing) => existing !== tag);
}
