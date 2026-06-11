import { useEffect, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'

const STATUTS = ['brouillon', 'envoyé', 'accepté', 'refusé']

export default function Historique({ onOuvrir }) {
  const [devis, setDevis] = useState([])
  const [recherche, setRecherche] = useState('')

  const charger = () =>
    supabase.from('devis').select('*').order('cree_le', { ascending: false }).then(({ data }) => setDevis(data || []))

  useEffect(() => { charger() }, [])

  const changerStatut = async (d, statut) => {
    await supabase.from('devis').update({ statut }).eq('id', d.id)
    charger()
  }

  const supprimer = async (d) => {
    if (!confirm(`¿Eliminar el presupuesto ${d.numero} (${d.client_nom})?`)) return
    await supabase.from('devis').delete().eq('id', d.id)
    charger()
  }

  const filtres = devis.filter((d) =>
    (d.client_nom + ' ' + d.numero + ' ' + (d.titre || '')).toLowerCase().includes(recherche.toLowerCase())
  )

  const totalAccepte = devis.filter((d) => d.statut === 'accepté').reduce((s, d) => s + Number(d.total_ttc), 0)

  return (
    <div className="page">
      <div className="carte">
        <h2>Historial de presupuestos</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <input style={{ maxWidth: 280 }} placeholder="Buscar cliente, número..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <span style={{ fontSize: 13, color: '#666' }}>
            {devis.length} presupuestos · aceptados: <b>{fmt(totalAccepte)} €</b>
          </span>
        </div>
        <table className="histo">
          <thead>
            <tr><th>Nº</th><th>Fecha</th><th>Cliente</th><th>Proyecto</th><th>Total TTC</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {filtres.map((d) => (
              <tr key={d.id}>
                <td>{d.numero}</td>
                <td>{new Date(d.cree_le).toLocaleDateString('de-DE')}</td>
                <td>{d.client_civilite} {d.client_nom}</td>
                <td>{d.titre}</td>
                <td><b>{fmt(d.total_ttc)} €</b></td>
                <td>
                  <select value={d.statut} onChange={(e) => changerStatut(d, e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                    {STATUTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn petit sec" onClick={() => onOuvrir(d)}>Abrir</button>{' '}
                  <button className="btn petit sec" onClick={() => supprimer(d)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtres.length === 0 && <p style={{ color: '#888', fontSize: 14 }}>Ningún presupuesto todavía.</p>}
      </div>
    </div>
  )
}
