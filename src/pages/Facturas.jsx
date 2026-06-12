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
  const [nachtraege, setNachtraege] = useState([])
  const [impression, setImpression] = useState(null)
  const [formNachtrag, setFormNachtrag] = useState({})
  const [montants, setMontants] = useState({})

  const charger = async () => {
    const { data: d } = await supabase.from('devis').select('*').eq('statut', 'aceptado').order('cree_le', { ascending: false })
    const { data: f } = await supabase.from('factures').select('*').order('cree_le')
    const { data: n } = await supabase.from('nachtraege').select('*').order('numero')
    setDevis(d || []); setFactures(f || []); setNachtraege(n || [])
  }
  useEffect(() => { charger() }, [])

  const facturesDe = (id) => factures.filter((f) => f.devis_id === id)
  const nachtraegeDe = (id) => nachtraege.filter((n) => n.devis_id === id)
  const totalActuel = (d) => Number(d.total_ht) + nachtraegeDe(d.id).reduce((s, n) => s + Number(n.montant_ht), 0)

  const ajouterNachtrag = async (d) => {
    const f = formNachtrag[d.id]
    if (!f?.description?.trim() || !f?.montant) return
    const num = nachtraegeDe(d.id).length + 1
    await supabase.from('nachtraege').insert({
      devis_id: d.id, numero: num, description: f.description.trim(), montant_ht: Number(f.montant),
    })
    setFormNachtrag({ ...formNachtrag, [d.id]: { description: '', montant: '' } })
    charger()
  }

  const supprimerNachtrag = async (n, d) => {
    if (facturesDe(d.id).some((f) => f.type === 'schluss')) {
      alert('La Schlussrechnung ya está generada — no se puede modificar el importe del proyecto.'); return
    }
    if (!confirm(`¿Eliminar la modificación N${n.numero}?`)) return
    await supabase.from('nachtraege').delete().eq('id', n.id)
    charger()
  }

  const montantPropose = (d, plan) => {
    const fs = facturesDe(d.id)
    const base = totalActuel(d)
    if (plan.type === 'schluss') {
      const deja = fs.filter((f) => f.type !== 'schluss').reduce((s, f) => s + Number(f.montant_ht), 0)
      return Math.round((base - deja) * 100) / 100
    }
    return Math.round(base * plan.pct) / 100
  }

  const generer = async (d, plan) => {
    const cle = `${d.id}:${plan.type}`
    const propose = montantPropose(d, plan)
    const saisi = montants[cle] !== undefined && montants[cle] !== '' ? Number(montants[cle]) : propose
    const ajuste = Math.abs(saisi - propose) > 0.01
    const tva = Math.round(saisi * 19) / 100
    const { data: numero } = await supabase.rpc('prochain_numero_facture')

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
      base_ht: totalActuel(d), montant_ht: saisi, tva, ttc: saisi + tva,
      numero_client: numClient, ajuste_manuellement: ajuste,
    })
    if (error) { alert('Esta factura ya existe para este presupuesto.'); return }
    await charger()
  }

  const changerStatut = async (f, statut) => {
    await supabase.from('factures').update({ statut }).eq('id', f.id)
    charger()
  }

  const supprimerFacture = async (f) => {
    if (!confirm(`¿Eliminar la factura ${f.numero}? (solo si no fue enviada al cliente)`)) return
    await supabase.from('factures').delete().eq('id', f.id)
    charger()
  }

  const imprimer = (f, d) => {
    setImpression({ facture: f, devis: d })
    setTimeout(() => window.print(), 350)
  }

  if (impression) {
    const precedentes = impression.facture.type === 'schluss'
      ? factures.filter((f) => f.devis_id === impression.devis.id && f.type !== 'schluss')
      : []
    return (
      <>
        <div className="page no-print" style={{ display: 'flex', gap: 10 }}>
          <button className="btn sec" onClick={() => setImpression(null)}>← Volver a facturas</button>
          <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <DocumentRechnung facture={impression.facture} devis={impression.devis}
          facturesPrecedentes={precedentes} nachtraege={nachtraegeDe(impression.devis.id)} />
      </>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1060 }}>
      {devis.length === 0 && (
        <div className="carte">
          <h2>Facturas</h2>
          <p style={{ color: '#888', fontSize: 14 }}>
            Ningún presupuesto aceptado todavía. Cambia el estado de un presupuesto a
            <b> aceptado</b> en el Historial para poder generar sus facturas.
          </p>
        </div>
      )}
      {devis.map((d) => {
        const fs = facturesDe(d.id)
        const ns = nachtraegeDe(d.id)
        const actuel = totalActuel(d)
        const fN = formNachtrag[d.id] || { description: '', montant: '' }
        const schlussFaite = fs.some((f) => f.type === 'schluss')
        return (
          <div className="carte" key={d.id}>
            <h2>KV {d.numero} — {d.client_civilite} {d.client_nom}</h2>
            <p style={{ fontSize: 13.5, color: '#555', margin: '0 0 14px' }}>
              {d.titre || 'Sin título'}
              {d.numero_client && <> · Cliente: <b>{d.numero_client}</b></>}
              <br />
              KV inicial: <b>{fmt(d.total_ht)} € HT</b>
              {ns.length > 0 && <> · Modificaciones: <b style={{ color: Number(actuel - d.total_ht) >= 0 ? '#1a6b1a' : '#c00000' }}>
                {actuel - d.total_ht >= 0 ? '+' : ''}{fmt(actuel - d.total_ht)} €</b></>}
              {' '}· <span style={{ color: 'var(--rouge)' }}>Importe actual: <b>{fmt(actuel)} € HT ({fmt(actuel * 1.19)} € TTC)</b></span>
            </p>

            <div style={{ background: '#faf8f5', border: '1px solid #e8e4de', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#6d6d6d', marginBottom: 8 }}>
                Modificaciones del proyecto (Nachträge)
              </div>
              {ns.map((n) => (
                <div key={n.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, padding: '4px 0' }}>
                  <b style={{ width: 30 }}>N{n.numero}</b>
                  <span style={{ flex: 1 }}>{n.description}</span>
                  <b style={{ color: Number(n.montant_ht) >= 0 ? '#1a6b1a' : '#c00000', whiteSpace: 'nowrap' }}>
                    {Number(n.montant_ht) >= 0 ? '+' : ''}{fmt(n.montant_ht)} €
                  </b>
                  {!schlussFaite && <button className="suppr" style={{ paddingTop: 0 }} onClick={() => supprimerNachtrag(n, d)}>✕</button>}
                </div>
              ))}
              {!schlussFaite ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input style={{ flex: 1 }} placeholder="Descripción (ej: Zusätzliche Steckdosen Küche / Entfall Teppich)"
                    value={fN.description} onChange={(e) => setFormNachtrag({ ...formNachtrag, [d.id]: { ...fN, description: e.target.value } })} />
                  <input type="number" step="10" style={{ width: 130 }} placeholder="± € HT"
                    value={fN.montant} onChange={(e) => setFormNachtrag({ ...formNachtrag, [d.id]: { ...fN, montant: e.target.value } })} />
                  <button className="btn petit" onClick={() => ajouterNachtrag(d)}>+ Añadir</button>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>Schlussrechnung generada — proyecto cerrado.</p>
              )}
              <p style={{ fontSize: 11.5, color: '#999', margin: '8px 0 0' }}>
                Importe negativo = trabajo anulado. Las facturas se calculan sobre el importe actual del proyecto.
              </p>
            </div>

            <table className="histo">
              <thead>
                <tr><th>Factura</th><th>Importe HT €</th><th>TTC €</th><th>Nº</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {PLAN.map((p) => {
                  const f = fs.find((x) => x.type === p.type)
                  const cle = `${d.id}:${p.type}`
                  const propose = montantPropose(d, p)
                  const bloqueSchluss = p.type === 'schluss' && fs.filter((x) => x.type !== 'schluss').length < 2
                  return (
                    <tr key={p.type}>
                      <td>{p.label} <span style={{ color: '#999', fontSize: 12 }}>({p.pct} %)</span>
                        {f?.ajuste_manuellement && <span style={{ color: '#b8860b', fontSize: 11 }}> · ajustada</span>}
                      </td>
                      <td>
                        {f ? <b>{fmt(f.montant_ht)}</b> : (
                          <input type="number" step="10" style={{ width: 110 }}
                            placeholder={String(propose)}
                            value={montants[cle] ?? ''}
                            onChange={(e) => setMontants({ ...montants, [cle]: e.target.value })} />
                        )}
                      </td>
                      <td>{f ? <b>{fmt(f.ttc)}</b> : fmt((montants[cle] !== undefined && montants[cle] !== '' ? Number(montants[cle]) : propose) * 1.19)}</td>
                      <td>{f ? f.numero : '—'}</td>
                      <td>
                        {f ? (
                          <select value={f.statut} onChange={(e) => changerStatut(f, e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                            <option>emitida</option><option>pagada</option>
                          </select>
                        ) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {f ? (
                          <>
                            <button className="btn petit sec" onClick={() => imprimer(f, d)}>Ver / Imprimir</button>{' '}
                            {f.statut !== 'pagada' && <button className="suppr" style={{ paddingTop: 0 }} title="Eliminar" onClick={() => supprimerFacture(f)}>✕</button>}
                          </>
                        ) : (
                          <button className="btn petit" disabled={bloqueSchluss}
                            title={bloqueSchluss ? 'Genera primero los 2 Abschläge' : ''}
                            onClick={() => generer(d, p)}>Generar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {fs.length > 0 && (() => {
              const facture = fs.reduce((s, f) => s + Number(f.montant_ht), 0)
              const reste = actuel - facture
              return (
                <p style={{ fontSize: 13, color: '#666', marginTop: 10, textAlign: 'right' }}>
                  Facturado: <b>{fmt(facture)} € HT</b> · Pendiente: <b style={{ color: reste > 0.01 ? 'var(--rouge)' : '#1a6b1a' }}>{fmt(reste)} € HT</b>
                </p>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
