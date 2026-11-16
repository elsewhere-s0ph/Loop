import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ensurePersistentStorage } from './db/services'
import { applyTheme } from './lib/theme'
import { registerPendingReminders } from './lib/notifications'

applyTheme()

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--danger)' }}>
          <h1 style={{ color: 'var(--ink)' }}>Errore di avvio — copia questo testo:</h1>
          {String(this.state.error?.stack || this.state.error)}
        </div>
      )
    }
    return this.props.children
  }
}

void ensurePersistentStorage()
registerPendingReminders()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)