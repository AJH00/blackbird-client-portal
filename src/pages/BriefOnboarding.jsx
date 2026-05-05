import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DASHBOARD_API = 'https://dashboard.blackbird-marketing.uk'
const STEPS = ['Welcome', 'Business Details', 'Brand & Style', 'Target & Goals', 'Images', 'Review & Submit']
const DEADLINE_OPTIONS = ['ASAP', 'Within 2 weeks', 'Within a month', 'No rush']

const INITIAL_FORM = {
  business_name: '', tagline: '', primary_service: '',
  secondary_services: [], target_areas: [],
  contact_details: { phone: '', email: '', address: '' },
  social_media_links: { facebook: '', instagram: '', linkedin: '', google_business: '' },
  brand_colours: [], logo_uploaded: '', preferred_fonts: '',
  reference_sites: [{ url: '', label: '' }, { url: '', label: '' }, { url: '', label: '' }],
  things_they_like: '', things_they_dislike: '',
  target_customer: '', unique_selling_points: '',
  competitors: ['', '', ''],
  must_include: '', must_avoid: '',
  deadline_preference: 'ASAP', additional_notes: '',
  _images: [],
}

function draftKey(clientId) { return `bb_brief_${clientId}` }

function saveDraft(clientId, form, step) {
  const { _images, ...rest } = form
  const safe = { ...rest, _imageUrls: _images.map(i => ({ url: i.url, label: i.label })) }
  localStorage.setItem(draftKey(clientId), JSON.stringify({ form: safe, step }))
}

function loadDraft(clientId) {
  try {
    const raw = localStorage.getItem(draftKey(clientId))
    if (!raw) return null
    const { form, step } = JSON.parse(raw)
    const restored = { ...INITIAL_FORM, ...form, _images: (form._imageUrls || []).map(i => ({ ...i, uploading: false })) }
    return { form: restored, step }
  } catch { return null }
}

function clearDraft(clientId) { localStorage.removeItem(draftKey(clientId)) }

export default function BriefOnboarding({ client, session, onComplete }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ ...INITIAL_FORM, business_name: client.name || '' })
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [hasDraft, setHasDraft] = useState(false)
  const lastSaved = useRef(Date.now())

  useEffect(() => {
    const draft = loadDraft(client.id)
    if (draft) { setHasDraft(true); setForm(draft.form); setStep(draft.step) }
  }, [client.id])

  useEffect(() => {
    const id = setInterval(() => {
      if (step > 1) { saveDraft(client.id, form, step); lastSaved.current = Date.now() }
    }, 30000)
    return () => clearInterval(id)
  }, [client.id, form, step])

  const upd = useCallback((key, value) => setForm(f => ({ ...f, [key]: value })), [])
  const updNested = useCallback((key, sub, value) => setForm(f => ({ ...f, [key]: { ...f[key], [sub]: value } })), [])

  const signOut = () => supabase.auth.signOut()

  const uploadLogo = async (file) => {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('Logo must be under 10MB.'); return }
    setUploading(true)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${client.id}/logo/${Date.now()}_${safeName}`
    const { data, error: uploadErr } = await supabase.storage.from('client-assets').upload(path, file, { contentType: file.type, upsert: true })
    if (uploadErr) { setError('Logo upload failed: ' + uploadErr.message); setUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(data.path)
    upd('logo_uploaded', publicUrl)
    setUploading(false)
  }

  const uploadImages = async (files) => {
    const current = form._images
    const remaining = 20 - current.length
    const toUpload = Array.from(files).slice(0, remaining)
    if (!toUpload.length) return
    setUploading(true)
    const results = []
    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) continue
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${client.id}/briefs/${Date.now()}_${safeName}`
      const { data, error: uploadErr } = await supabase.storage.from('client-assets').upload(path, file, { contentType: file.type })
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('client-assets').getPublicUrl(data.path)
        results.push({ url: publicUrl, label: '', uploading: false })
      }
    }
    upd('_images', [...current, ...results])
    setUploading(false)
  }

  const removeImage = (idx) => upd('_images', form._images.filter((_, i) => i !== idx))
  const updateImageLabel = (idx, label) => {
    const next = [...form._images]; next[idx] = { ...next[idx], label }; upd('_images', next)
  }

  const submit = async () => {
    setError('')
    if (!form.business_name.trim()) { setError('Business name is required.'); setStep(2); return }
    if (!form.primary_service.trim()) { setError('Primary service is required.'); setStep(2); return }
    if (!form.target_customer.trim()) { setError('Please describe your ideal customer.'); setStep(4); return }

    setSubmitting(true)
    try {
      const imageLabelMap = form._images.reduce((acc, i) => { if (i.label) acc[i.url] = i.label; return acc }, {})
      const refSites = form.reference_sites.filter(s => s.url.trim())

      const payload = {
        action: 'brief',
        client_id: client.id,
        business_name: form.business_name.trim(),
        tagline: form.tagline.trim(),
        primary_service: form.primary_service.trim(),
        secondary_services: form.secondary_services.filter(Boolean),
        target_areas: form.target_areas.filter(Boolean),
        contact_details: form.contact_details,
        social_media_links: form.social_media_links,
        brand_colours: form.brand_colours,
        logo_uploaded: form.logo_uploaded,
        preferred_fonts: form.preferred_fonts.trim(),
        reference_sites: refSites.map(s => s.url),
        things_they_like: [form.things_they_like, refSites.some(s => s.label) ? 'Site labels: ' + refSites.filter(s => s.label).map(s => `${s.label}: ${s.url}`).join(', ') : ''].filter(Boolean).join('\n'),
        things_they_dislike: form.things_they_dislike.trim(),
        target_customer: form.target_customer.trim(),
        unique_selling_points: form.unique_selling_points.trim(),
        competitors: form.competitors.filter(Boolean),
        must_include: form.must_include.trim(),
        must_avoid: form.must_avoid.trim(),
        deadline_preference: form.deadline_preference,
        additional_notes: form.additional_notes.trim(),
        images_uploaded: form._images.map(i => i.url),
        image_labels: imageLabelMap,
      }

      const res = await fetch(`${DASHBOARD_API}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Submission failed — please try again.'); setSubmitting(false); return }
      clearDraft(client.id)
      onComplete()
    } catch (e) {
      setError('Network error — please try again.')
      setSubmitting(false)
    }
  }

  const progress = ((step - 1) / (STEPS.length - 1)) * 100

  const canContinue = () => {
    if (step === 2) return form.business_name.trim().length > 0 && form.primary_service.trim().length > 0
    return true
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-purple flex items-center justify-center">
              <span className="text-white text-xs font-bold leading-none">B</span>
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-100 leading-none">{client.name}</p>
              <p className="text-[10px] text-zinc-600 leading-none mt-0.5">Project Brief</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {step > 1 && (
              <button onClick={() => { saveDraft(client.id, form, step); setHasDraft(true) }}
                className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
                Save draft
              </button>
            )}
            <button onClick={signOut} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Sign out</button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-full h-0.5 bg-zinc-900">
          <div className="h-full bg-purple transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 py-8 fade-in-up">
        {/* Step label */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-0.5">Step {step} of {STEPS.length}</p>
            <h1 className="text-lg font-bold text-zinc-100">{STEPS[step - 1]}</h1>
          </div>
          <div className="flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`rounded-full transition-all ${
                i + 1 < step ? 'w-2 h-2 bg-purple' :
                i + 1 === step ? 'w-2.5 h-2.5 bg-purple ring-2 ring-purple/30' :
                'w-2 h-2 bg-zinc-800'
              }`} />
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-900/50 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Step content */}
        {step === 1 && <Step1Welcome clientName={client.name} onContinue={() => setStep(2)} hasDraft={hasDraft} />}
        {step === 2 && <Step2Business form={form} upd={upd} updNested={updNested} />}
        {step === 3 && <Step3Brand form={form} upd={upd} uploading={uploading} onLogoUpload={uploadLogo} />}
        {step === 4 && <Step4Target form={form} upd={upd} />}
        {step === 5 && <Step5Images form={form} upd={upd} uploading={uploading} onUpload={uploadImages} onRemove={removeImage} onLabel={updateImageLabel} />}
        {step === 6 && <Step6Review form={form} onEdit={setStep} />}

        {/* Navigation */}
        {step > 1 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <button onClick={() => { setError(''); setStep(s => s - 1) }} className="btn-secondary">
              ← Back
            </button>
            {step < STEPS.length ? (
              <button
                onClick={() => { if (canContinue()) { setError(''); saveDraft(client.id, form, step + 1); setStep(s => s + 1) } else setError('Please fill in the required fields before continuing.') }}
                className="btn-primary"
              >
                Continue →
              </button>
            ) : (
              <button onClick={submit} disabled={submitting} className="btn-primary">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Sending brief…
                  </span>
                ) : 'Send Brief to Blackbird'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function Step1Welcome({ clientName, onContinue, hasDraft }) {
  return (
    <div className="space-y-6">
      <div className="card border-purple/20 bg-purple/5">
        <h2 className="text-base font-bold text-zinc-100 mb-2">
          Welcome to your Blackbird portal{clientName ? `, ${clientName.split(' ')[0]}` : ''}.
        </h2>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Your project starts here. Complete your brief below and we'll get started within 24 hours.
        </p>
      </div>

      <div className="card">
        <p className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold mb-4">What to expect</p>
        <div className="flex items-start gap-0">
          {[
            { step: '1', label: 'Complete brief', desc: 'Tell us about your business', active: true },
            { step: '2', label: 'We build', desc: 'Site built in 1–2 weeks' },
            { step: '3', label: 'You review', desc: 'Feedback and revisions' },
            { step: '4', label: 'Go live', desc: 'Your site launches' },
          ].map((s, i, arr) => (
            <div key={s.step} className="flex items-start flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 ${s.active ? 'bg-purple text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  {s.step}
                </div>
                <p className={`text-xs font-semibold text-center ${s.active ? 'text-zinc-200' : 'text-zinc-500'}`}>{s.label}</p>
                <p className="text-[10px] text-zinc-600 text-center mt-0.5 leading-tight">{s.desc}</p>
              </div>
              {i < arr.length - 1 && <div className="h-0.5 bg-zinc-800 flex-1 mt-4 mx-1" />}
            </div>
          ))}
        </div>
      </div>

      <div className="card bg-zinc-900/60">
        <p className="text-xs text-zinc-400 leading-relaxed">
          <span className="font-semibold text-zinc-300">The brief takes about 10–15 minutes.</span>{' '}
          You can save your progress and come back at any time. The more detail you give us, the better your site will be.
        </p>
      </div>

      <button onClick={onContinue} className="btn-primary w-full justify-center py-3">
        {hasDraft ? 'Continue your brief →' : 'Start your brief →'}
      </button>
    </div>
  )
}

function Step2Business({ form, upd, updNested }) {
  const addArea = () => upd('target_areas', [...form.target_areas, ''])
  const updArea = (i, v) => { const a = [...form.target_areas]; a[i] = v; upd('target_areas', a) }
  const removeArea = (i) => upd('target_areas', form.target_areas.filter((_, j) => j !== i))
  const addService = () => upd('secondary_services', [...form.secondary_services, ''])
  const updService = (i, v) => { const a = [...form.secondary_services]; a[i] = v; upd('secondary_services', a) }
  const removeService = (i) => upd('secondary_services', form.secondary_services.filter((_, j) => j !== i))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1.5">Business name <span className="text-red-400">*</span></label>
          <input className="input" value={form.business_name} onChange={e => upd('business_name', e.target.value)} placeholder="e.g. Smith Plumbing" />
        </div>
        <div>
          <label className="label block mb-1.5">Tagline</label>
          <input className="input" value={form.tagline} onChange={e => upd('tagline', e.target.value)} placeholder="e.g. Fast, reliable plumbing" />
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">Primary service <span className="text-red-400">*</span></label>
        <input className="input" value={form.primary_service} onChange={e => upd('primary_service', e.target.value)} placeholder="e.g. Plumbing, Electrical, Landscaping…" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label">Additional services</label>
          <button onClick={addService} className="text-[11px] text-purple-light hover:text-purple transition-colors">+ Add</button>
        </div>
        {form.secondary_services.length === 0 && (
          <button onClick={addService} className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600 hover:border-zinc-600 transition-colors">
            + Add a service (e.g. boiler installations, emergency callouts)
          </button>
        )}
        <div className="space-y-2">
          {form.secondary_services.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={s} onChange={e => updService(i, e.target.value)} placeholder="e.g. Boiler installations" />
              <button onClick={() => removeService(i)} className="text-zinc-600 hover:text-red-400 px-2 transition-colors">×</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label">Areas you cover</label>
          <button onClick={addArea} className="text-[11px] text-purple-light hover:text-purple transition-colors">+ Add area</button>
        </div>
        {form.target_areas.length === 0 && (
          <button onClick={addArea} className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600 hover:border-zinc-600 transition-colors">
            + Add an area (e.g. Bristol, Bath, Somerset)
          </button>
        )}
        <div className="space-y-2">
          {form.target_areas.map((a, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1" value={a} onChange={e => updArea(i, e.target.value)} placeholder="e.g. Bristol" />
              <button onClick={() => removeArea(i)} className="text-zinc-600 hover:text-red-400 px-2 transition-colors">×</button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label block mb-1.5">Phone number</label>
          <input className="input" value={form.contact_details.phone} onChange={e => updNested('contact_details', 'phone', e.target.value)} placeholder="+44 7700 000000" />
        </div>
        <div>
          <label className="label block mb-1.5">Email address</label>
          <input className="input" value={form.contact_details.email} onChange={e => updNested('contact_details', 'email', e.target.value)} placeholder="info@yourbusiness.co.uk" />
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">Business address</label>
        <input className="input" value={form.contact_details.address} onChange={e => updNested('contact_details', 'address', e.target.value)} placeholder="e.g. 12 High Street, Bristol, BS1 1AB" />
      </div>

      <div className="border-t border-border pt-5">
        <p className="label mb-3">Social media links <span className="text-zinc-700 font-normal normal-case">(optional)</span></p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'facebook', label: 'Facebook', ph: 'https://facebook.com/yourpage' },
            { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/yourhandle' },
            { key: 'linkedin', label: 'LinkedIn', ph: 'https://linkedin.com/in/yourprofile' },
            { key: 'google_business', label: 'Google Business', ph: 'Google Business Profile URL' },
          ].map(({ key, label, ph }) => (
            <div key={key}>
              <label className="label block mb-1">{label}</label>
              <input className="input text-xs" value={form.social_media_links[key]} onChange={e => updNested('social_media_links', key, e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Step3Brand({ form, upd, uploading, onLogoUpload }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)
  const logoRef = useRef(null)

  const addColour = () => {
    if (form.brand_colours.length < 4) upd('brand_colours', [...form.brand_colours, '#7c3aed'])
  }
  const updateColour = (i, v) => { const c = [...form.brand_colours]; c[i] = v; upd('brand_colours', c) }
  const removeColour = (i) => upd('brand_colours', form.brand_colours.filter((_, j) => j !== i))

  const updateSite = (i, key, val) => {
    const s = [...form.reference_sites]; s[i] = { ...s[i], [key]: val }; upd('reference_sites', s)
  }
  const addSite = () => {
    if (form.reference_sites.length < 5) upd('reference_sites', [...form.reference_sites, { url: '', label: '' }])
  }
  const removeSite = (i) => upd('reference_sites', form.reference_sites.filter((_, j) => j !== i))

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">Brand colours</label>
          {form.brand_colours.length < 4 && (
            <button onClick={addColour} className="text-[11px] text-purple-light hover:text-purple transition-colors">+ Add colour</button>
          )}
        </div>
        {form.brand_colours.length === 0 && (
          <button onClick={addColour} className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-600 hover:border-zinc-600 transition-colors">
            + Add a brand colour (up to 4)
          </button>
        )}
        <div className="flex flex-wrap gap-3">
          {form.brand_colours.map((c, i) => (
            <div key={i} className="flex items-center gap-2 bg-zinc-900 rounded-lg px-3 py-2 border border-border">
              <input type="color" value={c} onChange={e => updateColour(i, e.target.value)}
                className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
              <span className="text-xs font-mono text-zinc-300">{c.toUpperCase()}</span>
              <button onClick={() => removeColour(i)} className="text-zinc-600 hover:text-red-400 transition-colors text-sm leading-none">×</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label block mb-2">Logo</label>
        {form.logo_uploaded ? (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-zinc-900/60">
            <img src={form.logo_uploaded} alt="Logo preview" className="w-16 h-16 object-contain rounded bg-zinc-800 p-1" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-400 font-semibold mb-1">✓ Logo uploaded</p>
              <button onClick={() => { upd('logo_uploaded', ''); if (logoRef.current) logoRef.current.value = '' }}
                className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">Remove</button>
            </div>
          </div>
        ) : (
          <div>
            <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => onLogoUpload(e.target.files[0])} />
            <button onClick={() => logoRef.current?.click()} disabled={uploading}
              className="w-full px-4 py-3 rounded-lg border border-dashed border-zinc-700 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-400 transition-colors">
              {uploading ? 'Uploading…' : '+ Upload logo (JPG, PNG, WebP · max 10MB)'}
            </button>
          </div>
        )}
      </div>

      <div>
        <label className="label block mb-1.5">Preferred fonts <span className="text-zinc-700 font-normal normal-case">(optional)</span></label>
        <input className="input" value={form.preferred_fonts} onChange={e => upd('preferred_fonts', e.target.value)} placeholder="e.g. Montserrat, Raleway, or 'modern and clean'" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">Reference websites you like</label>
          {form.reference_sites.length < 5 && (
            <button onClick={addSite} className="text-[11px] text-purple-light hover:text-purple transition-colors">+ Add</button>
          )}
        </div>
        <div className="space-y-2">
          {form.reference_sites.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1 text-xs font-mono" value={s.url} onChange={e => updateSite(i, 'url', e.target.value)} placeholder="https://example.com" />
              <input className="input w-36 text-xs" value={s.label} onChange={e => updateSite(i, 'label', e.target.value)} placeholder="e.g. Clean design" />
              {form.reference_sites.length > 1 && (
                <button onClick={() => removeSite(i)} className="text-zinc-600 hover:text-red-400 px-2 transition-colors">×</button>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-zinc-700 mt-1.5">Paste URLs of sites you like — and add a note on what you like about each one</p>
      </div>

      <div>
        <label className="label block mb-1.5">What do you like about those sites?</label>
        <textarea className="input resize-none text-sm" rows={3} value={form.things_they_like}
          onChange={e => upd('things_they_like', e.target.value)}
          placeholder="e.g. I like the clean layout, strong call-to-action buttons, the photos feel professional…" />
      </div>

      <div>
        <label className="label block mb-1.5">What do you want to avoid?</label>
        <textarea className="input resize-none text-sm" rows={3} value={form.things_they_dislike}
          onChange={e => upd('things_they_dislike', e.target.value)}
          placeholder="e.g. Avoid bright neon colours, avoid too much text, don't use stock photos…" />
      </div>
    </div>
  )
}

function Step4Target({ form, upd }) {
  const updateComp = (i, v) => { const c = [...form.competitors]; c[i] = v; upd('competitors', c) }
  const addComp = () => { if (form.competitors.length < 5) upd('competitors', [...form.competitors, '']) }
  const removeComp = (i) => upd('competitors', form.competitors.filter((_, j) => j !== i))

  return (
    <div className="space-y-5">
      <div>
        <label className="label block mb-1.5">Who is your ideal customer? <span className="text-red-400">*</span></label>
        <textarea className="input resize-none text-sm" rows={3} value={form.target_customer}
          onChange={e => upd('target_customer', e.target.value)}
          placeholder="e.g. Homeowners in Bristol aged 30–60 who own their property and need reliable tradespeople they can trust…" />
      </div>

      <div>
        <label className="label block mb-1.5">What makes you different from competitors?</label>
        <textarea className="input resize-none text-sm" rows={3} value={form.unique_selling_points}
          onChange={e => upd('unique_selling_points', e.target.value)}
          placeholder="e.g. We're a family business, same-day callouts, 10 years experience, fully insured and gas safe registered…" />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label">Competitor websites <span className="text-zinc-700 font-normal normal-case">(optional)</span></label>
          {form.competitors.length < 5 && (
            <button onClick={addComp} className="text-[11px] text-purple-light hover:text-purple transition-colors">+ Add</button>
          )}
        </div>
        <div className="space-y-2">
          {form.competitors.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input className="input flex-1 text-xs font-mono" value={c} onChange={e => updateComp(i, e.target.value)} placeholder="https://competitor.co.uk" />
              {form.competitors.length > 1 && (
                <button onClick={() => removeComp(i)} className="text-zinc-600 hover:text-red-400 px-2 transition-colors">×</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">What must be included on the site?</label>
        <textarea className="input resize-none text-sm" rows={3} value={form.must_include}
          onChange={e => upd('must_include', e.target.value)}
          placeholder="e.g. Gas Safe certificate badge, before/after gallery, Google reviews widget, emergency call-out number…" />
      </div>

      <div>
        <label className="label block mb-1.5">What should be avoided?</label>
        <textarea className="input resize-none text-sm" rows={2} value={form.must_avoid}
          onChange={e => upd('must_avoid', e.target.value)}
          placeholder="e.g. Don't include pricing, avoid mentioning specific competitors…" />
      </div>

      <div>
        <label className="label block mb-1.5">Deadline preference</label>
        <div className="flex flex-wrap gap-2">
          {DEADLINE_OPTIONS.map(opt => (
            <button key={opt} onClick={() => upd('deadline_preference', opt)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                form.deadline_preference === opt
                  ? 'border-purple/50 bg-purple/20 text-purple-light'
                  : 'border-border text-zinc-500 hover:border-zinc-700'
              }`}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">Additional notes <span className="text-zinc-700 font-normal normal-case">(optional)</span></label>
        <textarea className="input resize-none text-sm" rows={3} value={form.additional_notes}
          onChange={e => upd('additional_notes', e.target.value)}
          placeholder="Anything else we should know…" />
      </div>
    </div>
  )
}

function Step5Images({ form, upd, uploading, onUpload, onRemove, onLabel }) {
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false)
    onUpload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          Upload any photos you'd like on your site — work photos, team shots, before/after images, your van, anything relevant. Up to 20 images.
        </p>

        {form._images.length < 20 && (
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging ? 'border-purple/60 bg-purple/5' : 'border-zinc-700 hover:border-zinc-600'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => onUpload(e.target.files)} />
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-purple border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-400">Uploading…</p>
              </div>
            ) : (
              <>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600 mx-auto mb-3">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-sm text-zinc-400 font-medium">Click to upload or drag and drop</p>
                <p className="text-[11px] text-zinc-600 mt-1">JPG, PNG, WebP · max 10MB per image · {20 - form._images.length} remaining</p>
              </>
            )}
          </div>
        )}

        {form._images.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {form._images.map((img, i) => (
              <div key={i} className="group relative">
                <img src={img.url} alt={img.label || `Image ${i + 1}`}
                  className="w-full h-24 object-cover rounded-lg border border-border" />
                <button onClick={() => onRemove(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full text-zinc-300 hover:text-red-400 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  ×
                </button>
                <input
                  className="mt-1.5 w-full bg-zinc-900 border border-border rounded px-2 py-1 text-[11px] text-zinc-400 placeholder-zinc-700 focus:outline-none focus:border-purple/40"
                  value={img.label}
                  onChange={e => onLabel(i, e.target.value)}
                  placeholder="Label (e.g. Our team)"
                />
              </div>
            ))}
          </div>
        )}

        {form._images.length === 0 && !uploading && (
          <p className="text-xs text-zinc-600 mt-3 text-center">No images uploaded yet — you can skip this step if you don't have any ready.</p>
        )}
      </div>
    </div>
  )
}

function Step6Review({ form, onEdit }) {
  const sections = [
    {
      title: 'Business Details', step: 2,
      items: [
        { label: 'Business name', value: form.business_name },
        { label: 'Tagline', value: form.tagline },
        { label: 'Primary service', value: form.primary_service },
        { label: 'Additional services', value: form.secondary_services.filter(Boolean).join(', ') },
        { label: 'Areas covered', value: form.target_areas.filter(Boolean).join(', ') },
        { label: 'Phone', value: form.contact_details.phone },
        { label: 'Email', value: form.contact_details.email },
        { label: 'Address', value: form.contact_details.address },
      ],
    },
    {
      title: 'Brand & Style', step: 3,
      items: [
        { label: 'Brand colours', value: form.brand_colours.join(', ') },
        { label: 'Logo', value: form.logo_uploaded ? '✓ Uploaded' : 'Not uploaded' },
        { label: 'Preferred fonts', value: form.preferred_fonts },
        { label: 'Reference sites', value: form.reference_sites.filter(s => s.url).map(s => s.url).join(', ') },
        { label: 'What they like', value: form.things_they_like },
        { label: 'What to avoid', value: form.things_they_dislike },
      ],
    },
    {
      title: 'Target & Goals', step: 4,
      items: [
        { label: 'Ideal customer', value: form.target_customer },
        { label: 'What makes you different', value: form.unique_selling_points },
        { label: 'Competitors', value: form.competitors.filter(Boolean).join(', ') },
        { label: 'Must include', value: form.must_include },
        { label: 'Must avoid', value: form.must_avoid },
        { label: 'Deadline', value: form.deadline_preference },
        { label: 'Additional notes', value: form.additional_notes },
      ],
    },
    {
      title: 'Images', step: 5,
      items: [{ label: 'Photos uploaded', value: form._images.length > 0 ? `${form._images.length} image${form._images.length !== 1 ? 's' : ''}` : 'None' }],
    },
  ]

  const completedSections = sections.filter(s => s.items.some(item => item.value))

  return (
    <div className="space-y-4">
      <div className="card bg-purple/5 border-purple/20 mb-2">
        <p className="text-sm text-zinc-300 leading-relaxed">
          Review your brief below. Use the edit buttons to make any changes, then hit{' '}
          <span className="font-semibold text-zinc-100">Send Brief to Blackbird</span>.
        </p>
      </div>

      {sections.map(section => (
        <div key={section.title} className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-zinc-300 uppercase tracking-wider">{section.title}</p>
            <button onClick={() => onEdit(section.step)} className="text-[11px] text-purple-light hover:text-purple transition-colors">Edit →</button>
          </div>
          <div className="space-y-2">
            {section.items.filter(item => item.value).map(item => (
              <div key={item.label} className="flex gap-3">
                <span className="text-[10px] text-zinc-600 w-28 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="text-xs text-zinc-300 leading-relaxed flex-1 break-words">{item.value}</span>
              </div>
            ))}
            {!section.items.some(item => item.value) && (
              <p className="text-xs text-zinc-700 italic">Nothing filled in yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
