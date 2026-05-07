import { useState } from 'react'
import { supabase } from '../lib/supabase'

const PORTAL_URL = 'https://portal.blackbird-marketing.uk'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleLogin = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleReset = async () => {
    if (!email) { setError('Enter your email above first.'); return }
    setResetting(true); setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: PORTAL_URL })
    if (error) setError(error.message)
    else setResetSent(true)
    setResetting(false)
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
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
          <p className="text-lg font-bold text-zinc-100 mb-1">Welcome back</p>
          <p className="text-xs text-zinc-500 mb-6">Sign in to view your project and submit requests</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label block mb-1.5">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label block mb-1.5">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-900/50 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5 text-sm mt-2">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>

            {resetSent ? (
              <p className="text-[11px] text-emerald-400 text-center mt-2">
                Reset email sent. Check your inbox.
              </p>
            ) : (
              <button type="button" onClick={handleReset} disabled={resetting}
                className="block mx-auto text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors mt-2 disabled:opacity-50">
                {resetting ? 'Sending reset…' : 'Forgot password?'}
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[11px] text-zinc-700 mt-6">
          Need access? Contact your account manager at Blackbird.
        </p>
      </div>
    </div>
  )
}
