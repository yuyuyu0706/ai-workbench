/** The persisted Prompt shape before `kind` was migrated into `tags`. */
interface LegacyPromptV3 {
  kind?: string;
  tags: string[];
}

const KIND_TAG_LABELS: Record<string, string> = {
  'chat-consultation': 'チャット相談',
  'codex-request': 'Codex依頼',
  'issue-creation': 'Issue作成',
  'design-review': '設計レビュー',
  'incident-analysis': '障害分析',
};

export function migratePromptFromV3(prompt: LegacyPromptV3): void {
  const label = prompt.kind === undefined ? undefined : KIND_TAG_LABELS[prompt.kind];
  if (label !== undefined && !prompt.tags.includes(label)) prompt.tags.push(label);
  delete prompt.kind;
}
