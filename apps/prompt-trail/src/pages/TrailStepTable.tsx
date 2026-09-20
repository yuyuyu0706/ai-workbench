import { useEffect, useRef, useState } from 'react';
import { usePromptTrailRepository } from '../app/PromptTrailRepositoryContext';
import { PageSection, StateMessage } from '../components/ui';
import { addTrailStep } from '../trail-detail/add-trail-step';
import { deleteTrailStep } from '../trail-detail/delete-trail-step';
import { reorderTrailSteps } from '../trail-detail/reorder-trail-steps';
import type { TrailDetailStepItem } from '../trail-detail/trail-detail-read-query';
import type { Prompt, PromptId, Trail, TrailStepId } from '../domain';
import { validateTrailStepMetadata } from '../trail-step-metadata';
import { RunPopover } from './RunPopover';
import {
  TrailStepForm,
  type TrailStepFormValues,
} from './step-forms/TrailStepForm';
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

  const rowSubmissionRef = useRef<symbol | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [notice, setNotice] = useState<{
    readonly kind: 'stale' | 'failure';
    readonly message: string;
  } | null>(null);
  const [rowsConfirmingDiscard, setRowsConfirmingDiscard] = useState<
    ReadonlySet<TrailStepId>
  >(new Set());
  const isAnyRowConfirmingDiscard = rowsConfirmingDiscard.size > 0;

  function handleDiscardConfirmChange(
    stepId: TrailStepId,
    isConfirming: boolean,
  ) {
    setRowsConfirmingDiscard((current) => {
      const hasIt = current.has(stepId);
      if (isConfirming === hasIt) return current;
      const next = new Set(current);
      if (isConfirming) next.add(stepId);
      else next.delete(stepId);
      return next;
    });
  }

  async function handleMove(stepId: TrailStepId, direction: 'up' | 'down') {
    if (isReordering) return;
    const index = steps.findIndex((item) => item.step.id === stepId);
    if (index === -1) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= steps.length) return;
    setNotice(null);
    const orderedStepIds = steps.map((item) => item.step.id);
    const target = orderedStepIds[index];
    orderedStepIds[index] = orderedStepIds[swapIndex];
    orderedStepIds[swapIndex] = target;
    const token = Symbol('reorder-trail-steps');
    rowSubmissionRef.current = token;
    setIsReordering(true);
    const result = await reorderTrailSteps(repository, {
      trailId: trail.id,
      orderedStepIds,
      expectedUpdatedAt: trail.updatedAt,
    });
    if (rowSubmissionRef.current !== token) return;
    rowSubmissionRef.current = null;
    setIsReordering(false);
    if (result.status === 'success') {
      onStepSaved();
    } else if (result.status === 'stale') {
      onStepSaved();
      setNotice({
        kind: 'stale',
        message:
          '他の操作で更新されたため再読み込みしました。もう一度操作してください',
      });
    } else {
      setNotice({
        kind: 'failure',
        message: '並び替えに失敗しました。もう一度お試しください。',
      });
    }
  }

  async function handleDelete(stepId: TrailStepId) {
    if (isReordering) return;
    setNotice(null);
    const token = Symbol('delete-trail-step');
    rowSubmissionRef.current = token;
    setIsReordering(true);
    const result = await deleteTrailStep(repository, {
      trailId: trail.id,
      trailStepId: stepId,
      expectedUpdatedAt: trail.updatedAt,
    });
    if (rowSubmissionRef.current !== token) return;
    rowSubmissionRef.current = null;
    setIsReordering(false);
    if (result.status === 'success') {
      onStepSaved();
      requestAnimationFrame(() => addButtonRef.current?.focus());
    } else if (result.status === 'stale') {
      onStepSaved();
      setNotice({
        kind: 'stale',
        message:
          '他の操作で更新されたため再読み込みしました。もう一度操作してください',
      });
    } else {
      setNotice({
        kind: 'failure',
        message: '削除に失敗しました。もう一度お試しください。',
      });
    }
  }

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
              expectedUpdatedAt:
                latestTrail?.updatedAt ?? current.expectedUpdatedAt,
              staleNotice: 'refreshed',
            },
      );
    } else {
      setAddForm({ ...addForm, status: 'failure' });
    }
  }

  useEffect(() => {
    if (addForm === null) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const isInsideButton = addButtonRef.current?.contains(target);
      const isInsideOwnPopover =
        target instanceof Element &&
        target.closest('.pt-run-popover--add-step');
      if (!isInsideButton && !isInsideOwnPopover) {
        requestClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') requestClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
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
              disabled={isAnyRowConfirmingDiscard}
              aria-label={
                isAnyRowConfirmingDiscard
                  ? 'Stepを追加（編集中のStepの未保存の変更を先に確定してください）'
                  : 'Stepを追加'
              }
              title={
                isAnyRowConfirmingDiscard
                  ? '編集中のStepの未保存の変更を先に確定してください'
                  : undefined
              }
              onClick={openAddForm}
            >
              Stepを追加
            </button>
            {addForm !== null ? (
              <RunPopover
                triggerRef={addButtonRef}
                className="pt-run-popover--add-step"
                title="Stepを追加"
                onClose={requestClose}
              >
                {addForm.confirmingDiscard ? (
                  <DiscardConfirmation
                    onDiscard={() => {
                      setAddForm(null);
                      requestAnimationFrame(() =>
                        addButtonRef.current?.focus(),
                      );
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
      {notice !== null ? (
        <p
          className="pt-form__error"
          role={notice.kind === 'failure' ? 'alert' : 'status'}
        >
          {notice.message}
        </p>
      ) : null}
      {steps.length === 0 ? (
        <StateMessage
          variant="empty"
          title="Stepがまだありません"
          description="StepはこのTrailにまだ登録されていません。"
        />
      ) : (
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
              {steps.map((stepItem, index) => (
                <TrailStepRow
                  key={stepItem.step.id}
                  stepItem={stepItem}
                  availablePrompts={availablePrompts}
                  onChanged={onChanged}
                  onStepSaved={onStepSaved}
                  isFirst={index === 0}
                  isLast={index === steps.length - 1}
                  isReordering={isReordering}
                  onMove={(stepId, direction) =>
                    void handleMove(stepId, direction)
                  }
                  onDelete={(stepId) => void handleDelete(stepId)}
                  addFormConfirmingDiscard={addForm?.confirmingDiscard ?? false}
                  onDiscardConfirmChange={handleDiscardConfirmChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
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
