import { useEffect, useState, type ReactNode } from 'react';

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
    return <p>PromptTrailを起動しています...</p>;
  }

  if (status === 'failed') {
    return <p role="alert">PromptTrailの起動に失敗しました。</p>;
  }

  return (
    <PromptTrailRepositoryProvider repository={runtime.repository}>
      {children}
    </PromptTrailRepositoryProvider>
  );
}
