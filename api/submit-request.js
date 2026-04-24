import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const NOTION_TOKEN = process.env.NOTION_TOKEN
const NOTION_DB_ID = process.env.NOTION_PROJECTS_DB_ID

const ASSIGNEES = {
  website_change:   'Gabriel',
  listing_add:      'Gabriel',
  listing_remove:   'Gabriel',
  content_feedback: 'Tayla',
  billing:          'Adin',
  question:         'Adin',
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthenticated' })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: profile } = await supabase.from('profiles').select('client_id').eq('id', user.id).single()
  if (!profile?.client_id) return res.status(403).json({ error: 'No client account linked' })

  const { client_id, type, title, description, page_url, priority, attachments } = req.body
  if (profile.client_id !== client_id) return res.status(403).json({ error: 'Forbidden' })

  const VALID_TYPES = ['website_change', 'content_feedback', 'billing', 'question', 'listing_add', 'listing_remove']
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' })
  if (!title?.trim() || !description?.trim()) return res.status(400).json({ error: 'Title and description required' })
  if (description.trim().length < 50) return res.status(400).json({ error: 'Description too short' })

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

  // Insert request
  const { data: request, error: insertErr } = await supabase.from('client_requests').insert({
    client_id, type, title: title.trim(), description: description.trim(),
    page_url: page_url || null, priority: priority || 'normal', status: 'open',
    attachments: Array.isArray(attachments) && attachments.length ? attachments : null,
  }).select().single()
  if (insertErr) return res.status(500).json({ error: insertErr.message })

  // Create task
  const { data: client } = await supabase.from('clients').select('name').eq('id', client_id).single()
  const refLabel = ['listing_add', 'listing_remove'].includes(type) ? 'Address' : 'Page'
  const attachNote = Array.isArray(attachments) && attachments.length
    ? `\n\nAttachments:\n${attachments.join('\n')}` : ''
  await supabase.from('tasks').insert({
    text: `[${client?.name}] ${title.trim()}`,
    assignee: ASSIGNEES[type] || 'Adin',
    priority: priority === 'urgent' ? 'High' : 'Medium',
    status: 'Todo',
    description: `${description.trim()}${page_url ? `\n\n${refLabel}: ${page_url}` : ''}${attachNote}`,
    client_id,
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

  res.status(201).json({ request })
}
