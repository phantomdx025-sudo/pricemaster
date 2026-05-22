/**
 * FinContactTab — Contact info, notes, and pin for one party.
 * Phase FIN-2
 *
 * Props:
 *   party        — fin_parties row
 *   partyType    — 'debtor' | 'creditor'
 *   fetchContact — fn(partyName) → Promise<row|null>
 *   fetchNotes   — fn(partyType, partyName) → Promise<rows>
 *   addNote      — fn(partyType, partyName, text) → Promise<row>
 *   deleteNote   — fn(noteId) → Promise<void>
 */
import { useState, useEffect, useRef } from 'react'
import { Phone, Smartphone, Mail, MapPin, User, Building2, Trash2, MessageCircle, Plus, ExternalLink } from 'lucide-react'
import { toast } from '../ui/Toast'

function fmtTimestamp(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d)) return ''
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function InfoRow({ icon: Icon, label, value, href, extra }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--bg-elevated)' }}>
        <Icon size={13} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
        {href ? (
          <a href={href} className="text-sm font-medium break-all" style={{ color: 'var(--brand)' }}>
            {value}
          </a>
        ) : (
          <p className="text-sm font-medium break-all" style={{ color: 'var(--text-primary)' }}>{value}</p>
        )}
      </div>
      {extra}
    </div>
  )
}

function ContactSkeleton() {
  return (
    <div className="px-4 py-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-7 h-7 rounded-lg animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="flex-1">
            <div className="h-2.5 w-16 rounded animate-pulse mb-1.5" style={{ background: 'var(--border)' }} />
            <div className="h-3.5 w-40 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FinContactTab({
  party, partyType, fetchContact, fetchNotes, addNote, deleteNote
}) {
  const [contact, setContact]     = useState(null)
  const [notes, setNotes]         = useState([])
  const [loadingContact, setLoadingContact] = useState(true)
  const [loadingNotes, setLoadingNotes]     = useState(true)
  const [contactError, setContactError]     = useState(null)

  const [noteText, setNoteText]   = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const textareaRef = useRef(null)

  const [fetched, setFetched] = useState(null)

  useEffect(() => {
    if (!party?.party_name) return
    const key = `${partyType}:${party.party_name}`
    if (fetched === key) return
    setFetched(key)

    // Fetch contact
    setLoadingContact(true)
    fetchContact(party.party_name)
      .then(data => setContact(data))
      .catch(err => setContactError(err.message))
      .finally(() => setLoadingContact(false))

    // Fetch notes
    setLoadingNotes(true)
    fetchNotes(partyType, party.party_name)
      .then(data => setNotes(data))
      .catch(() => {})
      .finally(() => setLoadingNotes(false))
  }, [party?.party_name, partyType, fetchContact, fetchNotes])

  const handleAddNote = async () => {
    const text = noteText.trim()
    if (!text) return
    setAddingNote(true)
    try {
      const row = await addNote(partyType, party.party_name, text)
      setNotes(prev => [row, ...prev])
      setNoteText('')
    } catch (err) {
      toast.error('Failed to add note: ' + (err.message ?? 'Unknown error'))
    } finally {
      setAddingNote(false)
    }
  }

  const handleDeleteNote = async (noteId) => {
    if (confirmDeleteId !== noteId) {
      setConfirmDeleteId(noteId)
      return
    }
    setDeletingId(noteId)
    setConfirmDeleteId(null)
    try {
      await deleteNote(noteId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch (err) {
      toast.error('Failed to delete note: ' + (err.message ?? 'Unknown error'))
    } finally {
      setDeletingId(null)
    }
  }

  if (loadingContact) return <ContactSkeleton />

  const mobile = contact?.mobile?.replace(/\D/g, '') ?? ''
  const waHref = mobile ? `https://wa.me/91${mobile}` : null

  return (
    <div>
      {/* Contact info section */}
      <div className="px-4 pt-3 pb-1">

        {contactError || !contact ? (
          <div
            className="rounded-xl p-4 mb-4 text-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No contact info synced for this party
            </p>
          </div>
        ) : (
          <>
            <InfoRow icon={Building2} label="Group"   value={contact.party_group} />
            <InfoRow icon={MapPin}    label="Address" value={[contact.address, contact.state_name, contact.pincode].filter(Boolean).join(', ')} />
            <InfoRow icon={User}      label="Contact" value={contact.contact_person} />
            <InfoRow
              icon={Phone}
              label="Phone"
              value={contact.phone}
              href={contact.phone ? `tel:${contact.phone}` : null}
            />
            <InfoRow
              icon={Smartphone}
              label="Mobile"
              value={contact.mobile}
              href={contact.mobile ? `tel:${contact.mobile}` : null}
              extra={waHref && (
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 ml-2"
                  style={{
                    background: '#25D366',
                    color: '#fff',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <MessageCircle size={11} />
                  WA
                </a>
              )}
            />
            <InfoRow
              icon={Mail}
              label="Email"
              value={contact.email}
              href={contact.email ? `mailto:${contact.email}` : null}
            />
            <InfoRow icon={ExternalLink} label="GSTIN"    value={contact.gstin} />
            <InfoRow icon={ExternalLink} label="PAN"      value={contact.pan_no} />
            <InfoRow icon={ExternalLink} label="Reg Type" value={contact.reg_type} />
          </>
        )}
      </div>

      {/* Notes section */}
      <div
        className="px-4 pt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>
          NOTES
        </p>

        {/* Add note input */}
        <div
          className="rounded-xl overflow-hidden mb-4"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note…"
            rows={2}
            className="w-full bg-transparent outline-none text-sm px-3 pt-2.5 pb-1 resize-none"
            style={{ color: 'var(--text-primary)', fontFamily: '"DM Sans", sans-serif' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAddNote()
            }}
          />
          <div className="flex items-center justify-end px-3 pb-2">
            <button
              onClick={handleAddNote}
              disabled={addingNote || !noteText.trim()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity disabled:opacity-50"
              style={{ background: 'var(--brand)', color: '#fff' }}
            >
              {addingNote
                ? <span className="animate-spin inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full" />
                : <Plus size={12} />}
              {addingNote ? 'Adding…' : 'Add Note'}
            </button>
          </div>
        </div>

        {/* Notes list */}
        {loadingNotes && (
          <div className="space-y-2 mb-4">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'var(--border)' }} />
            ))}
          </div>
        )}

        {!loadingNotes && notes.length === 0 && (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No notes yet
          </p>
        )}

        {!loadingNotes && notes.map(note => (
          <div
            key={note.id}
            className="rounded-xl px-3 py-2.5 mb-2.5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>
                {note.note_text}
              </p>
              <button
                onClick={() => handleDeleteNote(note.id)}
                disabled={deletingId === note.id}
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                style={{
                  background: confirmDeleteId === note.id ? 'var(--error-light)' : 'transparent',
                  color: confirmDeleteId === note.id ? 'var(--error)' : 'var(--text-muted)',
                }}
                aria-label="Delete note"
                title={confirmDeleteId === note.id ? 'Tap again to confirm' : 'Delete note'}
              >
                <Trash2 size={13} />
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {fmtTimestamp(note.created_at)}
            </p>
          </div>
        ))}

        {/* Spacer at bottom */}
        <div className="h-6" />
      </div>
    </div>
  )
}
