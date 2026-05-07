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

  useEffect(() => {
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

  return <Portal session={session} />
}
