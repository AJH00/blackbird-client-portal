import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const REQUEST_TYPES = [
  { value: 'website_change', label: 'Website Change', desc: 'Page edits, new sections, copy updates', requiresUrl: true },
  { value: 'content_feedback', label: 'Content Feedback', desc: 'GMB posts, blog articles, social content', requiresUrl: false },
  { value: 'billing', label: 'Billing / Account', desc: 'Invoice queries, plan changes', requiresUrl: false },
  { value: 'question', label: 'General Question', desc: 'Anything else', requiresUrl: false },
]

const STATUS_STYLES = {
  'Completed':                  'bg-emerald-900/30 text-emerald-400 border border-emerald-900/50',
  'Maintenance':                'bg-blue-900/30 text-blue-400 border border-blue-900/50',
  'Awaiting Client Feedback':   'bg-amber-900/30 text-amber-400 border border-amber-900/50',
  'Awaiting Client Brief':      'bg-amber-900/30 text-amber-400 border border-amber-900/50',
  '2nd Phase – Adjustments':   'bg-purple/20 text-purple-light border border-purple/30',
}

const SERVICES = [
  { name: 'Email Marketing', desc: 'Monthly newsletters and automated campaigns to keep your customers coming back.' },
  { name: 'Social Media Management', desc: 'Consistent posting across Facebook and Instagram — done for you.' },
  { name: 'Paid Ad Management', desc: 'Google and Facebook ads targeted to your local area, managed end to end.' },
  { name: 'Extra Website Pages', desc: 'Location pages, service pages, or anything else to help you rank and convert.' },
]

const WATI_NUMBER = '447395837967'

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
          <div>
            <p className="label block mb-2">Request type</p>
            <div className="grid grid-cols-2 gap-2">
              {REQUEST_TYPES.map(t => {
                const hasOpen = openRequests.find(r => r.type === t.value && r.status !== 'done')
                return (
                  <button key={t.value} onClick={() => setType(t.value)}
                    className={`text-left p-3 rounded-lg border transition-all ${type === t.value ? 'border-purple/50 bg-purple/10' : 'border-border hover:border-zinc-700'} ${hasOpen ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={!!hasOpen} title={hasOpen ? 'You have an open request of this type' : ''}>
                    <p className={`text-xs font-semibold ${type === t.value ? 'text-purple-light' : 'text-zinc-300'}`}>{t.label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">{t.desc}</p>
                    {hasOpen && <p className="text-[10px] text-amber-500 mt-1">1 open</p>}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Request title</label>
            <input className="input" placeholder="e.g. Update homepage hero text"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          </div>

          {selectedType?.requiresUrl && (
            <div>
              <label className="label block mb-1.5">Page URL</label>
              <input className="input font-mono text-xs" placeholder="https://yoursite.co.uk/page"
                value={pageUrl} onChange={e => setPageUrl(e.target.value)} />
              <p className="text-[10px] text-zinc-600 mt-1">Paste the URL of the page you'd like changed.</p>
            </div>
          )}

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
            {submitting ? <span className="flex items-center gap-2"><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Submitting…</span> : 'Submit Request'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── UPDATE DETAILS MODAL ─────────────────────────────────────────────────────
function UpdateDetailsModal({ profile, onSave, onClose }) {
  const [name, setName] = useState(profile.name || '')
  const [phone, setPhone] = useState(profile.phone || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setError('')
    if (newPassword && newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (newPassword && newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setSaving(true)
    await supabase.from('profiles').update({ name: name.trim(), phone: phone.trim() || null }).eq('id', profile.id)
    if (newPassword) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword })
      if (pwErr) { setError(pwErr.message); setSaving(false); return }
    }
    setSaving(false)
    setDone(true)
    setTimeout(() => { onSave({ name: name.trim(), phone: phone.trim() }); onClose() }, 1000)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#111111] border border-border rounded-xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="text-sm font-bold text-zinc-100">Update Your Details</p>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl w-6 h-6 flex items-center justify-center">×</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label block mb-1.5">Your name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <label className="label block mb-1.5">Phone number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+44 7700 000000" />
          </div>
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider">Change password</p>
            <input type="password" className="input" placeholder="New password (min 8 characters)"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            {newPassword && (
              <input type="password" className="input" placeholder="Confirm new password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            )}
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-[11px] text-zinc-500">To update your email address, contact us at <span className="text-zinc-300">contact@blackbird-marketing.co.uk</span></p>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={save} disabled={saving || done} className="btn-primary flex-1 justify-center text-sm">
            {done ? '✓ Saved' : saving ? 'Saving…' : 'Save Changes'}
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
  const [profile, setProfile] = useState(null)
  const [notion, setNotion] = useState(null)
  const [notionLoaded, setNotionLoaded] = useState(false)
  const [requests, setRequests] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase
        .from('profiles').select('id, client_id, name, phone').eq('id', session.user.id).single()

      if (!prof?.client_id) { setLoading(false); return }
      setProfile(prof)

      const [{ data: clientData }, { data: reqData }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', prof.client_id).single(),
        supabase.from('client_requests').select('*')
          .eq('client_id', prof.client_id).order('created_at', { ascending: false }),
      ])

      setClient(clientData)
      setRequests(reqData || [])

      if (clientData?.name) {
        fetch(`/api/notion-status?name=${encodeURIComponent(clientData.name)}`)
          .then(r => r.json())
          .then(d => { setNotion(d.project || null); setNotionLoaded(true) })
          .catch(() => setNotionLoaded(true))
      } else {
        setNotionLoaded(true)
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
          <div className="flex items-center gap-4">
            <button onClick={() => setShowDetails(true)} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">My details</button>
            <button onClick={signOut} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-6 fade-in-up">

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
                className="text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors">View site ↗</a>
            )}
          </div>

          {!notionLoaded ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-3.5 h-3.5 border-2 border-purple/40 border-t-purple rounded-full animate-spin" />
              <p className="text-xs text-zinc-600">Loading project data…</p>
            </div>
          ) : notion ? (
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
                <div className="w-full bg-zinc-900 rounded-full h-1.5">
                  <div className="bg-purple h-1.5 rounded-full transition-all duration-700" style={{ width: `${notion.progress}%` }} />
                </div>
              )}
              {notion.clientUpdate && (
                <div className="bg-zinc-900 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Latest update</p>
                  <p className="text-sm text-zinc-300 leading-relaxed">{notion.clientUpdate}</p>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 pt-1">
                {notion.sitePackage && <div><p className="text-[10px] text-zinc-600 mb-0.5">Package</p><p className="text-xs font-semibold text-zinc-300">{notion.sitePackage}</p></div>}
                {notion.onboarded && <div><p className="text-[10px] text-zinc-600 mb-0.5">Started</p><p className="text-xs font-semibold text-zinc-300">{fmtDate(notion.onboarded)}</p></div>}
                {notion.projectFinished && <div><p className="text-[10px] text-zinc-600 mb-0.5">Launched</p><p className="text-xs font-semibold text-zinc-300">{fmtDate(notion.projectFinished)}</p></div>}
              </div>
              {notion.filloutFormLink && (
                <div className="pt-2 border-t border-border">
                  <p className="text-[10px] text-zinc-600 mb-2">Need changes to your site? Submit a revision request directly.</p>
                  <a href={notion.filloutFormLink} target="_blank" rel="noopener noreferrer"
                    className="btn-primary text-xs py-1.5 inline-flex">
                    Submit a Revision →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2">
              <p className="text-sm text-zinc-400">Your project is active.</p>
              <p className="text-xs text-zinc-600 mt-1">Project updates will appear here. Contact us if you have any questions.</p>
            </div>
          )}
        </div>

        {/* Requests */}
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
            <button onClick={() => setShowModal(true)} className="btn-primary text-xs py-1.5">+ New Request</button>
          </div>

          {openRequests.length === 0 && resolvedRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600 mb-1">No requests yet</p>
              <p className="text-xs text-zinc-700">Use the button above to get in touch with your account team.</p>
            </div>
          )}
          {openRequests.length > 0 && <div className="space-y-2 mb-4">{openRequests.map(r => <RequestRow key={r.id} r={r} />)}</div>}
          {resolvedRequests.length > 0 && (
            <details className="group">
              <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 select-none">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-open:rotate-90 transition-transform"><path d="M9 18l6-6-6-6"/></svg>
                {resolvedRequests.length} resolved request{resolvedRequests.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">{resolvedRequests.slice(0, 5).map(r => <RequestRow key={r.id} r={r} />)}</div>
            </details>
          )}
        </div>

        {/* Services */}
        <div className="card">
          <p className="section-title mb-1">Other Services We Offer</p>
          <p className="text-xs text-zinc-500 mb-4">Already on a retainer with us? These can be added at any time.</p>
          <div className="grid grid-cols-2 gap-3">
            {SERVICES.map(s => (
              <div key={s.name} className="bg-zinc-900/60 rounded-lg p-3 border border-border/50">
                <p className="text-xs font-semibold text-zinc-200 mb-1">{s.name}</p>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-purple/10 border border-purple/20 rounded-lg p-3 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple/20 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-light">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-purple-light mb-0.5">Refer a business — earn £50</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">Know another trade business who could use our help? We'll pay you £50 for every successful referral. Just mention their name when you get in touch.</p>
            </div>
          </div>
          <p className="text-[11px] text-zinc-600 mt-3">Interested in any of the above? Message us on WhatsApp or submit a general request above.</p>
        </div>

        {/* Contact */}
        <div className="card-sm">
          <p className="text-xs font-semibold text-zinc-300 mb-3">Get in touch</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href={`mailto:contact@blackbird-marketing.co.uk`}
              className="flex-1 flex items-center gap-2.5 p-3 rounded-lg bg-zinc-900/60 border border-border/50 hover:border-zinc-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-500 flex-shrink-0">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <div>
                <p className="text-[10px] text-zinc-600">Email</p>
                <p className="text-xs text-zinc-300">contact@blackbird-marketing.co.uk</p>
              </div>
            </a>
            <a href={`https://wa.me/${WATI_NUMBER}`} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center gap-2.5 p-3 rounded-lg bg-zinc-900/60 border border-border/50 hover:border-zinc-700 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-emerald-500 flex-shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              <div>
                <p className="text-[10px] text-zinc-600">WhatsApp</p>
                <p className="text-xs text-zinc-300">Message us directly</p>
              </div>
            </a>
          </div>
        </div>

      </main>

      {showModal && (
        <RequestModal client={client} openRequests={openRequests} onSubmit={handleSubmit} onClose={() => setShowModal(false)} />
      )}
      {showDetails && profile && (
        <UpdateDetailsModal
          profile={profile}
          onSave={(updated) => setProfile(p => ({ ...p, ...updated }))}
          onClose={() => setShowDetails(false)}
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
          <span>{type?.label}</span><span>·</span>
          <span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
        </div>
        {r.description && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">{r.description}</p>}
      </div>
      <span className={`text-[10px] font-semibold flex-shrink-0 ${statusColor}`}>{statusLabel}</span>
    </div>
  )
}
