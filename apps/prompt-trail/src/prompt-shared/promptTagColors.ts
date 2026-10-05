export const PROMPT_TAG_COLOR_COUNT = 8;

// FNV-1a (32-bit) hash. Deterministic, order-sensitive, no dependency.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

function fnv1a32(value: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

export function promptTagColorIndex(tag: string): number {
  return fnv1a32(tag) % PROMPT_TAG_COLOR_COUNT;
}
