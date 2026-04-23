import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const REQUEST_TYPES = [
  { value: 'website_change', label: 'Website Change', desc: 'Page edits, new sections, copy updates', requiresUrl: true },
  { value: 'content_feedback', label: 'Content Feedback', desc: 'GMB posts, blog articles, social content', requiresUrl: false },
  { value: 'billing', label: 'Billing / Account', desc: 'Invoice queries, plan changes', requiresUrl: false },
  { value: 'question', label: 'General Question', desc: 'Anything else', requiresUrl: false },
]

const STATUS_STYLES = {
  'Completed':      'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50',
  'Maintenance':    'bg-blue-900/30 text-blue-400 border border-blue-900/50',
  'Awaiting Client Feedback': 'bg-amber-900/30 text-amber-400 border border-amber-900/50',
  'Awaiting Client Brief':    'bg-amber-900/30 text-amber-400 border border-amber-900/50',
  '2nd Phase – Adjustments':  'bg-purple/20 text-purple-light border border-purple/30',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function statusStyle(s) {
  return STATUS_STYLES[s] || 'bg-zinc-800 text-zinc-400 border border-zinc-700'
}

// ─── REQUEST MODAL ────────────────────────────────────────────────────────────
function RequestModal({ client, openRequests, onSubmit, onClose }) {
  const [type, setType] = useState('website_change')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pageUrl, setPageUrl] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedType = REQUEST_TYPES.find(t => t.value === type)
  const existingOfType = openRequests.find(r => r.type === type && r.status !== 'done')
  const descLen = description.trim().length

  const submit = async () => {
    setError('')
    if (!title.trim()) { setError('Please add a brief title.'); return }
    if (descLen < 50) { setError('Please describe your request in more detail (at least 50 characters).'); return }
    if (selectedType.requiresUrl && !pageUrl.trim()) { setError('Please include the page URL for this change.'); return }
    if (existingOfType) { setError('You already have an open request of this type. Please wait for it to be resolved first.'); return }

    setSubmitting(true)
    try {
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
        body: JSON.stringify({ client_id: client.id, type, title: title.trim(), description: description.trim(), page_url: pageUrl.trim() || null, priority: urgent ? 'urgent' : 'normal' }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setSubmitting(false); return }
      onSubmit(data.request)
    } catch {
      setError('Failed to submit — please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111111] border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="text-sm font-bold text-zinc-100">Submit a Request</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">We'll pick this up within 1 business day</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl w-6 h-6 flex items-center justify-center">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Type selector */}
          <div>
            <p className="label block mb-2">Request type</p>
            <div className="grid grid-cols-2 gap-2">
              {REQUEST_TYPES.map(t => {
                const hasOpen = openRequests.find(r => r.type === t.value && r.status !== 'done')
                return (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${
                      type === t.value
                        ? 'border-purple/50 bg-purple/10'
                        : 'border-border hover:border-zinc-700'
                    } ${hasOpen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!!hasOpen}
                    title={hasOpen ? 'You have an open request of this type' : ''}>
                    <p className={`text-xs font-semibold ${type === t.value ? 'text-purple-light' : 'text-zinc-300'}`}>{t.label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">{t.desc}</p>
                    {hasOpen && <p className="text-[10px] text-amber-500 mt-1">1 open</p>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="label block mb-1.5">Request title</label>
            <input className="input" placeholder="e.g. Update homepage hero text"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          </div>

          {/* Page URL (website changes only) */}
          {selectedType?.requiresUrl && (
            <div>
              <label className="label block mb-1.5">Page URL</label>
              <input className="input font-mono text-xs" placeholder="https://yoursite.co.uk/page"
                value={pageUrl} onChange={e => setPageUrl(e.target.value)} />
              <p className="text-[10px] text-zinc-600 mt-1">Paste the URL of the page you'd like changed.</p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="label block mb-1.5">
              Description
              <span className={`ml-2 normal-case font-normal ${descLen < 50 ? 'text-zinc-700' : 'text-emerald-500'}`}>
                {descLen}/50 min
              </span>
            </label>
            <textarea className="input resize-none text-sm" rows={4}
              placeholder="Describe exactly what you need. The more detail you give, the faster we can get it done."
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Urgent */}
          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border hover:border-zinc-700 transition-colors">
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)}
              className="w-3.5 h-3.5 mt-0.5 rounded accent-purple" />
            <div>
              <p className="text-xs font-semibold text-zinc-300">Mark as urgent</p>
              <p className="text-[10px] text-zinc-600 leading-relaxed">Only use this if your business is genuinely affected. Limited to once per month.</p>
            </div>
          </label>

          {error && (
            <div className="bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button onClick={submit} disabled={submitting} className="btn-primary flex-1 justify-center text-sm">
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Submitting…
              </span>
            ) : 'Submit Request'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────
export default function Portal({ session }) {
  const [client, setClient] = useState(null)
  const [notion, setNotion] = useState(null)
  const [requests, setRequests] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: profile } = await supabase
        .from('profiles').select('client_id, display_name').eq('id', session.user.id).single()

      if (!profile?.client_id) { setLoading(false); return }

      const [{ data: clientData }, { data: reqData }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', profile.client_id).single(),
        supabase.from('client_requests').select('*')
          .eq('client_id', profile.client_id).order('created_at', { ascending: false }),
      ])

      setClient(clientData)
      setRequests(reqData || [])

      if (clientData?.name) {
        fetch(`/api/notion-status?name=${encodeURIComponent(clientData.name)}`)
          .then(r => r.json()).then(d => { if (d.project) setNotion(d.project) }).catch(() => {})
      }

      setLoading(false)
    }
    load()
  }, [session])

  const handleSubmit = (newReq) => {
    setRequests(prev => [newReq, ...prev])
    setShowModal(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
  }

  const signOut = () => supabase.auth.signOut()

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="card max-w-sm w-full text-center">
          <p className="text-sm text-zinc-400 mb-1">No client account linked</p>
          <p className="text-xs text-zinc-600">Contact your account manager to get this set up.</p>
          <button onClick={signOut} className="btn-secondary mt-4 text-xs">Sign out</button>
        </div>
      </div>
    )
  }

  const openRequests = requests.filter(r => r.status !== 'done')
  const resolvedRequests = requests.filter(r => r.status === 'done')

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-100 leading-none">{client.name}</p>
              <p className="text-[10px] text-zinc-600 leading-none mt-0.5">Blackbird Client Portal</p>
            </div>
          </div>
          <button onClick={signOut} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Sign out</button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6 fade-in-up">

        {/* Success toast */}
        {submitted && (
          <div className="bg-emerald-900/30 border border-emerald-900/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm text-emerald-400">Request submitted — we'll be in touch within 1 business day.</p>
          </div>
        )}

        {/* Project status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Your Project</p>
            {notion?.wixUrl && (
              <a href={notion.wixUrl} target="_blank" rel="noopener noreferrer"
                className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors">
                View site ↗
              </a>
            )}
          </div>

          {notion ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusStyle(notion.status)}`}>
                  {notion.status || 'Active'}
                </span>
                {notion.progress !== null && (
                  <span className="text-xs font-mono text-zinc-400">{notion.progress}% complete</span>
                )}
              </div>

              {notion.progress !== null && (
                <div>
                  <div className="w-full bg-zinc-900 rounded-full h-1.5">
                    <div className="bg-purple h-1.5 rounded-full transition-all duration-700" style={{ width: `${notion.progress}%` }} />
                  </div>
                </div>
              )}

              {notion.clientUpdate && (
                <div className="bg-zinc-900 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Latest update</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{notion.clientUpdate}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 pt-1">
                {notion.sitePackage && (
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Package</p>
                    <p className="text-xs font-semibold text-zinc-300">{notion.sitePackage}</p>
                  </div>
                )}
                {notion.onboarded && (
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Started</p>
                    <p className="text-xs font-semibold text-zinc-300">{fmtDate(notion.onboarded)}</p>
                  </div>
                )}
                {notion.projectFinished && (
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Launched</p>
                    <p className="text-xs font-semibold text-zinc-300">{fmtDate(notion.projectFinished)}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Project data loading…</p>
          )}
        </div>

        {/* Open requests */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">
              Requests
              {openRequests.length > 0 && (
                <span className="ml-2 text-[10px] bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-full font-normal normal-case tracking-normal">
                  {openRequests.length} open
                </span>
              )}
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary text-xs py-1.5">
              + New Request
            </button>
          </div>

          {openRequests.length === 0 && resolvedRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600 mb-1">No requests yet</p>
              <p className="text-xs text-zinc-700">Use the button above to get in touch with your account team.</p>
            </div>
          )}

          {openRequests.length > 0 && (
            <div className="space-y-2 mb-4">
              {openRequests.map(r => <RequestRow key={r.id} r={r} />)}
            </div>
          )}

          {resolvedRequests.length > 0 && (
            <details className="group">
              <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 select-none">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="group-open:rotate-90 transition-transform">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
                {resolvedRequests.length} resolved request{resolvedRequests.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">
                {resolvedRequests.slice(0, 5).map(r => <RequestRow key={r.id} r={r} />)}
              </div>
            </details>
          )}
        </div>

        {/* Account info */}
        <div className="card-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-500">Need to talk to someone?</p>
              <p className="text-xs text-zinc-400 mt-0.5">Message your account manager on WhatsApp or email <span className="text-zinc-300">hello@blackbird-marketing.co.uk</span></p>
            </div>
          </div>
        </div>

      </main>

      {showModal && (
        <RequestModal
          client={client}
          openRequests={openRequests}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

function RequestRow({ r }) {
  const type = REQUEST_TYPES.find(t => t.value === r.type)
  const statusColor = r.status === 'done' ? 'text-emerald-400' : r.status === 'in_progress' ? 'text-blue-400' : 'text-amber-400'
  const statusLabel = r.status === 'done' ? 'Resolved' : r.status === 'in_progress' ? 'In progress' : 'Open'

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-900/60 border border-border/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-xs font-semibold text-zinc-200">{r.title}</span>
          {r.priority === 'urgent' && <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-semibold">Urgent</span>}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
          <span>{type?.label}</span>
          <span>·</span>
          <span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
        {r.description && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">{r.description}</p>}
      </div>
      <span className={`text-[10px] font-semibold flex-shrink-0 ${statusColor}`}>{statusLabel}</span>
    </div>
  )
}
