/** The persisted Prompt shape before variable values became persisted. */
interface LegacyPromptV2 {
  variableValues?: Record<string, string>;
}

export function migratePromptFromV2(prompt: LegacyPromptV2): void {
  if (prompt.variableValues === undefined) prompt.variableValues = {};
}
