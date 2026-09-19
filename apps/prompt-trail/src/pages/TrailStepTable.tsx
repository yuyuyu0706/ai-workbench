import { useEffect, useRef, useState } from 'react';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageSection } from '../components/ui';
import { addTrailStep } from '../trail-detail/add-trail-step';
import type { TrailDetailStepItem } from '../trail-detail/trail-detail-read-query';
import type { Prompt, PromptId, Trail } from '../domain';
import { validateTrailStepMetadata } from '../trail-step-metadata';
import { RunPopover } from './RunPopover';
import { TrailStepForm, type TrailStepFormValues } from './step-forms/TrailStepForm';
import { TrailStepRow } from './TrailStepRow';

type AddFormSnapshot = {
  readonly values: TrailStepFormValues;
  readonly expectedUpdatedAt: Trail['updatedAt'];
  readonly status: 'editing' | 'submitting' | 'failure' | 'stale';
  readonly validationErrors: readonly string[];
  readonly staleNotice: 'none' | 'refreshed';
  readonly confirmingDiscard: boolean;
};

const EMPTY_VALUES: TrailStepFormValues = {
  title: '',
  kind: 'prompt',
  promptId: null,
};

export function TrailStepTable({
  trail,
  steps,
  availablePrompts,
  onChanged,
  onStepSaved,
}: {
  trail: Trail;
  steps: readonly TrailDetailStepItem[];
  availablePrompts: readonly Prompt[];
  onChanged: () => void;
  onStepSaved: () => void;
}) {
  const repository = usePromptTrailRepository();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const submissionRef = useRef<symbol | null>(null);
  const [addForm, setAddForm] = useState<AddFormSnapshot | null>(null);

  const isDirty =
    addForm !== null &&
    (addForm.values.title !== EMPTY_VALUES.title ||
      addForm.values.kind !== EMPTY_VALUES.kind ||
      addForm.values.promptId !== EMPTY_VALUES.promptId);

  function openAddForm() {
    setAddForm({
      values: EMPTY_VALUES,
      expectedUpdatedAt: trail.updatedAt,
      status: 'editing',
      validationErrors: [],
      staleNotice: 'none',
      confirmingDiscard: false,
    });
  }

  function requestClose() {
    if (addForm === null) return;
    if (addForm.status === 'submitting') return;
    if (isDirty && !addForm.confirmingDiscard) {
      setAddForm({ ...addForm, confirmingDiscard: true });
      return;
    }
    setAddForm(null);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  }

  function cancelDiscard() {
    if (addForm === null) return;
    setAddForm({ ...addForm, confirmingDiscard: false });
  }

  async function submitAdd(event: React.FormEvent) {
    event.preventDefault();
    if (addForm === null || addForm.status === 'submitting') return;
    const errors = validateTrailStepMetadata(addForm.values);
    if (errors.length > 0) {
      setAddForm({ ...addForm, status: 'failure', validationErrors: errors });
      return;
    }
    const token = Symbol('add-trail-step');
    submissionRef.current = token;
    setAddForm({
      ...addForm,
      status: 'submitting',
      validationErrors: [],
    });
    const result = await addTrailStep(repository, {
      trailId: trail.id,
      expectedUpdatedAt: addForm.expectedUpdatedAt,
      title: addForm.values.title,
      kind: addForm.values.kind,
      promptId:
        addForm.values.kind === 'prompt'
          ? (addForm.values.promptId as PromptId | null)
          : null,
    });
    if (submissionRef.current !== token) return;
    submissionRef.current = null;
    if (result.status === 'success') {
      setAddForm(null);
      onStepSaved();
      requestAnimationFrame(() => addButtonRef.current?.focus());
    } else if (result.status === 'stale') {
      const latestTrail = await repository.getTrail(trail.id);
      if (submissionRef.current !== null) return;
      setAddForm((current) =>
        current === null
          ? current
          : {
              ...current,
              status: 'stale',
              expectedUpdatedAt: latestTrail?.updatedAt ?? current.expectedUpdatedAt,
              staleNotice: 'refreshed',
            },
      );
    } else {
      setAddForm({ ...addForm, status: 'failure' });
    }
  }

  useEffect(() => {
    if (addForm === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addForm]);

  return (
    <PageSection
      title="Step一覧"
      actions={
        trail.deletedAt === null ? (
          <span className="pt-run-action">
            <button
              ref={addButtonRef}
              className="pt-button pt-button--secondary"
              type="button"
              onClick={openAddForm}
            >
              Stepを追加
            </button>
            {addForm !== null ? (
              <RunPopover
                triggerRef={addButtonRef}
                title="Stepを追加"
                onClose={requestClose}
              >
                {addForm.confirmingDiscard ? (
                  <DiscardConfirmation
                    onDiscard={() => {
                      setAddForm(null);
                      requestAnimationFrame(() => addButtonRef.current?.focus());
                    }}
                    onCancel={cancelDiscard}
                  />
                ) : (
                  <TrailStepForm
                    mode="add"
                    values={addForm.values}
                    prompts={availablePrompts}
                    status={
                      addForm.status === 'stale' ? 'stale' : addForm.status
                    }
                    validationErrors={addForm.validationErrors}
                    staleNotice={
                      addForm.status === 'stale' ? addForm.staleNotice : 'none'
                    }
                    isDirty={isDirty}
                    onChange={(next) =>
                      setAddForm((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              values: next,
                              status: 'editing',
                              validationErrors: [],
                            },
                      )
                    }
                    onSubmit={(event) => void submitAdd(event)}
                    onCancel={requestClose}
                  />
                )}
              </RunPopover>
            ) : null}
          </span>
        ) : null
      }
    >
      <div className="pt-run-table-wrapper">
        <table className="pt-run-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">ステータス</th>
              <th scope="col">最終実行</th>
              <th scope="col">アクション</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((stepItem) => (
              <TrailStepRow
                key={stepItem.step.id}
                stepItem={stepItem}
                availablePrompts={availablePrompts}
                onChanged={onChanged}
                onStepSaved={onStepSaved}
              />
            ))}
          </tbody>
        </table>
      </div>
    </PageSection>
  );
}

function DiscardConfirmation({
  onDiscard,
  onCancel,
}: {
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <div>
      <p className="pt-run-popover__confirm-message">
        入力内容を破棄しますか？
      </p>
      <div className="pt-run-execute-confirmation__actions">
        <button
          className="pt-button pt-button--primary"
          type="button"
          onClick={onDiscard}
        >
          破棄する
        </button>
        <button
          className="pt-button pt-button--secondary"
          type="button"
          onClick={onCancel}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}
