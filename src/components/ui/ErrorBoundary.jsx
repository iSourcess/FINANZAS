import React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Error atrapado en render:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="rounded-2xl p-5 flex flex-col items-center justify-center text-center gap-3 my-2"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: 'var(--red-400)',
            }}
          >
            <AlertCircle size={20} />
          </div>
          <div className="flex flex-col gap-1 max-w-xs">
            <h4 className="font-semibold text-xs text-[var(--text-primary)]">
              {this.props.title || 'Error al cargar esta sección'}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)] font-mono">
              {this.state.error?.message || 'Ocurrió un error inesperado al renderizar.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--orange-400)] bg-[var(--orange-900)] border border-[var(--orange-700)] hover:brightness-110 transition-all active:scale-95"
          >
            <RotateCcw size={13} />
            <span>Reintentar</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

