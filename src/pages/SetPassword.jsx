import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SetPassword({ session, onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async e => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords don’t match.'); return }
    setSaving(true); setError('')
    const { error: updErr } = await supabase.auth.updateUser({ password })
    if (updErr) { setError(updErr.message); setSaving(false); return }
    if (session?.user?.id) {
      await supabase.from('profiles').update({ needs_password_change: false }).eq('id', session.user.id)
    }
    setSaving(false)
    onDone?.()
  }

  const skip = async () => {
    if (session?.user?.id) {
      await supabase.from('profiles').update({ needs_password_change: true }).eq('id', session.user.id)
    }
    onDone?.()
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-purple flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-100 leading-none">Blackbird</p>
            <p className="text-[10px] text-zinc-600 leading-none mt-0.5">Client Portal</p>
          </div>
        </div>

        <div className="card">
          <p className="text-lg font-bold text-zinc-100 mb-1">Welcome to your Blackbird portal</p>
          <p className="text-xs text-zinc-500 mb-6">Before we get started, please set a secure password for your account.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label block mb-1.5">New password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label block mb-1.5">Confirm password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary w-full justify-center py-2.5 text-sm mt-2">
              {saving ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>

          <button onClick={skip} type="button"
            className="block mx-auto mt-4 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
