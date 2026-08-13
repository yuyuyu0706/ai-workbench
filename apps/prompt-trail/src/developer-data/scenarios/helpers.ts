import type {
  LinkId,
  ProjectId,
  PromptId,
  RecipeId,
  RunId,
  TrailId,
  UtcDateTimeString,
} from '../../domain';

export const utc = (value: string): UtcDateTimeString =>
  value as UtcDateTimeString;
export const projectId = (value: string): ProjectId => value as ProjectId;
export const promptId = (value: string): PromptId => value as PromptId;
export const recipeId = (value: string): RecipeId => value as RecipeId;
export const runId = (value: string): RunId => value as RunId;
export const trailId = (value: string): TrailId => value as TrailId;
export const linkId = (value: string): LinkId => value as LinkId;
