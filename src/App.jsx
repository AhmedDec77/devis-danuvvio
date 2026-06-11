import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import NouveauDevis from './pages/NouveauDevis.jsx'
import Historique from './pages/Historique.jsx'
import Catalogue from './pages/Catalogue.jsx'

export default function App() {
  const [session, setSession] = useState(null)
  const [page, setPage] = useState('nouveau')
  const [devisACharger, setDevisACharger] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!session) return <Login />

  const ouvrirDevis = (d) => { setDevisACharger(d); setPage('nouveau') }

  return (
    <>
      <header className="topbar no-print">
        <h1>Presupuestos — Handwerker Crispin</h1>
        <nav>
          <button className={page === 'nouveau' ? 'actif' : ''} onClick={() => { setDevisACharger(null); setPage('nouveau') }}>+ Nuevo presupuesto</button>
          <button className={page === 'historique' ? 'actif' : ''} onClick={() => setPage('historique')}>Historial</button>
          <button className={page === 'catalogue' ? 'actif' : ''} onClick={() => setPage('catalogue')}>Precios</button>
        </nav>
        <div className="droite">
          {session.user.email}
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      {page === 'nouveau' && <NouveauDevis devisExistant={devisACharger} />}
      {page === 'historique' && <Historique onOuvrir={ouvrirDevis} />}
      {page === 'catalogue' && <Catalogue />}
    </>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')

  const connecter = async () => {
    setErreur('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp })
    if (error) setErreur('Email o contraseña incorrectos')
  }

  return (
    <div className="login carte">
      <h2>Iniciar sesión</h2>
      <label>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
      <label style={{ marginTop: 10 }}>Contraseña</label>
      <input value={mdp} onChange={(e) => setMdp(e.target.value)} type="password"
        onKeyDown={(e) => e.key === 'Enter' && connecter()} />
      {erreur && <p style={{ color: '#c00000', fontSize: 13 }}>{erreur}</p>}
      <button className="btn" style={{ marginTop: 14, width: '100%' }} onClick={connecter}>Entrar</button>
    </div>
  )
}
