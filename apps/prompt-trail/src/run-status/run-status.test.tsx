import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RunStatus } from '../domain';

import { RUN_STATUS_LABELS, RunStatusPin } from '.';

describe('run status', () => {
  it('provides a Japanese label for every RunStatus', () => {
    const statuses: readonly RunStatus[] = [
      'draft',
      'prepared',
      'in-progress',
      'executed',
      'done',
    ];
    expect(statuses.map((status) => RUN_STATUS_LABELS[status])).toEqual([
      '下書き',
      '準備済み',
      '実行中',
      '実行済み',
      '完了',
    ]);
  });

  it('renders a status pin with the matching Japanese label and modifier class', () => {
    render(<RunStatusPin status="in-progress" />);

    expect(screen.getByText('実行中')).toHaveClass(
      'pt-status-pin',
      'pt-status-pin--in-progress',
    );
  });
});
