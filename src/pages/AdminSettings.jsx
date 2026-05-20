/**
 * AdminSettings — app settings page.
 * AX-1: Entity Name setting — displayed in PDF statement headers.
 * BX-7: PDF Outstanding Breakdown toggle — include/exclude outstanding invoices table in PDFs.
 * BX-8: Colour Theme picker — 5 themes, saved globally via app_settings.
 */

import { useState, useEffect } from 'react'
import { Settings, FileText, Palette } from 'lucide-react'
import {
  fetchEntityName, setEntityName,
  fetchPdfBreakdownSetting, setPdfBreakdownSetting,
  fetchTheme, setTheme,
} from '../hooks/useAppSettings'
import { toast } from '../components/ui/Toast'

// BX-8: Available themes — swatch colours are the brand accent of each theme
const THEMES = [
  { id: 'space',   name: 'Space Dark',    swatch: '#7c6ff7' },
  { id: 'emerald', name: 'Emerald Night', swatch: '#3ecf74' },
  { id: 'rose',    name: 'Rose Dark',     swatch: '#f06884' },
  { id: 'ocean',   name: 'Ocean Depth',   swatch: '#00d4ff' },
  { id: 'amber',   name: 'Amber Classic', swatch: '#d4842a' },
]

export default function AdminSettings() {
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // BX-7: PDF breakdown toggle state
  const [pdfBreakdown,        setPdfBreakdown]        = useState(false)
  const [pdfBreakdownLoading, setPdfBreakdownLoading] = useState(true)
  const [pdfBreakdownSaving,  setPdfBreakdownSaving]  = useState(false)

  // BX-8: Active theme state
  const [activeTheme,  setActiveTheme]  = useState('space')
  const [themeLoading, setThemeLoading] = useState(true)

  // Load entity name on mount
  useEffect(() => {
    fetchEntityName().then((val) => {
      setName(val)
      setLoading(false)
    })
  }, [])

  // BX-7: Load PDF breakdown setting on mount
  useEffect(() => {
    fetchPdfBreakdownSetting().then((val) => {
      setPdfBreakdown(val)
      setPdfBreakdownLoading(false)
    })
  }, [])

  // BX-8: Load current theme on mount
  useEffect(() => {
    fetchTheme().then((val) => {
      setActiveTheme(val)
      setThemeLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await setEntityName(name.trim())
      toast.success('Entity name saved')
    } catch (err) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // BX-7: Toggle PDF breakdown setting
  const togglePdfBreakdown = async () => {
    const next = !pdfBreakdown
    setPdfBreakdown(next)
    setPdfBreakdownSaving(true)
    try {
      await setPdfBreakdownSetting(next)
      toast.success(next ? 'PDF breakdown enabled' : 'PDF breakdown disabled')
    } catch (err) {
      // Revert on failure
      setPdfBreakdown(!next)
      toast.error(err.message || 'Failed to save setting')
    } finally {
      setPdfBreakdownSaving(false)
    }
  }

  // BX-8: Change theme — apply immediately to DOM, then persist to DB
  const handleThemeChange = async (themeId) => {
    setActiveTheme(themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    try {
      await setTheme(themeId)
      toast.success('Theme updated for all users')
    } catch {
      toast.error('Failed to save theme')
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6 overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
      {/* Page header */}
      <div className="mb-6">
        <h1
          className="font-display text-xl font-bold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          Settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          App-wide configuration
        </p>
      </div>

      {/* Entity Name card */}
      <div
        className="card p-5 max-w-md"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
          >
            <Settings size={17} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Entity Name
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Shown in PDF statement headers
            </p>
          </div>
        </div>

        {loading ? (
          <div
            className="h-10 rounded-xl animate-pulse"
            style={{ background: 'var(--bg-elevated)' }}
          />
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field flex-1"
              placeholder="Your business name"
              maxLength={80}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="btn-primary px-4 flex-shrink-0"
              style={{ minWidth: 72 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>

      {/* BX-7: PDF Outstanding Breakdown toggle card */}
      <div
        className="card p-5 max-w-md mt-4"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
          >
            <FileText size={17} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              PDF Settings
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Control what appears in generated PDF statements
            </p>
          </div>
        </div>

        {pdfBreakdownLoading ? (
          <div
            className="h-10 rounded-xl animate-pulse"
            style={{ background: 'var(--bg-elevated)' }}
          />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                Outstanding Breakdown Table
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {pdfBreakdown
                  ? 'Included at end of PDF — unpaid invoices listed'
                  : 'Hidden by default — enable to include in PDFs'}
              </p>
            </div>
            <button
              onClick={togglePdfBreakdown}
              disabled={pdfBreakdownSaving}
              className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors"
              style={{
                background: pdfBreakdown ? 'var(--brand)' : 'var(--border-strong)',
                opacity: pdfBreakdownSaving ? 0.6 : 1,
              }}
              aria-checked={pdfBreakdown}
              role="switch"
              aria-label="Toggle PDF outstanding breakdown"
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                style={{ transform: pdfBreakdown ? 'translateX(20px)' : 'translateX(0)' }}
              />
            </button>
          </div>
        )}
      </div>

      {/* BX-8: Colour Theme picker card */}
      <div
        className="card p-5 max-w-md mt-4"
        style={{ border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--brand-light)', border: '1px solid var(--brand-border)' }}
          >
            <Palette size={17} style={{ color: 'var(--brand)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Colour Theme
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Applied globally — all users see the same theme
            </p>
          </div>
        </div>

        {themeLoading ? (
          <div
            className="h-16 rounded-xl animate-pulse"
            style={{ background: 'var(--bg-elevated)' }}
          />
        ) : (
          <div className="flex flex-wrap gap-4">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className="flex flex-col items-center gap-1.5"
                style={{ minWidth: 56 }}
                aria-label={`Select ${t.name} theme`}
                aria-pressed={activeTheme === t.id}
              >
                <div
                  className="w-10 h-10 rounded-xl border-2 transition-all"
                  style={{
                    background: t.swatch,
                    borderColor: activeTheme === t.id ? 'var(--text-primary)' : 'transparent',
                    transform: activeTheme === t.id ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: activeTheme === t.id ? '0 0 0 3px var(--brand-light)' : 'none',
                  }}
                />
                <span
                  className="text-xs text-center leading-tight"
                  style={{
                    color: activeTheme === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: activeTheme === t.id ? 600 : 400,
                    maxWidth: 56,
                  }}
                >
                  {t.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
