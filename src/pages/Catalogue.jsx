import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Catalogue() {
  const [prestations, setPrestations] = useState([])
  const [sauve, setSauve] = useState(null)

  useEffect(() => {
    supabase.from('prestations').select('*').order('categorie').then(({ data }) => setPrestations(data || []))
  }, [])

  const maj = (id, champ, val) =>
    setPrestations(prestations.map((p) => (p.id === id ? { ...p, [champ]: val } : p)))

  const enregistrer = async (p) => {
    const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    await supabase.from('prestations').update({
      nom: p.nom, prix_bas: num(p.prix_bas), prix_median: num(p.prix_median), prix_haut: num(p.prix_haut), actif: p.actif,
    }).eq('id', p.id)
    setSauve(p.id)
    setTimeout(() => setSauve(null), 1500)
  }

  let derniere = null
  return (
    <div className="page">
      <div className="carte">
        <h2>Catálogo de precios</h2>
        <p style={{ fontSize: 13, color: '#666' }}>
          Precios calculados sobre los trabajos de los últimos 2 años (2025–2026). Los campos vacíos («a definir») corresponden a trabajos no realizados recientemente: revisa el precio antes de usarlos.
        </p>
        <table className="histo">
          <thead><tr><th>Trabajo</th><th>Bajo €</th><th>Medio €</th><th>Alto €</th><th>Activo</th><th></th></tr></thead>
          <tbody>
            {prestations.map((p) => {
              const nouvelle = p.categorie !== derniere
              derniere = p.categorie
              return (
                <FragmentLigne key={p.id} p={p} nouvelle={nouvelle} maj={maj} enregistrer={enregistrer} sauve={sauve === p.id} />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentLigne({ p, nouvelle, maj, enregistrer, sauve }) {
  return (
    <>
      {nouvelle && (
        <tr><td colSpan="6" style={{ background: '#f3f3f3', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' }}>{p.categorie}</td></tr>
      )}
      <tr>
        <td><input value={p.nom} onChange={(e) => maj(p.id, 'nom', e.target.value)} style={{ fontSize: 13 }} /></td>
        {['prix_bas', 'prix_median', 'prix_haut'].map((c) => (
          <td key={c} style={{ width: 90 }}>
            <input type="number" value={p[c] ?? ''} placeholder="a definir" onChange={(e) => maj(p.id, c, e.target.value)} />
          </td>
        ))}
        <td style={{ textAlign: 'center' }}>
          <input type="checkbox" checked={p.actif} onChange={(e) => maj(p.id, 'actif', e.target.checked)} style={{ width: 'auto' }} />
        </td>
        <td><button className="btn petit" onClick={() => enregistrer(p)}>{sauve ? '✓' : 'Guardar'}</button></td>
      </tr>
    </>
  )
}
