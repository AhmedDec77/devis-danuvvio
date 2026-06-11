import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Logo from './components/Logo.jsx'
import NouveauDevis from './pages/NouveauDevis.jsx'
import Historique from './pages/Historique.jsx'
import Catalogue from './pages/Catalogue.jsx'
import Facturas from './pages/Facturas.jsx'
import Clientes from './pages/Clientes.jsx'

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
      <div className="bande-toit no-print" />
      <header className="topbar no-print">
        <div className="marque">
          <Logo width={118} />
          <span className="app-nom">Presupuestos</span>
        </div>
        <nav>
          <button className={page === 'nouveau' ? 'actif' : ''} onClick={() => { setDevisACharger(null); setPage('nouveau') }}>+ Nuevo presupuesto</button>
          <button className={page === 'historique' ? 'actif' : ''} onClick={() => setPage('historique')}>Historial</button>
          <button className={page === 'facturas' ? 'actif' : ''} onClick={() => setPage('facturas')}>Facturas</button>
          <button className={page === 'clientes' ? 'actif' : ''} onClick={() => setPage('clientes')}>Clientes</button>
          <button className={page === 'catalogue' ? 'actif' : ''} onClick={() => setPage('catalogue')}>Precios</button>
        </nav>
        <div className="droite">
          {session.user.email}
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      {page === 'nouveau' && <NouveauDevis devisExistant={devisACharger} />}
      {page === 'historique' && <Historique onOuvrir={ouvrirDevis} />}
      {page === 'facturas' && <Facturas />}
      {page === 'clientes' && <Clientes />}
      {page === 'catalogue' && <Catalogue />}
    </>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)

  const connecter = async () => {
    setErreur(''); setChargement(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: mdp })
    setChargement(false)
    if (error) setErreur('Email o contraseña incorrectos')
  }

  return (
    <div className="login-fond">
      <div className="login">
        <div className="carte">
          <Logo width={190} />
          <h2>Presupuestos y facturas</h2>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
          <label style={{ marginTop: 12 }}>Contraseña</label>
          <input value={mdp} onChange={(e) => setMdp(e.target.value)} type="password" autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && connecter()} />
          {erreur && <p className="erreur">{erreur}</p>}
          <button className="btn" style={{ marginTop: 18, width: '100%' }} onClick={connecter} disabled={chargement}>
            {chargement ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
        <div className="pied-login">Handwerker Crispin München · Rudolfstraße 11 · 82152 Planegg</div>
      </div>
      <div className="bande-toit" style={{ position: 'fixed', top: 0, left: 0, right: 0 }} />
    </div>
  )
}
