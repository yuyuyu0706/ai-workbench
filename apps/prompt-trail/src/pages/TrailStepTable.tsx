import { PageSection } from '../components/ui';
import type { TrailDetailStepItem } from '../trail-detail/trail-detail-read-query';
import { TrailStepRow } from './TrailStepRow';

export function TrailStepTable({
  steps,
  onChanged,
}: {
  steps: readonly TrailDetailStepItem[];
  onChanged: () => void;
}) {
  return (
    <PageSection title="Step一覧">
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
                onChanged={onChanged}
              />
            ))}
          </tbody>
        </table>
      </div>
    </PageSection>
  );
}
