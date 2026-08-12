import type { RunStatus } from '../domain';

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: '下書き',
  prepared: '準備済み',
  'in-progress': '実行中',
  executed: '実行済み',
  done: '完了',
};
