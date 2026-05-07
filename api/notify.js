import { createClient } from '@supabase/supabase-js'
import { dispatchPushForClient } from './push.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const FROM = 'team@projects.blackbird-marketing.co.uk'
const FROM_NAME = 'Blackbird Marketing'
const PORTAL_URL = 'https://portal.blackbird-marketing.uk'
const PURPLE = '#7c3aed'
const BG = '#0a0a0a'
const SURFACE = '#141414'
const BORDER = '#27272a'
const TEXT = '#e4e4e7'
const MUTED = '#a1a1aa'

const STAGE_MESSAGES = {
  'Build In Progress': "We've started building your site. We'll have a first version ready for your review within the next few days.",
  'Client Review':     "Your site is ready to review! Log in to your portal to see it and submit your feedback.",
  'Revisions':         "We're working through your requested changes and will update you when they're done.",
  'Approved':          "Your site has been approved — we're preparing it to go live very soon.",
  'Live':              "Great news — your site is now live! 🎉 Log in to your portal to see it and track your progress.",
}

function escape(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function shell({ heading, paragraphs, ctaLabel }) {
  const body = paragraphs.map(p => `<p style="margin:0 0 16px;color:${TEXT};font-size:15px;line-height:1.6;">${p}</p>`).join('')
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${BG};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
      <tr><td style="padding:24px 28px;border-bottom:1px solid ${BORDER};">
        <span style="display:inline-block;font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.01em;">Blackbird</span>
        <span style="display:inline-block;font-size:11px;color:${MUTED};margin-left:8px;text-transform:uppercase;letter-spacing:0.08em;">Client Portal</span>
      </td></tr>
      <tr><td style="padding:32px 28px 8px;">
        <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#fff;line-height:1.3;">${heading}</h1>
        ${body}
      </td></tr>
      <tr><td style="padding:8px 28px 32px;">
        <a href="${PORTAL_URL}" style="display:inline-block;background:${PURPLE};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel}</a>
      </td></tr>
      <tr><td style="padding:20px 28px;border-top:1px solid ${BORDER};">
        <p style="margin:0;font-size:12px;color:${MUTED};line-height:1.5;">
          The Blackbird Team<br>
          <a href="${PORTAL_URL}" style="color:${MUTED};text-decoration:underline;">${PORTAL_URL.replace('https://', '')}</a>
        </p>
        <p style="margin:12px 0 0;font-size:11px;color:#6b6b73;line-height:1.5;">
          Please do not reply to this email.<br>
          Log in to your portal to respond: <a href="${PORTAL_URL}" style="color:#6b6b73;text-decoration:underline;">${PORTAL_URL.replace('https://', '')}</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function projectUpdateEmail({ clientName, author, content }) {
  const snippet = (content || '').slice(0, 200)
  return {
    subject: 'Update on your Blackbird project',
    html: shell({
      heading: 'Update on your project',
      paragraphs: [
        `Hi ${escape(clientName || 'there')},`,
        `<strong style="color:#fff;">${escape(author || 'The Blackbird Team')}</strong> has posted an update on your project.`,
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${PURPLE};background:#1a1a1a;border-radius:4px;color:${TEXT};font-style:italic;">"${escape(snippet)}${content && content.length > 200 ? '…' : ''}"</span>`,
        'Log in to your portal to read the full update and check your project progress.',
      ],
      ctaLabel: 'View your project',
    }),
  }
}

function requestReplyEmail({ clientName, requestTitle }) {
  return {
    subject: `New reply on your request: ${requestTitle || 'your request'}`,
    html: shell({
      heading: 'New reply on your request',
      paragraphs: [
        `Hi ${escape(clientName || 'there')},`,
        `We've replied to your request: <strong style="color:#fff;">${escape(requestTitle || 'your request')}</strong>`,
        'Log in to your portal to read the reply and respond if needed.',
      ],
      ctaLabel: 'View the message',
    }),
  }
}

function stageChangeEmail({ clientName, newStage }) {
  const message = STAGE_MESSAGES[newStage] || `Your project has moved to: ${newStage}`
  return {
    subject: 'Your Blackbird project has been updated',
    html: shell({
      heading: 'Your project has been updated',
      paragraphs: [
        `Hi ${escape(clientName || 'there')},`,
        'Your project has moved to a new stage.',
        `<span style="display:block;padding:14px 16px;border-left:3px solid ${PURPLE};background:#1a1a1a;border-radius:4px;color:${TEXT};">${escape(message)}</span>`,
      ],
      ctaLabel: 'Check your project',
    }),
  }
}

async function lookupClientEmail(clientId) {
  // Step 1: profile with role='client' linked to this client_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('client_id', clientId)
    .eq('role', 'client')
    .maybeSingle()

  let email = profile?.email || null
  let name = profile?.name || null

  // Step 2: if profiles.email is missing, try auth.users via admin API
  if (!email && profile?.id) {
    try {
      const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)
      email = user?.email || null
    } catch (_) {}
  }

  // Step 3: fallback to clients.email
  const { data: clientRow } = await supabase
    .from('clients')
    .select('name, email')
    .eq('id', clientId)
    .maybeSingle()

  if (!email) email = clientRow?.email || null
  if (!name)  name  = clientRow?.name || null

  return { email, name, clientName: clientRow?.name || name }
}

async function sendEmail({ to, subject, html }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM}>`,
      to: [to],
      subject,
      html,
    }),
  })
  const text = await r.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch {}
  if (!r.ok) {
    return { ok: false, status: r.status, error: body?.message || text || `HTTP ${r.status}` }
  }
  return { ok: true, email_id: body?.id || null }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' })

  try {
    const { type, client_id, payload } = req.body || {}
    if (!type || !client_id) {
      return res.status(400).json({ ok: false, error: 'type and client_id required' })
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, error: 'RESEND_API_KEY not configured' })
    }

    const { email, clientName } = await lookupClientEmail(client_id)
    if (!email) {
      console.warn('[notify] no email found for client', client_id, 'type', type)
      return res.json({ ok: false, error: 'No email on file for this client', client_id })
    }

    let template
    if (type === 'project_update') {
      template = projectUpdateEmail({
        clientName,
        author: payload?.author,
        content: payload?.content,
      })
    } else if (type === 'request_reply') {
      // Look up the request title for the subject
      let requestTitle = null
      if (payload?.request_id) {
        const { data: r } = await supabase.from('client_requests').select('title').eq('id', payload.request_id).maybeSingle()
        requestTitle = r?.title || null
      }
      template = requestReplyEmail({ clientName, requestTitle })
    } else if (type === 'stage_change') {
      template = stageChangeEmail({ clientName, newStage: payload?.new_stage })
    } else {
      return res.status(400).json({ ok: false, error: `Unknown type: ${type}` })
    }

    const result = await sendEmail({ to: email, subject: template.subject, html: template.html })
    if (!result.ok) {
      console.error('[notify] resend failed', result)
      return res.json({ ok: false, error: result.error, status: result.status })
    }

    // Also fire a browser push to any subscribed devices for this client (best-effort, never blocks)
    let pushResult = null
    try {
      const pushPayload = (() => {
        if (type === 'project_update') {
          return {
            title: 'Blackbird — project update',
            body: `${payload?.author || 'The Blackbird Team'}: ${(payload?.content || '').slice(0, 120)}`,
            tag: 'project_update',
          }
        }
        if (type === 'request_reply') {
          return {
            title: 'Blackbird — new reply',
            body: `New reply on your request${payload?.message_preview ? `: ${payload.message_preview.slice(0, 120)}` : ''}`,
            tag: 'request_reply',
          }
        }
        // stage_change is intentionally not pushed (already a softer email)
        return null
      })()
      if (pushPayload) {
        pushResult = await dispatchPushForClient(client_id, pushPayload)
      }
    } catch (pushErr) {
      console.error('[notify] push dispatch threw:', pushErr?.message)
    }

    console.log('[notify] sent', { type, client_id, to: email, email_id: result.email_id, push: pushResult })
    return res.json({ ok: true, email_id: result.email_id, to: email, push: pushResult })
  } catch (err) {
    console.error('[notify] unexpected', err)
    // Always return gracefully — never throw from a webhook
    return res.json({ ok: false, error: err?.message || 'Unexpected error' })
  }
}
