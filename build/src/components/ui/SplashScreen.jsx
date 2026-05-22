/**
 * SplashScreen — shown for ~1.5s on true first app load, then fades out.
 * BX-6: Logo springs in with a cubic spring, name fades in below, then all fades out.
 *
 * Only shown once per browser session — sessionStorage.getItem('ax_splash_shown')
 * guards against repeat shows on page reload within the same tab session.
 */
import { useEffect, useState } from 'react'

export default function SplashScreen({ onDone }) {
  // phase: 'in' → logo/name animating in | 'hold' → settled | 'out' → fading out
  const [phase, setPhase] = useState('in')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600)
    const t2 = setTimeout(() => setPhase('out'),  1400)
    const t3 = setTimeout(() => {
      try { sessionStorage.setItem('ax_splash_shown', '1') } catch (_) {}
      onDone()
    }, 1800)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div
      style={{
        position:        'fixed',
        inset:           0,
        zIndex:          9999,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexDirection:   'column',
        gap:             '20px',
        background:      'var(--bg-base)',
        opacity:         phase === 'out' ? 0 : 1,
        transition:      phase === 'out' ? 'opacity 0.4s ease' : 'none',
        pointerEvents:   phase === 'out' ? 'none' : 'auto',
      }}
    >
      {/* Pulsing ring — appears during 'hold' phase */}
      <div
        style={{
          position:   'absolute',
          width:      120,
          height:     120,
          borderRadius: '50%',
          border:     '1px solid var(--brand)',
          opacity:    phase === 'hold' ? 0.3 : 0,
          transform:  phase === 'hold' ? 'scale(1.6)' : 'scale(1)',
          transition: 'opacity 0.6s ease, transform 0.8s ease',
        }}
      />

      {/* Animated logo — spring scale-in */}
      <div
        style={{
          width:      80,
          height:     80,
          transform:  phase === 'in' ? 'scale(0.6)' : 'scale(1)',
          opacity:    phase === 'in' ? 0 : 1,
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
        }}
      >
        <img src="/icons/icon.svg" alt="ANKxIOUS" width="80" height="80" />
      </div>

      {/* App name + tagline — fade up after logo */}
      <div
        style={{
          opacity:    phase === 'in' ? 0 : 1,
          transform:  phase === 'in' ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 0.4s ease 0.2s, transform 0.4s ease 0.2s',
          textAlign:  'center',
        }}
      >
        <p
          style={{
            fontFamily:    'var(--font-display, sans-serif)',
            fontWeight:    700,
            fontSize:      '22px',
            letterSpacing: '0.08em',
            color:         'var(--text-primary)',
            margin:        0,
          }}
        >
          ANK<span style={{ color: 'var(--brand)' }}>x</span>IOUS
        </p>
        <p
          style={{
            fontSize:   '11px',
            color:      'var(--text-muted)',
            marginTop:  '4px',
            margin:     '4px 0 0',
          }}
        >
          Business Admin Panel
        </p>
      </div>
    </div>
  )
}
