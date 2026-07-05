import { describe, expect, it } from 'vitest';

import {
  CONTEXT_KINDS,
  CONTEXT_STATUSES,
  LINK_ROLES,
  LINK_TYPES,
  PROMPT_KINDS,
  PROMPT_STATUSES,
  PROMPT_TRAIL_ENTITY_KINDS,
  RUN_EVALUATIONS,
  RUN_STATUSES,
} from './index';
import type {
  ArchivableEntity,
  AssetScope,
  BaseEntity,
  Context,
  ContextId,
  ContextKind,
  ContextSnapshot,
  JsonPrimitive,
  JsonValue,
  ContextStatus,
  EntityId,
  GlobalScope,
  Link,
  LinkId,
  LinkRole,
  LinkType,
  Project,
  ProjectId,
  ProjectScope,
  Prompt,
  PromptKind,
  PromptId,
  PromptSnapshot,
  PromptStatus,
  PromptTrailEntityKind,
  Recipe,
  RecipeId,
  Run,
  RunEvaluation,
  RunId,
  RunStatus,
  UtcDateTimeString,
} from './index';

const expectType = <T>(value: T): void => {
  void value;
};

describe('Prompt Trail domain public contract', () => {
  it('exports all entity kinds from the domain entry point', () => {
    expect(PROMPT_TRAIL_ENTITY_KINDS).toEqual([
      'project',
      'prompt',
      'context',
      'recipe',
      'run',
      'link',
    ]);
  });

  it('exports prompt, context, run, and link candidate constants', () => {
    expect(PROMPT_KINDS).toEqual([
      'chat-consultation',
      'codex-request',
      'issue-creation',
      'design-review',
      'incident-analysis',
      'other',
    ]);
    expect(PROMPT_STATUSES).toEqual(['draft', 'active', 'deprecated']);

    expect(CONTEXT_KINDS).toEqual([
      'project-overview',
      'technical-architecture',
      'development-rules',
      'glossary',
      'output-rules',
      'other',
    ]);
    expect(CONTEXT_STATUSES).toEqual(['enabled', 'disabled']);

    expect(RUN_STATUSES).toEqual([
      'draft',
      'prepared',
      'executed',
      'in-progress',
      'done',
    ]);
    expect(RUN_EVALUATIONS).toEqual(['good', 'needs-improvement', 'failed']);

    expect(LINK_TYPES).toEqual([
      'chat',
      'issue',
      'pull-request',
      'commit',
      'release',
      'document',
      'external',
    ]);
    expect(LINK_ROLES).toEqual([
      'source',
      'reference',
      'execution',
      'output',
      'result',
    ]);
  });

  it('exposes asset scopes, IDs, models, and snapshots as public types', () => {
    type PublicContract = {
      readonly entityKind: PromptTrailEntityKind;
      readonly entityId: EntityId<'project'>;
      readonly baseEntity: BaseEntity<'project'>;
      readonly archivableEntity: ArchivableEntity;
      readonly projectId: ProjectId;
      readonly promptId: PromptId;
      readonly contextId: ContextId;
      readonly recipeId: RecipeId;
      readonly runId: RunId;
      readonly linkId: LinkId;
      readonly utc: UtcDateTimeString;
      readonly jsonPrimitive: JsonPrimitive;
      readonly jsonValue: JsonValue;
      readonly globalScope: GlobalScope;
      readonly projectScope: ProjectScope;
      readonly assetScope: AssetScope;
      readonly project: Project;
      readonly prompt: Prompt;
      readonly promptKind: PromptKind;
      readonly promptStatus: PromptStatus;
      readonly context: Context;
      readonly contextKind: ContextKind;
      readonly contextStatus: ContextStatus;
      readonly recipe: Recipe;
      readonly run: Run;
      readonly runStatus: RunStatus;
      readonly runEvaluation: RunEvaluation;
      readonly link: Link;
      readonly linkType: LinkType;
      readonly linkRole: LinkRole;
      readonly promptSnapshot: PromptSnapshot;
      readonly contextSnapshot: ContextSnapshot;
    };

    expectType<PublicContract>({} as PublicContract);
  });
});
