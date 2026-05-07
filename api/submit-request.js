import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB_ID = process.env.NOTION_PROJECTS_DB_ID

const ASSIGNEES = {
  website_change:    'Gabriel',
  listing_add:       'Gabriel',
  listing_remove:    'Gabriel',
  content_feedback:  'Gabriel',
  revision_request:  'Gabriel',
  feature_request:   'Gabriel',
  domain_technical:  'Adin',
  billing:           'Adin',
  question:          'Rob',
}

const PROACTIVE_COMMS_PROBLEM_ID = '8e08c7ee-ebed-4d91-b23a-4d6a70e1e06d'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthenticated' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()
  if (!profile?.client_id) return res.status(403).json({ error: 'No client account linked' })

  // ── Cancel + refund flow ────────────────────────────────────────────────
  if (req.body?.action === 'cancel') {
    const { request_id } = req.body
    if (!request_id) return res.status(400).json({ error: 'request_id required' })

    const { data: request, error: fetchErr } = await supabase.from('client_requests')
      .select('id, client_id, status, credit_cost, credits_deducted')
      .eq('id', request_id).maybeSingle()
    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' })
    if (request.client_id !== profile.client_id) return res.status(403).json({ error: 'Forbidden' })
    if (request.status !== 'open') {
      return res.status(409).json({ error: `Cannot cancel — request is ${request.status}. Only Open requests can be cancelled.` })
    }

    let refunded = 0
    let updatedCredits = null
    if (request.credits_deducted && request.credit_cost > 0) {
      const { data: c } = await supabase.from('clients').select('revision_credits, revision_credits_used').eq('id', profile.client_id).single()
      const nextUsed = Math.max(0, (c?.revision_credits_used ?? 0) - request.credit_cost)
      const { data: cAfter } = await supabase.from('clients').update({
        revision_credits_used: nextUsed,
      }).eq('id', profile.client_id).select('revision_credits, revision_credits_used').single()
      if (cAfter) {
        refunded = request.credit_cost
        updatedCredits = cAfter
      }
    }

    await supabase.from('client_requests').update({
      status: 'cancelled', credits_deducted: false, resolved_at: new Date().toISOString(),
    }).eq('id', request_id)

    return res.json({ ok: true, request_id, refunded, credits: updatedCredits })
  }

  const { client_id, type, title, description, page_url, priority, attachments, paid_revision, credit_cost, request_type, current_state, desired_state, reference_url } = req.body
  if (profile.client_id !== client_id) return res.status(403).json({ error: 'Forbidden' })

  const VALID_TYPES = ['website_change', 'content_feedback', 'billing', 'question', 'listing_add', 'listing_remove', 'revision_request', 'domain_technical', 'feature_request']
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' })
  if (!title?.trim()) return res.status(400).json({ error: 'Title required' })
  // Structured form: require current + desired for change-type requests, otherwise require description
  const isStructured = ['website_change', 'revision_request', 'feature_request'].includes(type)
  if (isStructured) {
    if (!current_state?.trim() || current_state.trim().length < 30) return res.status(400).json({ error: 'Current state must be at least 30 characters' })
    if (!desired_state?.trim() || desired_state.trim().length < 30) return res.status(400).json({ error: 'Desired state must be at least 30 characters' })
  } else if (type === 'content_feedback') {
    if (!description?.trim() || description.trim().length < 30) return res.status(400).json({ error: 'Please tell us what needs changing (min 30 chars)' })
  } else {
    if (!description?.trim() || description.trim().length < 30) return res.status(400).json({ error: 'Description too short (min 30 chars)' })
  }

  // Rate limit: one open per type
  const { data: existing } = await supabase.from('client_requests')
    .select('id').eq('client_id', client_id).eq('type', type).neq('status', 'done').limit(1)
  if (existing?.length) return res.status(409).json({ error: 'You already have an open request of this type.' })

  // Urgent: once per month
  if (priority === 'urgent') {
    const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0)
    const { data: urgentThisMonth } = await supabase.from('client_requests')
      .select('id').eq('client_id', client_id).eq('priority', 'urgent')
      .gte('created_at', startOfMonth.toISOString()).limit(1)
    if (urgentThisMonth?.length) return res.status(429).json({ error: 'Urgent limit reached for this month.' })
  }

  // Compose description from structured fields if applicable
  const composedDesc = isStructured
    ? [current_state ? `CURRENT STATE:\n${current_state.trim()}` : null,
       desired_state ? `\nDESIRED STATE:\n${desired_state.trim()}` : null,
       reference_url ? `\nREFERENCE: ${reference_url}` : null,
       description?.trim() ? `\nADDITIONAL CONTEXT:\n${description.trim()}` : null,
      ].filter(Boolean).join('\n')
    : (description?.trim() || '')

  // Insert request
  const { data: request, error: insertErr } = await supabase.from('client_requests').insert({
    client_id, type, title: title.trim(), description: composedDesc,
    page_url: page_url || null, priority: priority || 'normal', status: 'open',
    attachments: Array.isArray(attachments) && attachments.length ? attachments : null,
    is_paid_revision: paid_revision === true,
    credit_cost: credit_cost || null,
    request_type: request_type || null,
    current_state: current_state?.trim() || null,
    desired_state: desired_state?.trim() || null,
    reference_url: reference_url?.trim() || null,
    assigned_to: ASSIGNEES[type] || null,
  }).select().single()
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  // Deduct credits immediately if applicable.
  // Model: revision_credits = lifetime allocation cap, revision_credits_used = counter.
  // Available = revision_credits - revision_credits_used. Only increment used.
  let updatedCredits = null
  if (credit_cost && credit_cost > 0) {
    const { data: c } = await supabase.from('clients').select('revision_credits, revision_credits_used').eq('id', client_id).single()
    const nextUsed = (c?.revision_credits_used ?? 0) + credit_cost
    const { data: cAfter } = await supabase.from('clients').update({
      revision_credits_used: nextUsed,
    }).eq('id', client_id).select('revision_credits, revision_credits_used').single()
    if (cAfter) {
      updatedCredits = cAfter
      await supabase.from('client_requests').update({ credits_deducted: true }).eq('id', request.id)
    }
  }

  // Create task
  const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).single()
  const paidNote = paid_revision === true ? ' [PAID REVISION — invoice £75]' : ''
  const refLabel = ['listing_add', 'listing_remove'].includes(type) ? 'Address' : 'Page'
  const attachNote = Array.isArray(attachments) && attachments.length
    ? `\n\nAttachments:\n${attachments.join('\n')}` : ''
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('tasks').insert({
    text: `New portal request from ${client?.name || 'Client'}: ${title.trim()}${paidNote}`,
    assignee: ASSIGNEES[type] || 'Adin',
    priority: priority === 'urgent' ? 'High' : 'High',
    status: 'todo',
    done: false,
    due_date: today,
    project: 'Client Results',
    category: 'Client',
    description: `${composedDesc}${page_url ? `\n\n${refLabel}: ${page_url}` : ''}${attachNote}`,
    client_id,
    problem_id: PROACTIVE_COMMS_PROBLEM_ID,
  })

  // Notion — for website changes and listing additions
  if (['website_change', 'listing_add'].includes(type) && NOTION_TOKEN && NOTION_DB_ID) {
    await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: NOTION_DB_ID },
        properties: {
          'Project name': { title: [{ text: { content: `${client?.name || 'Client'} — ${title.trim()}` } }] },
          'Status': { status: { name: 'Awaiting Client Brief' } },
          'Client Updates': { rich_text: [{ text: { content: description.trim().slice(0, 2000) } }] },
        },
      }),
    }).catch(() => {})
  }

  res.status(201).json({ request, credits: updatedCredits })
}
