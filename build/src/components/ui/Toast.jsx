// Re-export react-hot-toast configured with our brand theme.
// Import { toast, Toaster } from '../components/ui/Toast' everywhere in the app.

export { default as toast } from 'react-hot-toast'
import { Toaster as HotToaster } from 'react-hot-toast'

export function Toaster() {
  return (
    <HotToaster
      position="top-center"
      gutter={8}
      toastOptions={{
        duration: 3500,
        style: {
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: '0.75rem',
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '0.875rem',
          boxShadow: 'var(--shadow)',
        },
        success: {
          iconTheme: {
            primary: 'var(--success)',
            secondary: 'var(--bg-surface)',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--error)',
            secondary: 'var(--bg-surface)',
          },
        },
      }}
    />
  )
}
