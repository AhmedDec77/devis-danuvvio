import { useEffect, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'
import DocumentRechnung from '../components/DocumentRechnung.jsx'

// Types "acompte" reconnus (inclut les anciens abschlag1/abschlag2 du système 30/40/30, en lecture)
const TYPES_ACOMPTE = ['abschlag', 'abschlag1', 'abschlag2']
// Types "facture finale" reconnus (inclut l'ancien type 'rechnung' du mode facture unique)
const TYPES_FINALE = ['schluss', 'rechnung']

export default function Facturas() {
  const [devis, setDevis] = useState([])
  const [factures, setFactures] = useState([])
  const [nachtraege, setNachtraege] = useState([])
  const [impression, setImpression] = useState(null)
  const [formNachtrag, setFormNachtrag] = useState({})
  const [formAcompte, setFormAcompte] = useState({})
  const [montantSchluss, setMontantSchluss] = useState({})

  const charger = async () => {
    const { data: d } = await supabase.from('devis').select('*').eq('statut', 'aceptado').order('cree_le', { ascending: false })
    const { data: f } = await supabase.from('factures').select('*').order('cree_le')
    const { data: n } = await supabase.from('nachtraege').select('*').order('numero')
    setDevis(d || []); setFactures(f || []); setNachtraege(n || [])
  }
  useEffect(() => { charger() }, [])

  const facturesDe = (id) => factures.filter((f) => f.devis_id === id)
  const acomptesDe = (id) => facturesDe(id).filter((f) => TYPES_ACOMPTE.includes(f.type))
    .sort((a, b) => (a.numero_acompte || 0) - (b.numero_acompte || 0))
  const schlussDe = (id) => facturesDe(id).find((f) => TYPES_FINALE.includes(f.type))
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
    if (schlussDe(d.id)) {
      alert('La Schlussrechnung ya está generada — no se puede modificar el importe del proyecto.'); return
    }
    if (!confirm(`¿Eliminar la modificación N${n.numero}?`)) return
    await supabase.from('nachtraege').delete().eq('id', n.id)
    charger()
  }

  const asegurarNumeroCliente = async (d) => {
    if (d.numero_client) return d.numero_client
    const { data } = await supabase.rpc('obtenir_numero_client', {
      p_civilite: d.client_civilite, p_prenom: d.client_prenom, p_nom: d.client_nom,
      p_adresse: d.client_adresse, p_ville: d.client_ville,
    })
    if (data) await supabase.from('devis').update({ numero_client: data }).eq('id', d.id)
    return data
  }

  // --- Acomptes libres : Danuvvio saisit le montant TTC réellement payé par le client ---
  const ajouterAcompte = async (d) => {
    const montoTTC = Number(formAcompte[d.id])
    if (!montoTTC || montoTTC <= 0) return
    const actuel = totalActuel(d)
    const acomptesExistants = acomptesDe(d.id)
    const numeroAcompte = Math.max(0, ...acomptesExistants.map((f) => f.numero_acompte || 0)) + 1
    const montoHT = Math.round((montoTTC / 1.19) * 100) / 100
    const tva = Math.round((montoTTC - montoHT) * 100) / 100
    const pourcentage = actuel > 0 ? Math.round((montoHT / actuel) * 100) : 0
    const { data: numero } = await supabase.rpc('prochain_numero_facture')
    const numClient = await asegurarNumeroCliente(d)

    const { error } = await supabase.from('factures').insert({
      numero, devis_id: d.id, type: 'abschlag', numero_acompte: numeroAcompte, pourcentage,
      base_ht: actuel, montant_ht: montoHT, tva, ttc: montoTTC,
      numero_client: numClient, ajuste_manuellement: false,
    })
    if (error) { alert('Error al crear la factura de acuenta.'); return }
    setFormAcompte({ ...formAcompte, [d.id]: '' })
    await charger()
  }

  // --- Facture finale : liste tous les acomptes déjà émis et calcule le solde (saisie en TTC) ---
  const generarSchluss = async (d) => {
    const actuel = totalActuel(d)
    const facturadoHT = acomptesDe(d.id).reduce((s, f) => s + Number(f.montant_ht), 0)
    const propuestoHT = Math.round((actuel - facturadoHT) * 100) / 100
    const propuestoTTC = Math.round(propuestoHT * 1.19 * 100) / 100
    const cle = d.id
    const saisiTTC = montantSchluss[cle] !== undefined && montantSchluss[cle] !== '' ? Number(montantSchluss[cle]) : propuestoTTC
    const saisiHT = Math.round((saisiTTC / 1.19) * 100) / 100
    const tva = Math.round((saisiTTC - saisiHT) * 100) / 100
    const pourcentage = actuel > 0 ? Math.round((saisiHT / actuel) * 100) : 0
    const { data: numero } = await supabase.rpc('prochain_numero_facture')
    const numClient = await asegurarNumeroCliente(d)

    const { error } = await supabase.from('factures').insert({
      numero, devis_id: d.id, type: 'schluss', pourcentage,
      base_ht: actuel, montant_ht: saisiHT, tva, ttc: saisiTTC,
      numero_client: numClient, ajuste_manuellement: Math.abs(saisiTTC - propuestoTTC) > 0.01,
    })
    if (error) { alert('Esta factura ya existe para este presupuesto.'); return }
    await charger()
  }


  const changerStatut = async (f, statut) => {
    await supabase.from('factures').update({ statut }).eq('id', f.id)
    charger()
  }

  const supprimerFactura = async (f) => {
    if (!confirm(`¿Eliminar la factura ${f.numero}? (solo si no fue enviada al cliente)`)) return
    await supabase.from('factures').delete().eq('id', f.id)
    charger()
  }

  const imprimer = (f, d) => {
    setImpression({ facture: f, devis: d })
    setTimeout(() => window.print(), 350)
  }

  if (impression) {
    const esFinale = TYPES_FINALE.includes(impression.facture.type)
    const precedentes = esFinale
      ? acomptesDe(impression.devis.id)
      : []
    return (
      <>
        <div className="page no-print" style={{ display: 'flex', gap: 10 }}>
          <button className="btn sec" onClick={() => setImpression(null)}>← Volver a facturas</button>
          <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <DocumentRechnung facture={impression.facture} devis={impression.devis}
          acomptesPrecedentes={precedentes} nachtraege={nachtraegeDe(impression.devis.id)} />
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
        const acomptes = acomptesDe(d.id)
        const schluss = schlussDe(d.id)
        const ns = nachtraegeDe(d.id)
        const actuel = totalActuel(d)
        const fN = formNachtrag[d.id] || { description: '', montant: '' }
        const facturado = acomptes.reduce((s, f) => s + Number(f.montant_ht), 0) + (schluss ? Number(schluss.montant_ht) : 0)
        const pendiente = actuel - facturado
        const propuestoSchlussHT = Math.round((actuel - acomptes.reduce((s, f) => s + Number(f.montant_ht), 0)) * 100) / 100
        const propuestoSchlussTTC = Math.round(propuestoSchlussHT * 1.19 * 100) / 100

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
                  {!schluss && <button className="suppr" style={{ paddingTop: 0 }} onClick={() => supprimerNachtrag(n, d)}>✕</button>}
                </div>
              ))}
              {!schluss ? (
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
                {acomptes.map((f) => (
                  <tr key={f.id}>
                    <td>Abschlag {f.numero_acompte || '—'}
                      {f.ajuste_manuellement && <span style={{ color: '#b8860b', fontSize: 11 }}> · ajustada</span>}
                    </td>
                    <td><b>{fmt(f.montant_ht)}</b></td>
                    <td><b>{fmt(f.ttc)}</b></td>
                    <td>{f.numero}</td>
                    <td>
                      <select value={f.statut} onChange={(e) => changerStatut(f, e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                        <option>emitida</option><option>pagada</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn petit sec" onClick={() => imprimer(f, d)}>Ver / Imprimir</button>{' '}
                      {f.statut !== 'pagada' && <button className="suppr" style={{ paddingTop: 0 }} title="Eliminar" onClick={() => supprimerFactura(f)}>✕</button>}
                    </td>
                  </tr>
                ))}
                {!schluss && (
                  <tr>
                    <td>+ Nueva factura de acuenta</td>
                    <td style={{ color: '#999', fontSize: 12 }}>
                      {formAcompte[d.id] ? fmt(Number(formAcompte[d.id]) / 1.19) + ' € HT' : ''}
                    </td>
                    <td>
                      <input type="number" step="10" style={{ width: 110 }} placeholder="€ TTC (pagado)"
                        value={formAcompte[d.id] || ''} onChange={(e) => setFormAcompte({ ...formAcompte, [d.id]: e.target.value })} />
                    </td>
                    <td colSpan="2"></td>
                    <td>
                      <button className="btn petit" onClick={() => ajouterAcompte(d)}>Generar</button>
                    </td>
                  </tr>
                )}
                {schluss ? (
                  <tr>
                    <td><b>Schlussrechnung</b></td>
                    <td><b>{fmt(schluss.montant_ht)}</b></td>
                    <td><b>{fmt(schluss.ttc)}</b></td>
                    <td>{schluss.numero}</td>
                    <td>
                      <select value={schluss.statut} onChange={(e) => changerStatut(schluss, e.target.value)} style={{ padding: '4px 6px', fontSize: 12 }}>
                        <option>emitida</option><option>pagada</option>
                      </select>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn petit sec" onClick={() => imprimer(schluss, d)}>Ver / Imprimir</button>{' '}
                      {schluss.statut !== 'pagada' && <button className="suppr" style={{ paddingTop: 0 }} title="Eliminar" onClick={() => supprimerFactura(schluss)}>✕</button>}
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td><b>Schlussrechnung</b> <span style={{ color: '#999', fontSize: 12 }}>(resto tras acomptes)</span></td>
                    <td style={{ color: '#999', fontSize: 12 }}>
                      {fmt((montantSchluss[d.id] !== undefined && montantSchluss[d.id] !== '' ? Number(montantSchluss[d.id]) : propuestoSchlussTTC) / 1.19)}
                    </td>
                    <td>
                      <input type="number" step="10" style={{ width: 110 }}
                        placeholder={String(propuestoSchlussTTC)}
                        value={montantSchluss[d.id] ?? ''}
                        onChange={(e) => setMontantSchluss({ ...montantSchluss, [d.id]: e.target.value })} />
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td>
                      <button className="btn petit" onClick={() => generarSchluss(d)}>Generar</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p style={{ fontSize: 13, color: '#666', marginTop: 10, textAlign: 'right' }}>
              Facturado: <b>{fmt(facturado)} € HT</b> · Pendiente: <b style={{ color: pendiente > 0.01 ? 'var(--rouge)' : '#1a6b1a' }}>{fmt(pendiente)} € HT</b>
            </p>
          </div>
        )
      })}
    </div>
  )
}
