import { useEffect, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'

export default function Clientes({ onNouveauDevis }) {
  const [clients, setClients] = useState([])
  const [recherche, setRecherche] = useState('')
  const [edition, setEdition] = useState(null) // client en cours d'édition
  const [sauve, setSauve] = useState(null)

  const charger = () =>
    supabase.from('clients').select('*').order('nom').then(({ data }) => setClients(data || []))
  useEffect(() => { charger() }, [])

  const enregistrer = async () => {
    const c = edition
    await supabase.from('clients').update({
      civilite: c.civilite, prenom: c.prenom, nom: c.nom, adresse: c.adresse, ville: c.ville,
    }).eq('id', c.id)
    setSauve(c.id); setEdition(null)
    setTimeout(() => setSauve(null), 1500)
    charger()
  }

  const filtres = clients.filter((c) =>
    (c.numero + ' ' + (c.prenom || '') + ' ' + c.nom + ' ' + (c.adresse || '') + ' ' + (c.ville || ''))
      .toLowerCase().includes(recherche.toLowerCase())
  )

  const volumeTotal = clients.reduce((s, c) => s + Number(c.volume_historique || 0), 0)

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="carte">
        <h2>Base de clientes</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ maxWidth: 300 }} placeholder="Buscar nombre, dirección, KD-..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <span style={{ fontSize: 13, color: '#666' }}>
            <b>{clients.length}</b> clientes · volumen histórico 2017–2026: <b>{fmt(volumeTotal)} €</b>
          </span>
        </div>
        <table className="histo">
          <thead>
            <tr><th>Nº</th><th>Cliente</th><th>Dirección</th><th>Ciudad</th><th>Docs</th><th>Volumen €</th><th>Años</th><th></th></tr>
          </thead>
          <tbody>
            {filtres.map((c) => (
              edition?.id === c.id ? (
                <tr key={c.id} style={{ background: '#fdf7f2' }}>
                  <td>{c.numero}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <select value={edition.civilite || ''} onChange={(e) => setEdition({ ...edition, civilite: e.target.value })} style={{ width: 80 }}>
                      <option value="">—</option><option>Frau</option><option>Herr</option><option>Familie</option><option>Firma</option>
                    </select>
                    <input value={edition.prenom || ''} placeholder="Nombre" onChange={(e) => setEdition({ ...edition, prenom: e.target.value })} style={{ width: 110 }} />
                    <input value={edition.nom} placeholder="Apellido" onChange={(e) => setEdition({ ...edition, nom: e.target.value })} />
                  </td>
                  <td><input value={edition.adresse || ''} onChange={(e) => setEdition({ ...edition, adresse: e.target.value })} /></td>
                  <td><input value={edition.ville || ''} onChange={(e) => setEdition({ ...edition, ville: e.target.value })} style={{ width: 130 }} /></td>
                  <td colSpan="3"></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn petit" onClick={enregistrer}>Guardar</button>{' '}
                    <button className="btn petit sec" onClick={() => setEdition(null)}>✕</button>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{c.numero}</td>
                  <td>{c.civilite} {c.prenom} <b>{c.nom}</b></td>
                  <td>{c.adresse}</td>
                  <td>{c.ville}</td>
                  <td>{c.nb_docs_historique || ''}</td>
                  <td>{c.volume_historique ? fmt(c.volume_historique) : ''}</td>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#888' }}>
                    {c.premiere_annee ? (c.premiere_annee === c.derniere_annee ? c.premiere_annee : `${c.premiere_annee}–${c.derniere_annee}`) : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn petit" onClick={() => onNouveauDevis(c)}>+ Presupuesto</button>{' '}
                    <button className="btn petit sec" onClick={() => setEdition({ ...c })}>{sauve === c.id ? '✓' : 'Editar'}</button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
        {filtres.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Ningún cliente encontrado.</p>}
        <p style={{ fontSize: 12, color: '#999', marginTop: 14 }}>
          Base importada de 330 presupuestos y facturas 2017–2026. El volumen es indicativo (suma de los documentos
          encontrados, presupuestos y facturas mezclados). Los nuevos clientes se crean automáticamente al guardar un presupuesto.
        </p>
      </div>
    </div>
  )
}
