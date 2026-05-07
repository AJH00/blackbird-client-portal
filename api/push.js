import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:projects@blackbird-marketing.co.uk',
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

export default async function handler(req, res) {
  // GET ?action=public-key — return the public VAPID key for client subscription
  if (req.method === 'GET') {
    const action = req.query?.action
    if (action === 'public-key') {
      return res.json({ publicKey: VAPID_PUBLIC || null })
    }
    return res.status(400).json({ error: 'Unknown action' })
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth check via Bearer token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthenticated' })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const body = req.body || {}
  const { action } = body

  // Save a new subscription for this user
  if (action === 'subscribe') {
    const { subscription } = body
    if (!subscription?.endpoint) return res.status(400).json({ error: 'subscription.endpoint required' })

    const { data: profile } = await supabase
      .from('profiles').select('client_id').eq('id', user.id).maybeSingle()

    // Upsert by endpoint (UNIQUE constraint on subscription endpoint)
    const { error: upErr } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      client_id: profile?.client_id || null,
      subscription,
    }, { onConflict: 'endpoint' })

    if (upErr) return res.status(500).json({ ok: false, error: upErr.message })

    await supabase.from('profiles').update({ push_notifications_enabled: true }).eq('id', user.id)
    return res.json({ ok: true })
  }

  // Unsubscribe (called when client wants to disable push)
  if (action === 'unsubscribe') {
    const { endpoint } = body
    if (!endpoint) return res.status(400).json({ error: 'endpoint required' })
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
    return res.json({ ok: true })
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}

// ── Helper exported for /api/notify to dispatch a push ───────────────────────
export async function dispatchPushForClient(clientId, { title, body, url, tag }) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, reason: 'VAPID keys not configured' }
  if (!clientId) return { sent: 0, reason: 'No client_id' }

  const { data: subs } = await supabase.from('push_subscriptions')
    .select('id, subscription, endpoint').eq('client_id', clientId)
  if (!subs?.length) return { sent: 0, reason: 'No subscriptions for client' }

  const payload = JSON.stringify({
    title: title || 'Blackbird Portal',
    body: body || '',
    url: url || 'https://portal.blackbird-marketing.uk',
    tag: tag || 'blackbird-portal',
  })

  let sent = 0
  const expired = []
  for (const row of subs) {
    try {
      await webpush.sendNotification(row.subscription, payload)
      sent++
    } catch (e) {
      console.error('[push] send failed:', e.statusCode, e.message)
      // 410 Gone or 404 means the subscription is dead — clean it up
      if (e.statusCode === 410 || e.statusCode === 404) expired.push(row.id)
    }
  }
  if (expired.length) {
    await supabase.from('push_subscriptions').delete().in('id', expired)
  }
  return { sent, expired: expired.length }
}
