import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import BriefOnboarding from './BriefOnboarding'

const DASHBOARD_API = 'https://dashboard.blackbird-marketing.uk'

const CREDIT_TYPES = [
  { value: 'text_copy',        label: 'Text or copy change',              cost: 1 },
  { value: 'image_swap',       label: 'Image swap',                       cost: 1 },
  { value: 'colour_font',      label: 'Colour or font change',            cost: 2 },
  { value: 'layout_adjust',    label: 'Layout adjustment (move a section)', cost: 3 },
  { value: 'new_section',      label: 'New section added',                cost: 5 },
  { value: 'page_restructure', label: 'Page restructure',                 cost: 8 },
  { value: 'new_page',         label: 'New page added',                  cost: 10 },
  { value: 'full_redesign',    label: 'Full redesign request',           cost: 15 },
]

const STAGE_LABELS = {
  'Brief Pending':         "We're waiting for your brief",
  'Brief Received':        "We're reviewing your brief",
  'Build In Progress':     "We're building your site",
  'Internal QC':           "We're quality checking your site",
  'Client Review':         "Your site is ready to review",
  'Revisions':             "We're making your changes",
  'Approved':              "Your site is approved",
  'Live':                  "Your site is live",
  '30 Days Maintenance':   "Your site is live",
  'GMB Setup':             "Your site is live",
  'Directory Setup':       "Your site is live",
  'Maintenance':           "Your site is live and maintained",
  'No Longer Maintaining': "Your project has been completed",
  'Dead':                  "Your project has been completed",
}

const STAGE_NEXT = {
  'Brief Pending':         "Complete your brief to get started",
  'Brief Received':        "We'll confirm your brief within 24 hours",
  'Build In Progress':     "We'll send you a preview to review",
  'Internal QC':           "Quality checks in progress",
  'Client Review':         "Review your site and submit any changes",
  'Revisions':             "Changes being made — preview coming soon",
  'Approved':              "Final checks before going live",
  'Live':                  "Your site is live — well done!",
  '30 Days Maintenance':   "Ongoing support and updates",
  'GMB Setup':             "Ongoing support and updates",
  'Directory Setup':       "Ongoing support and updates",
  'Maintenance':           "Ongoing support and updates",
  'No Longer Maintaining': "Contact us to restart at any time",
  'Dead':                  "Contact us to restart at any time",
}

const STAGE_COMPLETED = new Set(['No Longer Maintaining', 'Dead'])

const PIPELINE = [
  { label: 'Brief',  stages: ['Brief Pending', 'Brief Received'] },
  { label: 'Build',  stages: ['Build In Progress', 'Internal QC'] },
  { label: 'Review', stages: ['Client Review', 'Revisions', 'Approved'] },
  { label: 'Live',   stages: ['Live', 'Maintenance', '30 Days Maintenance', 'GMB Setup', 'Directory Setup'] },
]

const TRADE_REQUEST_TYPES = [
  { value: 'revision_request',  label: 'Revision Request',     desc: 'Changes to work we\'ve delivered',                                       structured: true,  requiresUrl: true },
  { value: 'website_change',    label: 'Website Change',       desc: 'Page edits, new sections, copy updates',                                 structured: true,  requiresUrl: true },
  { value: 'feature_request',   label: 'New Feature Request',  desc: 'Something you\'d like added that wasn\'t in the original brief',         structured: true,  fixedCredits: 8 },
  { value: 'content_feedback',  label: 'Content Feedback',     desc: 'GMB posts, blog articles, social content' },
  { value: 'domain_technical',  label: 'Domain / Technical Issue', desc: 'DNS, email, hosting or technical problems',                         freeCredits: true },
  { value: 'billing',           label: 'Billing / Account',    desc: 'Invoice queries, plan changes' },
  { value: 'question',          label: 'General Question',     desc: 'Anything else' },
]
const PROPERTY_REQUEST_TYPES = [
  { value: 'revision_request',  label: 'Revision Request',     desc: 'Changes to work we\'ve delivered',                                       structured: true,  requiresUrl: true },
  { value: 'listing_add',       label: 'Add a Listing',        desc: 'New property to publish on the site',                                    requiresAddress: true },
  { value: 'listing_remove',    label: 'Remove a Listing',     desc: 'Sold or off-market — take it down',                                      requiresAddress: true },
  { value: 'website_change',    label: 'Site Change',          desc: 'Page edits, layout updates',                                             structured: true,  requiresUrl: true },
  { value: 'feature_request',   label: 'New Feature Request',  desc: 'Something you\'d like added that wasn\'t in the original brief',         structured: true,  fixedCredits: 8 },
  { value: 'domain_technical',  label: 'Domain / Technical Issue', desc: 'DNS, email, hosting or technical problems',                         freeCredits: true },
  { value: 'billing',           label: 'Billing / Account',    desc: 'Invoice queries, plan changes' },
  { value: 'question',          label: 'General Question',     desc: 'Anything else' },
]
const ALL_REQUEST_TYPES = [
  ...TRADE_REQUEST_TYPES,
  { value: 'listing_add',    label: 'Add a Listing' },
  { value: 'listing_remove', label: 'Remove a Listing' },
]

const SERVICES = [
  { name: 'Email Marketing',          desc: 'Monthly newsletters and automated campaigns to keep your customers coming back.' },
  { name: 'Social Media Management',  desc: 'Consistent posting across Facebook and Instagram — done for you.' },
  { name: 'Paid Ad Management',       desc: 'Google and Facebook ads targeted to your local area, managed end to end.' },
  { name: 'Extra Website Pages',      desc: 'Location pages, service pages, or anything else to help you rank and convert.' },
]

const WATI_NUMBER = '447395837967'
const NOTES_READ_KEY = (id) => `bb_notes_read_${id}`
const REPLIES_READ_KEY = (id) => `bb_replies_read_${id}`
const PUSH_PROMPT_KEY = (id) => `bb_push_prompt_seen_${id}`

function loadReadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) }
  catch { return new Set() }
}
function saveReadSet(key, set) {
  localStorage.setItem(key, JSON.stringify([...set]))
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtShort(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
function daysSince(iso) {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
}

// ─── REQUEST MODAL ────────────────────────────────────────────────────────────
function RequestModal({ client, siteType, openRequests, credits, onSubmit, onClose }) {
  const requestTypes = siteType === 'property' ? PROPERTY_REQUEST_TYPES : TRADE_REQUEST_TYPES
  const [type, setType]           = useState(requestTypes[0].value)
  const [creditType, setCreditType] = useState(CREDIT_TYPES[0].value)
  const [title, setTitle]         = useState('')
  const [description, setDescription] = useState('')
  const [currentState, setCurrentState] = useState('')
  const [desiredState, setDesiredState] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')
  const [pageUrl, setPageUrl]     = useState('')
  const [address, setAddress]     = useState('')
  const [files, setFiles]         = useState([])
  const [urgent, setUrgent]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')

  const selectedType   = requestTypes.find(t => t.value === type)
  const existingOfType = openRequests.find(r => r.type === type && r.status !== 'done')
  const descLen        = description.trim().length
  const isRevision     = type === 'revision_request'
  const isStructured   = !!selectedType?.structured
  const isFree         = !!selectedType?.freeCredits

  const selectedCreditType = CREDIT_TYPES.find(c => c.value === creditType)
  const creditCost         = isFree ? 0
    : selectedType?.fixedCredits ? selectedType.fixedCredits
    : isRevision ? (selectedCreditType?.cost ?? 0)
    : 0
  const creditsAvailable   = (credits?.revision_credits ?? 30) - (credits?.revision_credits_used ?? 0)
  const creditsAfter       = creditsAvailable - creditCost
  const hasEnoughCredits   = creditCost === 0 || creditsAfter >= 0

  const submit = async () => {
    setError('')
    if (!title.trim()) { setError('Please add a brief title.'); return }
    if (selectedType.requiresUrl && !pageUrl.trim()) { setError('Please include the page URL for this change.'); return }
    if (selectedType.requiresAddress && !address.trim()) { setError('Please include the property address.'); return }
    if (isStructured) {
      if (currentState.trim().length < 30) { setError('Please describe the current state in at least 30 characters.'); return }
      if (desiredState.trim().length < 30) { setError('Please describe the desired state in at least 30 characters.'); return }
    } else if (type === 'content_feedback') {
      if (descLen < 30) { setError('Please tell us what needs changing (min 30 characters).'); return }
    } else {
      if (descLen < 30) { setError('Please describe your request in more detail (at least 30 characters).'); return }
    }
    if (existingOfType) { setError('You already have an open request of this type. Please wait for it to be resolved first.'); return }
    if (!hasEnoughCredits) { setError('Not enough credits for this request.'); return }

    setSubmitting(true)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token

      const uploadedUrls = []
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const path = `${client.id}/${Date.now()}_${safeName}`
        const { data: uploadData } = await supabase.storage
          .from('request-attachments').upload(path, file, { contentType: file.type })
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('request-attachments').getPublicUrl(uploadData.path)
          uploadedUrls.push(publicUrl)
        }
      }

      const ref = selectedType?.requiresUrl ? pageUrl.trim() : selectedType?.requiresAddress ? address.trim() : null
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          client_id: client.id, type, title: title.trim(),
          description: description.trim(),
          current_state: currentState.trim() || null,
          desired_state: desiredState.trim() || null,
          reference_url: referenceUrl.trim() || null,
          page_url: ref || null, priority: urgent ? 'urgent' : 'normal',
          attachments: uploadedUrls, paid_revision: false,
          credit_cost: creditCost > 0 ? creditCost : null,
          request_type: isRevision ? creditType : (selectedType?.fixedCredits ? type : null),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setSubmitting(false); return }
      onSubmit(data.request, data.credits)
    } catch (e) {
      setError('Failed to submit — please try again. ' + (e?.message || ''))
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
              {requestTypes.map(t => {
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

          {/* Credits info */}
          {(isRevision || selectedType?.fixedCredits) && (
            <div className={`px-3 py-2.5 rounded-lg border ${
              creditsAvailable >= 15 ? 'bg-emerald-900/10 border-emerald-900/30' :
              creditsAvailable >= 5  ? 'bg-amber-900/10 border-amber-900/30' :
              'bg-red-900/10 border-red-900/30'
            }`}>
              <p className={`text-xs font-semibold ${
                creditsAvailable >= 15 ? 'text-emerald-400' : creditsAvailable >= 5 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {creditsAvailable} credit{creditsAvailable !== 1 ? 's' : ''} remaining
              </p>
              {selectedType?.fixedCredits && (
                <p className="text-[11px] text-zinc-400 mt-1">
                  This request costs <span className="text-zinc-200 font-semibold">{selectedType.fixedCredits} credits</span>. You'll have <span className="text-zinc-200 font-semibold">{creditsAfter}</span> remaining.
                </p>
              )}
            </div>
          )}
          {isFree && (
            <div className="px-3 py-2.5 rounded-lg border border-emerald-900/30 bg-emerald-900/10">
              <p className="text-xs text-emerald-400 font-semibold">Free request — no credits used</p>
              <p className="text-[11px] text-zinc-400 mt-1">Technical issues like DNS, email or hosting don't cost credits.</p>
            </div>
          )}

          {isRevision && (
            <div>
              <label className="label block mb-1.5">What type of change?</label>
              <div className="space-y-1.5">
                {CREDIT_TYPES.map(ct => (
                  <button key={ct.value} onClick={() => setCreditType(ct.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all ${
                      creditType === ct.value ? 'border-purple/50 bg-purple/10' : 'border-border hover:border-zinc-700'
                    }`}>
                    <span className={`text-xs ${creditType === ct.value ? 'text-purple-light font-semibold' : 'text-zinc-300'}`}>
                      {ct.label}
                    </span>
                    <span className={`text-[10px] font-mono font-bold ${creditType === ct.value ? 'text-purple-light' : 'text-zinc-500'}`}>
                      {ct.cost} cr
                    </span>
                  </button>
                ))}
              </div>
              {selectedCreditType && (
                <div className={`mt-2 px-3 py-2 rounded-lg text-xs ${hasEnoughCredits ? 'bg-zinc-900' : 'bg-red-900/20 border border-red-900/40'}`}>
                  {hasEnoughCredits ? (
                    <span className="text-zinc-400">
                      This request costs <span className="text-zinc-200 font-semibold">{creditCost} credit{creditCost !== 1 ? 's' : ''}</span>.
                      You'll have <span className="text-zinc-200 font-semibold">{creditsAfter}</span> remaining.
                    </span>
                  ) : (
                    <div>
                      <p className="text-red-400 font-semibold mb-1">
                        You need {Math.abs(creditsAfter)} more credit{Math.abs(creditsAfter) !== 1 ? 's' : ''} for this request.
                      </p>
                      <p className="text-zinc-400">Top up your credits:</p>
                      <div className="mt-1.5 space-y-0.5">
                        <p className="text-zinc-300">10 credits — £50</p>
                        <p className="text-zinc-300">20 credits — £80</p>
                      </div>
                      <p className="text-zinc-500 mt-1.5">Contact us on WhatsApp to top up.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label block mb-1.5">Request title</label>
            <input className="input" placeholder="e.g. Update homepage hero text"
              value={title} onChange={e => setTitle(e.target.value)} maxLength={120} />
          </div>

          {selectedType?.requiresUrl && (
            <div>
              <label className="label block mb-1.5">Which page needs changing? <span className="text-red-400">*</span></label>
              <input className="input font-mono text-xs" placeholder="https://yoursite.co.uk/page or describe the page"
                value={pageUrl} onChange={e => setPageUrl(e.target.value)} />
            </div>
          )}
          {selectedType?.requiresAddress && (
            <div>
              <label className="label block mb-1.5">Property address <span className="text-red-400">*</span></label>
              <input className="input" placeholder="e.g. 42 High Street, Bristol, BS1 1AB"
                value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          )}

          {isStructured ? (
            <>
              <div>
                <label className="label block mb-1.5">
                  What does it currently say/look like? <span className="text-red-400">*</span>
                  <span className={`ml-2 normal-case font-normal ${currentState.trim().length < 30 ? 'text-zinc-700' : 'text-emerald-500'}`}>{currentState.trim().length}/30 min</span>
                </label>
                <textarea className="input resize-none text-sm" rows={3}
                  placeholder="Describe the current state — what's there now."
                  value={currentState} onChange={e => setCurrentState(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1.5">
                  What would you like it to say/look like? <span className="text-red-400">*</span>
                  <span className={`ml-2 normal-case font-normal ${desiredState.trim().length < 30 ? 'text-zinc-700' : 'text-emerald-500'}`}>{desiredState.trim().length}/30 min</span>
                </label>
                <textarea className="input resize-none text-sm" rows={3}
                  placeholder="Describe the desired result — exactly what you want it to be."
                  value={desiredState} onChange={e => setDesiredState(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1.5">Any examples or references? <span className="text-zinc-700 normal-case font-normal">optional</span></label>
                <input className="input font-mono text-xs" placeholder="https://example.com or a description"
                  value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1.5">Anything else? <span className="text-zinc-700 normal-case font-normal">optional</span></label>
                <textarea className="input resize-none text-sm" rows={2}
                  placeholder="Extra context if helpful"
                  value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </>
          ) : type === 'content_feedback' ? (
            <>
              <div>
                <label className="label block mb-1.5">Content URL or title <span className="text-zinc-700 normal-case font-normal">optional</span></label>
                <input className="input text-xs" placeholder="https://… or e.g. October blog post"
                  value={referenceUrl} onChange={e => setReferenceUrl(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1.5">
                  What needs changing? <span className="text-red-400">*</span>
                  <span className={`ml-2 normal-case font-normal ${descLen < 30 ? 'text-zinc-700' : 'text-emerald-500'}`}>{descLen}/30 min</span>
                </label>
                <textarea className="input resize-none text-sm" rows={4}
                  placeholder="Tell us exactly what needs changing and why."
                  value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div>
                <label className="label block mb-1.5">Why? <span className="text-zinc-700 normal-case font-normal">optional</span></label>
                <textarea className="input resize-none text-sm" rows={2}
                  placeholder="Context — what's prompting this change?"
                  value={currentState} onChange={e => setCurrentState(e.target.value)} />
              </div>
            </>
          ) : (
            <div>
              <label className="label block mb-1.5">
                Description
                <span className={`ml-2 normal-case font-normal ${descLen < 30 ? 'text-zinc-700' : 'text-emerald-500'}`}>{descLen}/30 min</span>
              </label>
              <textarea className="input resize-none text-sm" rows={4}
                placeholder="Describe exactly what you need. The more detail you give, the faster we can get it done."
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          )}

          <div>
            <label className="label block mb-1.5">
              Attachments <span className="ml-1.5 text-zinc-700 font-normal normal-case">optional · max 5</span>
            </label>
            <input type="file" multiple accept="image/*,video/*"
              onChange={e => setFiles(Array.from(e.target.files).slice(0, 5))}
              className="w-full text-xs text-zinc-500 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 transition-colors" />
            {files.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-lg">
                    <span>{f.name.length > 24 ? f.name.slice(0, 24) + '…' : f.name}</span>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-zinc-600 hover:text-red-400 transition-colors leading-none">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-border hover:border-zinc-700 transition-colors">
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} className="w-3.5 h-3.5 mt-0.5 rounded accent-purple" />
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
          <button onClick={submit} disabled={submitting || (isRevision && !hasEnoughCredits)} className="btn-primary flex-1 justify-center text-sm disabled:opacity-50">
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
    setSaving(false); setDone(true)
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
            <input type="password" className="input" placeholder="New password (min 8 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            {newPassword && <input type="password" className="input" placeholder="Confirm new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />}
          </div>
          <div className="bg-zinc-900 rounded-lg p-3">
            <p className="text-[11px] text-zinc-500">To update your email, contact us at <span className="text-zinc-300">contact@blackbird-marketing.co.uk</span></p>
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

// ─── APPROVAL SECTION ────────────────────────────────────────────────────────
function ApprovalSection({ client, project, onApproved }) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // Preview = the staging/working URL the team builds on; fall back to live domain
  const rawPreview = project?.working_url || client.domain || ''
  const previewUrl = rawPreview
    ? (rawPreview.startsWith('http') ? rawPreview : `https://${rawPreview}`)
    : null

  const approve = async () => {
    setSubmitting(true)
    setError('')
    try {
      const r = await fetch(`${DASHBOARD_API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', project_id: project.id }),
      })
      const data = await r.json()
      if (!r.ok || data.error) {
        setError(data.error || 'Approval failed. Please try again.')
        setSubmitting(false)
        return
      }
      onApproved()
    } catch (e) {
      setError(`Approval failed: ${e.message}`)
      setSubmitting(false)
    }
  }

  return (
    <div className="card border-cyan-900/40 bg-cyan-900/5">
      <p className="section-title text-cyan-400 mb-2">Your site is ready to review</p>

      {!previewUrl ? (
        <p className="text-xs text-zinc-400 leading-relaxed">
          Your preview link is being prepared. We'll notify you when it's ready to review.
        </p>
      ) : (
      <>
      <p className="text-xs text-zinc-400 leading-relaxed mb-4">
        Have a look through your site. When you're happy, approve it and we'll start the go-live process.
        Need changes? Submit a revision request below and we'll make them.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary text-sm py-2 px-4 text-center"
        >
          View site preview →
        </a>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-sm py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            Approve site →
          </button>
        ) : null}
      </div>

      {confirming && (
        <div className="bg-emerald-900/10 border border-emerald-900/40 rounded-lg p-4 mt-3">
          <p className="text-sm font-semibold text-emerald-400 mb-1">Are you sure you're happy with the site and ready to go live?</p>
          <p className="text-xs text-zinc-500 mb-3">After approving we'll prepare the site to go live. You can still request changes after launch using credits.</p>
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={approve}
              disabled={submitting}
              className="text-sm py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Approving…' : 'Confirm approval'}
            </button>
            <button
              onClick={() => { setConfirming(false); setError('') }}
              disabled={submitting}
              className="text-sm py-2 px-4 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              Go back
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-zinc-600 mt-3">Not quite right? Submit a revision request below and we'll make the changes.</p>
      </>
      )}
    </div>
  )
}

// ─── CREDIT TOP-UP BANNER ────────────────────────────────────────────────────
function CreditTopUpBanner({ client, creditsRemaining, onRequested }) {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent]             = useState(false)
  const [error, setError]           = useState('')

  const requestTopUp = async () => {
    setSubmitting(true)
    setError('')
    try {
      const { error: insertErr } = await supabase.from('tasks').insert({
        text: `Credit top-up request from ${client.name}`,
        assignee: 'Rob', priority: 'Medium',
        status: 'todo', done: false,
        project: 'Client Results', category: 'Client',
        client_id: client.id,
        description: `${client.name} has ${creditsRemaining} credits remaining and has requested a top-up.`,
        due_date: new Date().toISOString().slice(0, 10),
      })
      if (insertErr) throw insertErr
      setSent(true)
      onRequested?.()
    } catch (e) {
      setError(`Could not send: ${e.message}`)
    }
    setSubmitting(false)
  }

  if (sent) {
    return (
      <div className="card border-emerald-900/40 bg-emerald-900/5">
        <p className="text-sm font-semibold text-emerald-400 mb-1">Top-up request sent</p>
        <p className="text-xs text-zinc-400">Rob will be in touch within 1 business day.</p>
      </div>
    )
  }

  return (
    <div className="card border-amber-900/40 bg-amber-900/5">
      <p className="section-title text-amber-400 mb-2">Running low on credits</p>
      <p className="text-xs text-zinc-400 mb-3">
        You have <span className="text-amber-400 font-semibold">{creditsRemaining} credit{creditsRemaining !== 1 ? 's' : ''}</span> remaining. To top up, contact your account manager.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { credits: 10, price: 50 },
          { credits: 20, price: 80 },
          { credits: 30, price: 120 },
        ].map(p => (
          <div key={p.credits} className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-center">
            <p className="text-sm font-bold text-zinc-200">{p.credits} credits</p>
            <p className="text-xs text-amber-400 font-semibold">£{p.price}</p>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <button
        onClick={requestTopUp}
        disabled={submitting}
        className="btn-primary text-sm py-2 w-full disabled:opacity-50"
      >
        {submitting ? 'Sending…' : 'Request top-up'}
      </button>
    </div>
  )
}

// ─── PROJECT STATUS CARD ──────────────────────────────────────────────────────
function ProjectStatusCard({ project, notes, brief, client, loading }) {
  if (loading) {
    return (
      <div className="card">
        <p className="section-title mb-4">Your Project</p>
        <div className="flex items-center gap-2 py-2">
          <div className="w-3.5 h-3.5 border-2 border-purple/40 border-t-purple rounded-full animate-spin" />
          <p className="text-xs text-zinc-600">Loading project data…</p>
        </div>
      </div>
    )
  }

  if (!project && brief) {
    return (
      <div className="card">
        <p className="section-title mb-4">Your Project</p>
        <div className="bg-purple/5 border border-purple/20 rounded-lg p-4">
          <p className="text-sm font-semibold text-zinc-200 mb-1">Brief received — thanks!</p>
          <p className="text-xs text-zinc-400 leading-relaxed">We'll review your brief and be in touch within 24 hours to confirm everything and kick off your project.</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="card">
        <p className="section-title mb-4">Your Project</p>
        <p className="text-sm text-zinc-400">Your project is being set up. Contact us if you have any questions.</p>
      </div>
    )
  }

  const daysInStage = daysSince(project.stage_entered_at)
  const stageLabel  = STAGE_LABELS[project.stage] || project.stage
  const nextStep    = STAGE_NEXT[project.stage] || ''
  const pipelineIdx = PIPELINE.findIndex(p => p.stages.includes(project.stage))
  const latestNote  = notes?.[0]
  const isCompleted = STAGE_COMPLETED.has(project.stage)

  if (isCompleted) {
    return (
      <div className="card">
        <p className="section-title mb-3">Your Project</p>
        <div className="bg-zinc-900 rounded-lg p-4">
          <p className="text-sm font-semibold text-zinc-200 mb-1">Your project has been completed.</p>
          <p className="text-xs text-zinc-400 leading-relaxed">Contact us to restart at any time.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">Your Project</p>
        {PIPELINE[PIPELINE.length - 1].stages.includes(project.stage) ? (
          <span className="text-[10px] bg-emerald-900/30 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded-full font-semibold">Live</span>
        ) : null}
      </div>

      {/* Stage label */}
      <div className="bg-zinc-900 rounded-lg p-3 mb-4">
        <p className="text-sm font-semibold text-zinc-100">{stageLabel}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          {daysInStage === 0 ? 'Started today' : `${daysInStage} day${daysInStage !== 1 ? 's' : ''} in this stage`}
          {nextStep && <> · {nextStep}</>}
        </p>
      </div>

      {/* Visual pipeline */}
      <div className="flex items-center mb-4">
        {PIPELINE.map((p, i) => {
          const isPast    = i < pipelineIdx
          const isCurrent = i === pipelineIdx
          const isFuture  = i > pipelineIdx
          return (
            <div key={p.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-1 transition-all ${
                  isPast    ? 'bg-emerald-600/30 border-2 border-emerald-600/50' :
                  isCurrent ? 'bg-purple/30 border-2 border-purple ring-2 ring-purple/20' :
                  'bg-zinc-800 border-2 border-zinc-700'
                }`}>
                  {isPast ? (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <span className={`text-[10px] font-bold ${isCurrent ? 'text-purple-light' : 'text-zinc-600'}`}>{i + 1}</span>
                  )}
                </div>
                <p className={`text-[9px] font-semibold text-center ${isCurrent ? 'text-purple-light' : isPast ? 'text-emerald-500/70' : 'text-zinc-600'}`}>
                  {p.label}
                </p>
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 ${i < pipelineIdx ? 'bg-emerald-600/40' : 'bg-zinc-800'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Latest update */}
      {latestNote && (
        <div className="bg-zinc-900 rounded-lg p-3">
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1">Latest update from Blackbird</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{latestNote.content}</p>
          <p className="text-[10px] text-zinc-600 mt-1">{fmtShort(latestNote.created_at)}</p>
        </div>
      )}

      {project.target_date && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-zinc-600">Target launch date:</p>
          <p className="text-[11px] font-semibold text-zinc-400">{fmtDate(project.target_date)}</p>
        </div>
      )}

      {/* Live website URL — shows once domain is set on the client */}
      {client?.domain ? (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1.5">🌐 Your website</p>
          <a
            href={(client.domain.startsWith('http') ? client.domain : `https://${client.domain}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-light hover:underline"
          >
            View live site →
          </a>
          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">{client.domain.replace(/^https?:\/\/(www\.)?/, '')}</p>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[11px] text-zinc-500">Your website URL will appear here once your site is ready.</p>
        </div>
      )}

      {/* Client Review guidance */}
      {(project.stage === 'Client Review' || project.stage === 'Awaiting Client Feedback') && (
        <div className="mt-3 rounded-lg border border-amber-900/40 bg-amber-950/20 p-3">
          <p className="text-sm font-semibold text-amber-300 mb-1">Your site is ready for your review.</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Check each page carefully and use the button below to request any changes.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── UPDATES FEED ─────────────────────────────────────────────────────────────
function UpdatesFeed({ notes, clientId, loading, onLoadMore, hasMore }) {
  const [readIds, setReadIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(NOTES_READ_KEY(clientId)) || '[]')) }
    catch { return new Set() }
  })
  const [showAll, setShowAll] = useState(false)

  const markRead = (id) => {
    if (readIds.has(id)) return
    const next = new Set([...readIds, id])
    setReadIds(next)
    localStorage.setItem(NOTES_READ_KEY(clientId), JSON.stringify([...next]))
  }

  const visibleNotes = showAll ? notes : notes.slice(0, 5)
  const unreadCount  = notes.filter(n => !readIds.has(n.id)).length

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <p className="section-title mb-0">
          Project Updates
          {unreadCount > 0 && (
            <span className="ml-2 text-[10px] bg-purple/20 text-purple-light border border-purple/30 px-2 py-0.5 rounded-full font-normal normal-case tracking-normal">
              {unreadCount} new
            </span>
          )}
        </p>
        {unreadCount > 0 && (
          <button onClick={() => {
            const next = new Set([...readIds, ...notes.map(n => n.id)])
            setReadIds(next)
            localStorage.setItem(NOTES_READ_KEY(clientId), JSON.stringify([...next]))
          }} className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-3.5 h-3.5 border-2 border-purple/40 border-t-purple rounded-full animate-spin" />
          <p className="text-xs text-zinc-600">Loading updates…</p>
        </div>
      )}

      {!loading && notes.length === 0 && (
        <p className="text-sm text-zinc-500 leading-relaxed">
          Updates from your Blackbird team will appear here. We'll keep you posted on your project progress.
        </p>
      )}

      {!loading && notes.length > 0 && (
        <div className="space-y-3">
          {visibleNotes.map(note => {
            const isUnread = !readIds.has(note.id)
            return (
              <div key={note.id}
                className={`flex items-start gap-3 p-3 rounded-lg bg-zinc-900/60 border cursor-pointer transition-colors ${isUnread ? 'border-purple/30 hover:border-purple/50' : 'border-border/50 hover:border-zinc-700'}`}
                onClick={() => markRead(note.id)}>
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${isUnread ? 'bg-purple' : 'bg-zinc-700'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[10px] text-zinc-500 font-semibold">The Blackbird Team</p>
                    <span className="text-zinc-700">·</span>
                    <p className="text-[10px] text-zinc-600">{fmtShort(note.created_at)}</p>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">{note.content}</p>
                </div>
              </div>
            )
          })}
          {notes.length > 5 && !showAll && (
            <button onClick={() => setShowAll(true)} className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors w-full text-center pt-1">
              Show {notes.length - 5} more update{notes.length - 5 !== 1 ? 's' : ''} ↓
            </button>
          )}
          {showAll && hasMore && (
            <button onClick={onLoadMore} className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors w-full text-center pt-1">
              Load older updates ↓
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MAIN PORTAL ─────────────────────────────────────────────────────────────
export default function Portal({ session }) {
  const [client, setClient]         = useState(null)
  const [profile, setProfile]       = useState(null)
  const [requests, setRequests]     = useState([])
  const [project, setProject]       = useState(null)
  const [brief, setBrief]           = useState(undefined)  // undefined = not yet fetched
  const [notes, setNotes]           = useState([])
  const [credits, setCredits]       = useState({ revision_credits: 30, revision_credits_used: 0 })
  const [projectLoaded, setProjectLoaded] = useState(false)
  const [notesOffset, setNotesOffset] = useState(0)
  const [hasMoreNotes, setHasMoreNotes] = useState(false)
  const [showModal, setShowModal]   = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [chatReq, setChatReq]       = useState(null)
  const [showBell, setShowBell]     = useState(false)
  const [bellTick, setBellTick]     = useState(0) // re-render bumper for read-set updates
  const [showPushPrompt, setShowPushPrompt] = useState(false)

  const fetchProjectData = async (clientId, offset = 0) => {
    try {
      const res = await fetch(`${DASHBOARD_API}/api/projects?client_id=${clientId}&notes_offset=${offset}`)
      const data = await res.json()
      if (offset === 0) {
        setProject(data.project || null)
        setBrief(data.brief || null)
        setNotes(data.notes || [])
        setCredits(data.credits || { revision_credits: 30, revision_credits_used: 0 })
        setHasMoreNotes((data.notes || []).length === 10)
      } else {
        setNotes(prev => [...prev, ...(data.notes || [])])
        setHasMoreNotes((data.notes || []).length === 10)
      }
    } catch {
      setBrief(null)
    }
    setProjectLoaded(true)
  }

  useEffect(() => {
    async function load() {
      const { data: prof } = await supabase
        .from('profiles').select('id, client_id, name, phone').eq('id', session.user.id).maybeSingle()

      if (!prof?.client_id) { setLoading(false); setBrief(null); return }
      setProfile(prof)

      const [{ data: clientData }, { data: reqData }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', prof.client_id).single(),
        supabase.from('client_requests').select('*, request_messages(id, sender_type, message, created_at)')
          .eq('client_id', prof.client_id).order('created_at', { ascending: false }),
      ])

      // Compute last team message per request for unread tracking
      const enrichedRequests = (reqData || []).map(r => {
        const msgs = (r.request_messages || []).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        const lastTeam = msgs.find(m => m.sender_type === 'team')
        return {
          ...r,
          last_team_message_id: lastTeam?.id || null,
          last_team_message_at: lastTeam?.created_at || null,
          last_team_message_preview: lastTeam?.message || null,
        }
      })

      setClient(clientData)
      setRequests(enrichedRequests)
      setLoading(false)

      if (clientData?.id) fetchProjectData(clientData.id)
    }
    load()
  }, [session])

  const loadMoreNotes = () => {
    if (client) {
      const next = notesOffset + 10
      setNotesOffset(next)
      fetchProjectData(client.id, next)
    }
  }

  const handleBriefComplete = () => {
    if (client) fetchProjectData(client.id)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 5000)
  }

  // ── Unread items: project_notes + team replies on requests ─────────────
  const notifications = (() => {
    if (!client?.id) return []
    const noteRead = loadReadSet(NOTES_READ_KEY(client.id))
    const repliesRead = loadReadSet(REPLIES_READ_KEY(client.id))
    const items = []
    for (const n of (notes || [])) {
      if (!noteRead.has(n.id)) {
        items.push({
          kind: 'project_update',
          id: n.id,
          title: 'Project update',
          preview: (n.content || '').slice(0, 90),
          author: n.author || 'The Blackbird Team',
          created_at: n.created_at,
        })
      }
    }
    for (const r of (requests || [])) {
      const lastTeam = (r.last_team_message_id && !repliesRead.has(r.last_team_message_id)) ? r : null
      if (lastTeam) {
        items.push({
          kind: 'request_reply',
          id: r.last_team_message_id,
          requestId: r.id,
          title: `Reply on: ${r.title || 'your request'}`,
          preview: (r.last_team_message_preview || '').slice(0, 90),
          author: 'The Blackbird Team',
          created_at: r.last_team_message_at,
        })
      }
    }
    return items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  })()
  const unreadCount = notifications.length

  // ── Browser tab badge ──────────────────────────────────────────────────
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) Blackbird Portal` : 'Blackbird Portal'
    return () => { document.title = 'Blackbird Portal' }
  }, [unreadCount])

  // ── Poll every 60s for new project_notes + request replies ─────────────
  useEffect(() => {
    if (!client?.id) return
    const id = setInterval(() => { fetchProjectData(client.id) }, 60000)
    return () => clearInterval(id)
  }, [client?.id])

  // ── Push notification prompt (after onboarding, once per client) ──────
  useEffect(() => {
    if (!client?.id) return
    if (brief === undefined || brief === null) return // wait for brief loaded + submitted
    if (typeof Notification === 'undefined') return
    if (Notification.permission !== 'default') return
    if (localStorage.getItem(PUSH_PROMPT_KEY(client.id))) return
    const t = setTimeout(() => setShowPushPrompt(true), 3000)
    return () => clearTimeout(t)
  }, [client?.id, brief])

  const markNotificationRead = (n) => {
    if (!client?.id) return
    if (n.kind === 'project_update') {
      const set = loadReadSet(NOTES_READ_KEY(client.id))
      set.add(n.id)
      saveReadSet(NOTES_READ_KEY(client.id), set)
    } else if (n.kind === 'request_reply') {
      const set = loadReadSet(REPLIES_READ_KEY(client.id))
      set.add(n.id)
      saveReadSet(REPLIES_READ_KEY(client.id), set)
    }
    setBellTick(t => t + 1)
  }

  const markAllRead = () => {
    if (!client?.id) return
    const noteSet = loadReadSet(NOTES_READ_KEY(client.id))
    notifications.filter(n => n.kind === 'project_update').forEach(n => noteSet.add(n.id))
    saveReadSet(NOTES_READ_KEY(client.id), noteSet)
    const replySet = loadReadSet(REPLIES_READ_KEY(client.id))
    notifications.filter(n => n.kind === 'request_reply').forEach(n => replySet.add(n.id))
    saveReadSet(REPLIES_READ_KEY(client.id), replySet)
    setBellTick(t => t + 1)
  }

  const onNotificationClick = (n) => {
    markNotificationRead(n)
    setShowBell(false)
    if (n.kind === 'request_reply' && n.requestId) {
      const req = requests.find(r => r.id === n.requestId)
      if (req) setChatReq(req)
    }
    // project_update: just close, the updates feed is on the main view
  }

  const handleSubmit = (newReq, updatedCredits) => {
    setRequests(prev => [newReq, ...prev])
    if (updatedCredits) setCredits(prev => ({ ...prev, ...updatedCredits }))
    setShowModal(false)
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 4000)
    // Belt-and-braces: re-fetch project data so the credit display reflects server state
    if (client?.id) fetchProjectData(client.id)
  }

  const [cancelFlash, setCancelFlash] = useState(null)
  const handleCancel = async (request) => {
    if (!confirm(`Cancel "${request.title}"?${request.credit_cost ? ` ${request.credit_cost} credit${request.credit_cost === 1 ? '' : 's'} will be refunded.` : ''}`)) return
    const token = (await supabase.auth.getSession()).data.session?.access_token
    try {
      const res = await fetch('/api/submit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'cancel', request_id: request.id }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { alert(`Could not cancel: ${data.error || res.statusText}`); return }
      setRequests(prev => prev.map(r => r.id === request.id ? { ...r, status: 'cancelled', credits_deducted: false } : r))
      if (data.credits) setCredits(prev => ({ ...prev, ...data.credits }))
      setCancelFlash(`Request cancelled. ${data.refunded || 0} credit${data.refunded === 1 ? '' : 's'} refunded.`)
      setTimeout(() => setCancelFlash(null), 5000)
    } catch (e) {
      alert(`Cancel failed: ${e.message}`)
    }
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

  // Show onboarding if no brief submitted and project data has loaded
  if (projectLoaded && brief === null) {
    return (
      <BriefOnboarding
        client={client}
        session={session}
        onComplete={handleBriefComplete}
      />
    )
  }

  const openRequests     = requests.filter(r => r.status !== 'done')
  const resolvedRequests = requests.filter(r => r.status === 'done')
  const creditsRemaining = (credits?.revision_credits ?? 30) - (credits?.revision_credits_used ?? 0)

  return (
    <div className="min-h-screen bg-black overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-purple flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">B</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-zinc-100 leading-none truncate">{client.name}</p>
              <p className="text-[10px] text-zinc-600 leading-none mt-0.5 truncate">Blackbird Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            <NotificationBell
              key={bellTick}
              count={unreadCount}
              items={notifications.slice(0, 5)}
              isOpen={showBell}
              onToggle={() => setShowBell(o => !o)}
              onClick={onNotificationClick}
              onMarkAll={() => { markAllRead(); setShowBell(false) }}
              onClose={() => setShowBell(false)}
            />
            <button onClick={() => setShowDetails(true)} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors whitespace-nowrap">My details</button>
            <button onClick={signOut} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors whitespace-nowrap">Sign out</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-5 py-6 sm:py-8 space-y-6 fade-in-up">

        {/* Account context — a client on a shared device may land here on a
            stale session (e.g. an earlier business they onboarded). Make the
            resolved business obvious and give a one-click way to switch. */}
        <div className="bg-purple/5 border border-purple/20 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-zinc-300">
            You're viewing <span className="font-bold text-zinc-100">{client.name}</span>
          </p>
          <button onClick={signOut}
            className="text-xs text-purple-light hover:text-purple transition-colors text-left sm:text-right whitespace-normal">
            Not {client.name}? Sign out &amp; switch account
          </button>
        </div>

        {submitted && (
          <div className="bg-emerald-900/30 border border-emerald-900/50 rounded-xl px-4 py-3 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p className="text-sm text-emerald-400">Request submitted — we'll be in touch within 1 business day.</p>
          </div>
        )}

        {/* Project status */}
        <ProjectStatusCard project={project} notes={notes} brief={brief} client={client} loading={!projectLoaded} />

        {/* Approval section — only when site is in Client Review */}
        {project?.stage === 'Client Review' && (
          <ApprovalSection
            client={client}
            project={project}
            onApproved={() => {
              setProject(p => p ? { ...p, stage: 'Approved' } : p)
              fetchProjectData(client.id)
            }}
          />
        )}

        {/* Low-credit top-up banner */}
        {creditsRemaining < 5 && project && (
          <CreditTopUpBanner
            client={client}
            creditsRemaining={creditsRemaining}
          />
        )}

        {/* Project updates feed */}
        {(projectLoaded ? notes.length > 0 : true) && (
          <UpdatesFeed
            notes={notes}
            clientId={client.id}
            loading={!projectLoaded}
            onLoadMore={loadMoreNotes}
            hasMore={hasMoreNotes}
          />
        )}

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

          {/* Credits balance */}
          <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-4 ${
            creditsRemaining <= 4 ? 'bg-red-900/10 border border-red-900/30' :
            creditsRemaining <= 14 ? 'bg-amber-900/10 border border-amber-900/30' : 'bg-zinc-900/60'
          }`}>
            <div>
              <p className="text-[11px] text-zinc-400">
                Revision credits:{' '}
                <span className={`font-semibold ${
                  creditsRemaining <= 4 ? 'text-red-400' :
                  creditsRemaining <= 14 ? 'text-amber-400' : 'text-zinc-200'
                }`}>
                  {creditsRemaining} remaining
                </span>
              </p>
              <p className="text-[10px] text-zinc-700 mt-0.5">Used for site changes · costs vary by change type</p>
            </div>
            {creditsRemaining <= 4 && (
              <span className="text-[10px] text-red-400 font-semibold">Low</span>
            )}
          </div>

          {openRequests.length === 0 && resolvedRequests.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-zinc-600 mb-1">No requests yet</p>
              <p className="text-xs text-zinc-700">Use the button above to get in touch with your account team.</p>
            </div>
          )}
          {cancelFlash && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
              <p className="text-xs text-emerald-300">{cancelFlash}</p>
            </div>
          )}
          {openRequests.length > 0 && <div className="space-y-2 mb-4">{openRequests.map(r => <RequestRow key={r.id} r={r} onOpen={() => setChatReq(r)} onCancel={handleCancel} />)}</div>}
          {resolvedRequests.length > 0 && (
            <details className="group">
              <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 select-none">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-open:rotate-90 transition-transform"><path d="M9 18l6-6-6-6"/></svg>
                {resolvedRequests.length} resolved request{resolvedRequests.length !== 1 ? 's' : ''}
              </summary>
              <div className="mt-2 space-y-2">{resolvedRequests.slice(0, 5).map(r => <RequestRow key={r.id} r={r} onOpen={() => setChatReq(r)} />)}</div>
            </details>
          )}
        </div>

        {/* Portal Feedback */}
        <FeedbackSection clientId={client.id} userId={session.user.id} />

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
        </div>

        {/* Contact */}
        <div className="card-sm">
          <p className="text-xs font-semibold text-zinc-300 mb-3">Get in touch</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <a href="mailto:contact@blackbird-marketing.co.uk"
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
        <RequestModal
          client={client}
          siteType={client.site_type || 'trade'}
          openRequests={openRequests}
          credits={credits}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
      {showDetails && profile && (
        <UpdateDetailsModal
          profile={profile}
          onSave={(updated) => setProfile(p => ({ ...p, ...updated }))}
          onClose={() => setShowDetails(false)}
        />
      )}
      {chatReq && (
        <RequestChatModal
          req={chatReq}
          senderName={profile?.name || 'Client'}
          onClose={() => setChatReq(null)}
        />
      )}
      {showPushPrompt && client?.id && (
        <PushPrompt
          clientId={client.id}
          sessionUserId={session?.user?.id}
          onClose={() => setShowPushPrompt(false)}
        />
      )}
    </div>
  )
}

function RequestRow({ r, onOpen, onCancel }) {
  const type = ALL_REQUEST_TYPES.find(t => t.value === r.type)
  const statusColor =
    r.status === 'done'      ? 'text-emerald-400' :
    r.status === 'cancelled' ? 'text-zinc-500' :
    r.status === 'in_progress' ? 'text-blue-400' : 'text-amber-400'
  const statusLabel =
    r.status === 'done'      ? 'Resolved' :
    r.status === 'cancelled' ? 'Cancelled' :
    r.status === 'in_progress' ? 'In progress' : 'Open'
  const canCancel = r.status === 'open'

  return (
    <div className={`p-3 rounded-lg bg-zinc-900/60 border border-border/50 ${r.status === 'cancelled' ? 'opacity-60' : 'hover:border-zinc-600'} transition-colors`}>
      <div onClick={onOpen} className="flex items-start gap-3 cursor-pointer">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-semibold text-zinc-200">{r.title}</span>
            {r.priority === 'urgent' && <span className="text-[10px] bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded font-semibold">Urgent</span>}
            {r.credit_cost && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{r.credit_cost} cr</span>}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <span>{type?.label}</span><span>·</span>
            <span>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
          </div>
          {r.description && <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed line-clamp-2">{r.description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-700"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>
      {canCancel && onCancel && (
        <div className="mt-2 pt-2 border-t border-border/30 flex justify-end">
          <button onClick={(e) => { e.stopPropagation(); onCancel(r) }}
            className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors">
            Cancel request
          </button>
        </div>
      )}
    </div>
  )
}

function RequestChatModal({ req, senderName, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [text, setText]         = useState('')
  const [sending, setSending]   = useState(false)
  const [liveStatus, setLiveStatus] = useState(req.status)
  const bottomRef = useRef(null)

  const type = ALL_REQUEST_TYPES.find(t => t.value === req.type)
  const statusLabel = liveStatus === 'done' ? 'Resolved' : liveStatus === 'in_progress' ? 'In progress' : 'Open'
  const statusColor = liveStatus === 'done' ? 'text-emerald-400 bg-emerald-900/20' : liveStatus === 'in_progress' ? 'text-blue-400 bg-blue-900/20' : 'text-amber-400 bg-amber-900/20'

  useEffect(() => {
    Promise.all([
      supabase.from('request_messages').select('*').eq('request_id', req.id).order('created_at', { ascending: true }),
      supabase.from('client_requests').select('status').eq('id', req.id).single(),
    ]).then(([{ data: msgs }, { data: reqData }]) => {
      setMessages(msgs || [])
      if (reqData?.status) setLiveStatus(reqData.status)
      setLoading(false)
    })
  }, [req.id])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const { data } = await supabase.from('request_messages').insert([{
      request_id: req.id, sender_type: 'client', sender_name: senderName, message: text.trim(),
    }]).select()
    if (data?.[0]) setMessages(prev => [...prev, data[0]])
    setText(''); setSending(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#111111] border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-100">{req.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-600">{type?.label}</span>
                <span className="text-zinc-700">·</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColor}`}>{statusLabel}</span>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl w-6 h-6 flex items-center justify-center flex-shrink-0">×</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-[200px]">
          <div className="text-center mb-4">
            <p className="text-[10px] text-zinc-700 bg-zinc-900 inline-block px-3 py-1 rounded-full">
              {new Date(req.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[80%] bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2">
              <p className="text-xs text-zinc-300 leading-relaxed">{req.description || req.title}</p>
              <p className="text-[10px] text-zinc-600 mt-1">You · original request</p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-3 h-3 border-2 border-purple/40 border-t-purple rounded-full animate-spin" />
              <p className="text-xs text-zinc-600">Loading messages…</p>
            </div>
          ) : messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_type === 'client' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.sender_type === 'client' ? 'bg-purple/20 border border-purple/30 text-zinc-100' : 'bg-zinc-800 border border-zinc-700 text-zinc-200'}`}>
                <p className="text-xs leading-relaxed">{m.message}</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  {m.sender_type === 'client' ? 'You' : 'Blackbird'} · {new Date(m.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="px-4 py-3 border-t border-border flex-shrink-0">
          {req.status === 'done' && (
            <p className="text-[11px] text-zinc-600 text-center mb-2">
              Marked resolved — you can still reply if there's anything more we should know.
            </p>
          )}
          <div className="flex gap-2">
            <textarea className="flex-1 bg-zinc-900 border border-border rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple/50 resize-none" rows={2}
              placeholder="Reply to Blackbird…" value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <button onClick={send} disabled={!text.trim() || sending} className="btn-primary px-4 self-end text-sm disabled:opacity-50">
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const FEEDBACK_CATEGORIES = [
  { value: 'general',         label: 'General feedback' },
  { value: 'feature_request', label: 'I\'d like something added' },
  { value: 'remove',          label: 'Something should be removed' },
  { value: 'bug',             label: 'Something isn\'t working' },
]

function StarRating({ value, onChange }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} className="text-xl leading-none transition-colors">
          <span className={(hover || value) >= n ? 'text-amber-400' : 'text-zinc-700'}>★</span>
        </button>
      ))}
    </div>
  )
}

function FeedbackSection({ clientId, userId }) {
  const [pastFeedback, setPastFeedback] = useState([])
  const [rating, setRating]   = useState(0)
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    supabase.from('portal_feedback').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => setPastFeedback(data || []))
  }, [userId])

  const submit = async () => {
    setError('')
    if (!rating) { setError('Please select a star rating.'); return }
    if (message.trim().length < 10) { setError('Please write at least a sentence of feedback.'); return }
    setSubmitting(true)
    const { data, error: err } = await supabase.from('portal_feedback').insert([{
      client_id: clientId, user_id: userId, rating, category, message: message.trim(),
    }]).select().single()
    if (err) { setError('Something went wrong — please try again.'); setSubmitting(false); return }
    setPastFeedback(prev => [data, ...prev].slice(0, 3))
    setSubmitted(true); setRating(0); setCategory('general'); setMessage(''); setSubmitting(false)
    setTimeout(() => setSubmitted(false), 4000)
  }

  const catLabel = v => FEEDBACK_CATEGORIES.find(c => c.value === v)?.label || v

  return (
    <div className="card">
      <p className="section-title mb-1">Help Us Improve</p>
      <p className="text-xs text-zinc-500 mb-4">Tell us what you think of your client portal.</p>

      {submitted ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-900/20 border border-emerald-900/40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
          <p className="text-xs text-emerald-400">Thanks — your feedback has been sent to the team.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">How are we doing overall?</p>
            <StarRating value={rating} onChange={setRating} />
          </div>
          <div>
            <p className="text-[11px] text-zinc-500 mb-1.5">What's this about?</p>
            <select className="input text-xs w-full" value={category} onChange={e => setCategory(e.target.value)}>
              {FEEDBACK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <textarea className="input w-full text-xs resize-none" rows={3} placeholder="Tell us more…" value={message} onChange={e => setMessage(e.target.value)} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={submit} disabled={submitting} className="btn-primary text-xs py-2 w-full">
            {submitting ? 'Sending…' : 'Send Feedback'}
          </button>
        </div>
      )}

      {pastFeedback.length > 0 && (
        <details className="mt-4 group">
          <summary className="text-[11px] text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors list-none flex items-center gap-1.5 select-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="group-open:rotate-90 transition-transform"><path d="M9 18l6-6-6-6"/></svg>
            Your previous feedback ({pastFeedback.length})
          </summary>
          <div className="mt-3 space-y-2">
            {pastFeedback.map(f => (
              <div key={f.id} className="p-3 rounded-lg bg-zinc-900/60 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-zinc-600">{catLabel(f.category)}</span>
                  <span className="text-[10px] text-amber-400">{'★'.repeat(f.rating)}{'☆'.repeat(5 - f.rating)}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{f.message}</p>
                <p className="text-[10px] text-zinc-700 mt-1">{fmtDate(f.created_at)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// ─── NOTIFICATION BELL ────────────────────────────────────────────────────────
function NotificationBell({ count, items, isOpen, onToggle, onClick, onMarkAll, onClose }) {
  // Click-outside handler
  useEffect(() => {
    if (!isOpen) return
    const onDoc = (e) => {
      if (e.target.closest && e.target.closest('[data-notification-bell]')) return
      onClose?.()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [isOpen, onClose])

  return (
    <div className="relative" data-notification-bell>
      <button onClick={onToggle} className="relative text-zinc-500 hover:text-zinc-200 transition-colors p-1.5"
        title={count > 0 ? `${count} unread update${count === 1 ? '' : 's'}` : 'No new updates'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface" />
        )}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-32px)] bg-[#141414] border border-white/10 rounded-xl shadow-2xl z-40 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-100">Notifications</p>
            {count > 0 && (
              <button onClick={onMarkAll} className="text-[10px] text-zinc-500 hover:text-zinc-200 transition-colors">
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-zinc-500">You're all caught up.</p>
              <p className="text-[10px] text-zinc-700 mt-1">We'll let you know when there's an update.</p>
            </div>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {items.map(n => (
                <button key={n.id} onClick={() => onClick(n)}
                  className="w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors block">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      n.kind === 'project_update' ? 'bg-purple' : 'bg-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-zinc-200 truncate">{n.title}</p>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed mt-0.5">{n.preview}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {n.author} · {n.created_at ? new Date(n.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── PUSH NOTIFICATION PROMPT ────────────────────────────────────────────────
function PushPrompt({ clientId, sessionUserId, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const dismiss = () => {
    if (clientId) localStorage.setItem(PUSH_PROMPT_KEY(clientId), '1')
    onClose?.()
  }

  const enable = async () => {
    setBusy(true); setError(null)
    try {
      if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('This browser does not support push notifications.')
      }
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') { dismiss(); return }

      // Fetch the public VAPID key from /api/push?action=public-key
      const keyRes = await fetch('/api/push?action=public-key')
      const keyData = await keyRes.json()
      if (!keyData.publicKey) throw new Error('Server is not configured for push yet — please try again later.')

      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscribe
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey),
      })

      // Send to /api/push
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const r = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'subscribe', subscription: sub }),
      })
      const data = await r.json()
      if (!r.ok || data.error) throw new Error(data.error || 'Could not save subscription')

      // Mark profile as opted in
      if (sessionUserId) {
        await supabase.from('profiles').update({ push_notifications_enabled: true }).eq('id', sessionUserId)
      }
      dismiss()
    } catch (e) {
      console.error('[push] enable failed:', e)
      setError(e.message || 'Could not enable notifications.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-6 right-6 left-6 sm:left-auto sm:w-80 z-40 bg-[#141414] border border-purple/40 rounded-xl shadow-2xl p-4 fade-in-up">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg bg-purple/20 border border-purple/30 flex items-center justify-center flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-light">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-100 mb-0.5">Stay updated on your project</p>
          <p className="text-[11px] text-zinc-400 leading-relaxed">Get browser notifications when Blackbird posts an update or replies to your requests.</p>
        </div>
      </div>
      {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}
      <div className="flex gap-2">
        <button onClick={enable} disabled={busy} className="btn-primary text-xs flex-1 justify-center">
          {busy ? 'Enabling…' : 'Enable notifications'}
        </button>
        <button onClick={dismiss} disabled={busy} className="btn-secondary text-xs">Maybe later</button>
      </div>
    </div>
  )
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4)
  const safe = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(safe)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
