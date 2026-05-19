import { Component } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * ErrorBoundary — catches unhandled render errors and shows a friendly fallback.
 * Wrap top-level page or section components with this.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center py-24 gap-4 px-6 text-center"
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--error-light)', border: '1px solid var(--error)' }}
          >
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <p className="font-display font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
              Something went wrong
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {this.state.error?.message ?? 'An unexpected error occurred.'}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="btn-ghost flex items-center gap-2 text-sm mt-2"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
