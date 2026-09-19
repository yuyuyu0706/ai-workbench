import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrailStepForm, type TrailStepFormValues } from './TrailStepForm';

const prompts = [
  { id: 'prompt-1', title: 'Prompt One' },
  { id: 'prompt-2', title: 'Prompt Two' },
] as never;

function baseProps(overrides: Partial<Parameters<typeof TrailStepForm>[0]> = {}) {
  const values: TrailStepFormValues = {
    title: 'Step',
    kind: 'prompt',
    promptId: 'prompt-1',
  };
  return {
    mode: 'add' as const,
    values,
    prompts,
    status: 'editing' as const,
    validationErrors: [],
    staleNotice: 'none' as const,
    isDirty: true,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
}

describe('TrailStepForm', () => {
  it('shows the Prompt select only when kind is prompt', () => {
    const { rerender } = render(<TrailStepForm {...baseProps()} />);
    expect(screen.getByLabelText('Prompt')).toBeInTheDocument();

    rerender(
      <TrailStepForm
        {...baseProps({
          values: { title: 'Step', kind: 'manual', promptId: null },
        })}
      />,
    );
    expect(screen.queryByLabelText('Prompt')).not.toBeInTheDocument();
  });

  it('disables submit when there is no unsaved change', () => {
    render(<TrailStepForm {...baseProps({ isDirty: false })} />);
    expect(screen.getByRole('button', { name: '追加する' })).toBeDisabled();
  });

  it('enables submit when dirty and not submitting', () => {
    render(<TrailStepForm {...baseProps({ isDirty: true })} />);
    expect(screen.getByRole('button', { name: '追加する' })).toBeEnabled();
  });

  it('shows a notice and disables submit when no Prompts are registered and kind is prompt', () => {
    render(
      <TrailStepForm
        {...baseProps({
          prompts: [] as never,
          values: { title: 'Step', kind: 'prompt', promptId: null },
        })}
      />,
    );
    expect(screen.getByText(/Promptが登録されていません/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '追加する' })).toBeDisabled();
  });

  it('does not disable submit for kind manual even with no Prompts', () => {
    render(
      <TrailStepForm
        {...baseProps({
          prompts: [] as never,
          values: { title: 'Step', kind: 'manual', promptId: null },
        })}
      />,
    );
    expect(screen.getByRole('button', { name: '追加する' })).toBeEnabled();
  });

  it('shows the edit submit label', () => {
    render(<TrailStepForm {...baseProps({ mode: 'edit' })} />);
    expect(screen.getByRole('button', { name: '変更を保存' })).toBeInTheDocument();
  });

  it('shows the refreshed stale notice without alarming wording', () => {
    render(
      <TrailStepForm
        {...baseProps({ status: 'stale', staleNotice: 'refreshed' })}
      />,
    );
    expect(
      screen.getByText(/最新の状態を読み込みました/),
    ).toBeInTheDocument();
  });

  it('shows the conflicted stale notice as a warning', () => {
    render(
      <TrailStepForm
        {...baseProps({ status: 'stale', staleNotice: 'conflicted' })}
      />,
    );
    expect(
      screen.getByText(/別の場所でこのStepが変更されました/),
    ).toBeInTheDocument();
  });

  it('supplements the Prompt select with the current, now-inactive Prompt', () => {
    render(
      <TrailStepForm
        {...baseProps({
          values: { title: 'Step', kind: 'prompt', promptId: 'prompt-old' },
          currentPrompt: { id: 'prompt-old', title: 'Old Prompt' } as never,
        })}
      />,
    );
    expect(screen.getByText('Old Prompt（現在の設定）')).toBeInTheDocument();
  });

  it('disables all fields and the submit button while submitting', () => {
    render(<TrailStepForm {...baseProps({ status: 'submitting' })} />);
    expect(screen.getByLabelText('Step名')).toBeDisabled();
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
  });
});
