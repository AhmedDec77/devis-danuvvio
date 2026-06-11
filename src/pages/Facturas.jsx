import { useEffect, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'
import DocumentRechnung from '../components/DocumentRechnung.jsx'

const PLAN = [
  { type: 'abschlag1', label: 'Abschlag 1', pct: 30 },
  { type: 'abschlag2', label: 'Abschlag 2', pct: 40 },
  { type: 'schluss', label: 'Schlussrechnung', pct: 30 },
]

export default function Facturas() {
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [impression, setImpression] = useState(null) // { facture, devis }

  const charger = async () => {
    const { data: d } = await supabase.from('devis').select('*').eq('statut', 'aceptado').order('cree_le', { ascending: false })
    const { data: f } = await supabase.from('factures').select('*').order('cree_le')
    setDevis(d || []); setFactures(f || [])
  }
  useEffect(() => { charger() }, [])

  const facturesDe = (devisId) => factures.filter((f) => f.devis_id === devisId)

  const generer = async (d, plan) => {
    const existantes = facturesDe(d.id)
    const baseHT = Number(d.total_ht)
    let montantHT
    if (plan.type === 'schluss') {
      const deja = existantes.filter((f) => f.type !== 'schluss').reduce((s, f) => s + Number(f.montant_ht), 0)
      montantHT = Math.round((baseHT - deja) * 100) / 100
    } else {
      montantHT = Math.round(baseHT * plan.pct) / 100
    }
    const tva = Math.round(montantHT * 19) / 100
    const { data: numero } = await supabase.rpc('prochain_numero_facture')

    // Numéro client : celui du devis, sinon on le crée maintenant
    let numClient = d.numero_client
    if (!numClient) {
      const { data } = await supabase.rpc('obtenir_numero_client', {
        p_civilite: d.client_civilite, p_prenom: d.client_prenom, p_nom: d.client_nom,
        p_adresse: d.client_adresse, p_ville: d.client_ville,
      })
      numClient = data
      await supabase.from('devis').update({ numero_client: numClient }).eq('id', d.id)
    }

    const { error } = await supabase.from('factures').insert({
      numero, devis_id: d.id, type: plan.type, pourcentage: plan.pct,
      base_ht: baseHT, montant_ht: montantHT, tva, ttc: montantHT + tva,
      numero_client: numClient,
    })
    if (error) { alert('Esta factura ya existe para este presupuesto.'); return }
    await charger()
  }

  const changerStatut = async (f, statut) => {
    await supabase.from('factures').update({ statut }).eq('id', f.id)
    charger()
  }

  const imprimer = (f, d) => {
    setImpression({ facture: f, devis: d })
    setTimeout(() => window.print(), 350)
  }

  if (impression) {
    const precedentes = factures.filter(
      (f) => f.devis_id === impression.devis.id && f.type !== 'schluss' && impression.facture.type === 'schluss'
    )
    return (
      <>
        <div className="page no-print" style={{ display: 'flex', gap: 10 }}>
          <button className="btn sec" onClick={() => setImpression(null)}>← Volver a facturas</button>
          <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <DocumentRechnung facture={impression.facture} devis={impression.devis} facturesPrecedentes={precedentes} />
      </>
    )
  }

  return (
    <div className="page">
      {devis.length === 0 && (
        <div className="carte">
          <h2>Facturas</h2>
          <p style={{ color: '#888', fontSize: 14 }}>
            Ningún presupuesto aceptado todavía. Cambia el estado de un presupuesto a
            <b> aceptado</b> en el Historial para poder generar sus 3 facturas (30 % / 40 % / 30 %).
          </p>
        </div>
      )}
      {devis.map((d) => {
        const fs = facturesDe(d.id)
        const totalFacture = fs.reduce((s, f) => s + Number(f.ttc), 0)
        return (
          <div className="carte" key={d.id}>
            <h2>KV {d.numero} — {d.client_civilite} {d.client_nom}</h2>
            <p style={{ fontSize: 13.5, color: '#555', margin: '0 0 14px' }}>
              {d.titre || 'Sin título'} · Total: <b>{fmt(d.total_ttc)} €</b>
              {d.numero_client && <> · Cliente: <b>{d.numero_client}</b></>}
              {fs.length > 0 && <> · Facturado: <b>{fmt(totalFacture)} €</b></>}
            </p>
            <table className="histo">
              <thead>
                <tr><th>Factura</th><th>%</th><th>Importe TTC</th><th>Nº</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {PLAN.map((p) => {
                  const f = fs.find((x) => x.type === p.type)
                  const montant = p.type === 'schluss' && !f
                    ? Number(d.total_ht) - fs.filter((x) => x.type !== 'schluss').reduce((s, x) => s + Number(x.montant_ht), 0)
                    : null
                  const bloqueSchluss = p.type === 'schluss' && fs.filter((x) => x.type !== 'schluss').length < 2
                  return (
                    <tr key={p.type}>
                      <td>{p.label}</td>
                      <td>{p.pct} %</td>
                      <td>{f ? <b>{fmt(f.ttc)} €</b> : montant !== null ? fmt(montant * 1.19) + ' €' : fmt(d.total_ht * p.pct / 100 * 1.19) + ' €'}</td>
                      <td>{f ? f.numero : '—'}</td>
                      <td>
                        {f ? (
                          <select value={f.statut} onChange={(e) => changerStatut(f, e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                            <option>emitida</option><option>pagada</option>
                          </select>
                        ) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {f
                          ? <button className="btn petit sec" onClick={() => imprimer(f, d)}>Ver / Imprimir</button>
                          : <button className="btn petit" disabled={bloqueSchluss}
                              title={bloqueSchluss ? 'Genera primero los 2 Abschläge' : ''}
                              onClick={() => generer(d, p)}>Generar</button>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
