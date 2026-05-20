import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Portal from './pages/Portal'
import SetPassword from './pages/SetPassword'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [passwordPromptDone, setPasswordPromptDone] = useState(false)
  const [adminView, setAdminView] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [adminViewClientName, setAdminViewClientName] = useState('')

  useEffect(() => {
    // Detect ?admin_view=true once on mount, persist via sessionStorage so it
    // survives the magic-link redirect chain after the URL param drops.
    try {
      const params = new URLSearchParams(window.location.search)
      const fromQuery = params.get('admin_view') === 'true'
      const stored = sessionStorage.getItem('bb_admin_view') === 'true'
      if (fromQuery) {
        sessionStorage.setItem('bb_admin_view', 'true')
        setAdminView(true)
        const url = new URL(window.location.href)
        url.searchParams.delete('admin_view')
        window.history.replaceState({}, '', url.toString())
      } else if (stored) {
        setAdminView(true)
      }
    } catch {}

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (!session) setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
      setPasswordPromptDone(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  // RECONSTRUCTED — verify this. Original WIP set adminViewClientName from a
  // source I never observed. Most likely from a second URL param (eg ?client=)
  // or from the impersonated session's profile row. Wiring it to the profile
  // name once the session loads is the safest default until you confirm intent.
  useEffect(() => {
    if (!adminView) return
    if (!session?.user?.id) return
    supabase.from('profiles').select('name, display_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { setAdminViewClientName(data?.display_name || data?.name || '') })
  }, [adminView, session?.user?.id])

  // RECONSTRUCTED — verify this. Original WIP almost certainly had an "Exit
  // admin view" action; this is the minimal version that clears the persisted
  // flag and reloads back to a normal client view.
  const exitAdminView = () => {
    try { sessionStorage.removeItem('bb_admin_view') } catch {}
    setAdminView(false)
    window.location.replace(window.location.pathname)
  }

  useEffect(() => {
    if (!session?.user?.id) { setProfile(null); return }
    supabase.from('profiles').select('needs_password_change').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => { setProfile(data || {}); setLoading(false) })
  }, [session?.user?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-purple border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Login />

  if (profile?.needs_password_change && !passwordPromptDone) {
    return <SetPassword session={session} onDone={() => setPasswordPromptDone(true)} />
  }

  return (
    <>
      {/* RECONSTRUCTED — verify this. Banner shape and styling were not in the
          diff I observed. Confirms admin_view is active, supports dismiss
          (visual only) and exit (clears the flag and reloads). Style to match
          your existing portal banner conventions. */}
      {adminView && !bannerDismissed && (
        <div className="bg-amber-600 text-black text-sm px-4 py-2 flex items-center justify-between gap-3">
          <span>
            Admin view{adminViewClientName ? ` — ${adminViewClientName}` : ''}. You are viewing this portal as a client.
          </span>
          <div className="flex items-center gap-2">
            <button onClick={exitAdminView} className="underline font-semibold">
              Exit admin view
            </button>
            <button onClick={() => setBannerDismissed(true)} className="text-black/60 hover:text-black" aria-label="Dismiss">
              ✕
            </button>
          </div>
        </div>
      )}
      <Portal session={session} />
    </>
  )
}
