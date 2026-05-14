import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  info: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    console.error('[ErrorBoundary]', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          padding: 24,
          zIndex: 99999,
        }}
      >
        <div style={{ maxWidth: 560, width: '100%', background: 'white', borderRadius: 12, padding: 28, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>😵</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>应用出现错误</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
            界面遇到了未预期的问题。可以尝试关闭这个提示继续使用,如果反复出现请刷新应用。
          </p>
          {this.state.error && (
            <pre
              style={{
                fontSize: 11,
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                padding: 10,
                maxHeight: 160,
                overflow: 'auto',
                color: '#374151',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 16,
              }}
            >
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={this.handleReset}
              style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #d1d5db', background: 'white', borderRadius: 6, cursor: 'pointer' }}
            >继续使用</button>
            <button
              onClick={this.handleReload}
              style={{ padding: '8px 16px', fontSize: 13, border: 'none', background: '#2563eb', color: 'white', borderRadius: 6, cursor: 'pointer' }}
            >刷新应用</button>
          </div>
        </div>
      </div>
    );
  }
}
