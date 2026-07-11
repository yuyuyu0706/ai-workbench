import { useEffect, useState, type ReactNode } from 'react';

import { StateMessage } from '../components/ui';
import { PromptTrailRepositoryProvider } from './PromptTrailRepositoryContext';
import type { PromptTrailRuntime } from './prompt-trail-runtime';

interface ApplicationBootstrapProps {
  runtime: PromptTrailRuntime;
  children: ReactNode;
}

type BootstrapStatus = 'initializing' | 'ready' | 'failed';

export function ApplicationBootstrap({
  runtime,
  children,
}: ApplicationBootstrapProps) {
  const [status, setStatus] = useState<BootstrapStatus>('initializing');

  useEffect(() => {
    let isActive = true;

    runtime
      .initialize()
      .then(() => {
        if (isActive) {
          setStatus('ready');
        }
      })
      .catch(() => {
        if (isActive) {
          setStatus('failed');
        }
      });

    return () => {
      isActive = false;
    };
  }, [runtime]);

  if (status === 'initializing') {
    return (
      <StateMessage
        variant="loading"
        title="PromptTrailを起動しています..."
        description="Repositoryの初期化が完了するまで、画面側の利用開始状態は表示しません。"
      />
    );
  }

  if (status === 'failed') {
    return (
      <StateMessage
        variant="error"
        title="PromptTrailの起動に失敗しました。"
        description="Repositoryの初期化に失敗したため、画面を表示できません。ページを再読み込みして再試行してください。"
      />
    );
  }

  return (
    <PromptTrailRepositoryProvider repository={runtime.repository}>
      {children}
    </PromptTrailRepositoryProvider>
  );
}
