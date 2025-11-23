/**
 * Error Boundary component for React error handling
 */

import { Component, ReactNode, ErrorInfo as ReactErrorInfo } from 'react';
import { handleRpcError, handleContractError, ErrorInfo } from '../lib/errorHandler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Try to determine if it's an RPC or contract error
    const errorInfo = error.message.includes('RPC') || error.message.includes('fetch')
      ? handleRpcError(error)
      : handleContractError(error);

    return {
      hasError: true,
      error,
      errorInfo,
    };
  }

  componentDidCatch(error: Error, errorInfo: ReactErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="glass-panel p-6 rounded-xl border border-red-500/50">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-red-600 dark:text-red-400 text-lg font-bold mb-2">
                Something went wrong
              </h3>
              {this.state.errorInfo && (
                <p className="text-red-500 dark:text-red-300 text-sm">
                  {this.state.errorInfo.userMessage}
                </p>
              )}
              {this.state.error && (
                <details className="mt-4">
                  <summary className="text-xs text-zinc-500 dark:text-gray-400 cursor-pointer">
                    Technical details
                  </summary>
                  <pre className="mt-2 text-xs text-zinc-600 dark:text-gray-500 overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}
            </div>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

