import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StateMessage } from './StateMessage';

describe('StateMessage', () => {
  it('renders loading as a polite status', () => {
    render(
      <StateMessage
        description="Preparing local repositories."
        title="PromptTrailを起動しています..."
        variant="loading"
      />,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('PromptTrailを起動しています...');
    expect(status).toHaveTextContent('Preparing local repositories.');
  });

  it('renders error as an alert', () => {
    render(
      <StateMessage
        description="Please reload the app."
        title="PromptTrailの起動に失敗しました。"
        variant="error"
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('PromptTrailの起動に失敗しました。');
    expect(alert).toHaveTextContent('Please reload the app.');
  });

  it('renders empty without a live region', () => {
    render(<StateMessage title="No trails yet." variant="empty" />);

    expect(screen.getByText('No trails yet.')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
