import { useEffect, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'

export default function Clientes({ onNouveauDevis }) {
  const [clients, setClients] = useState([])
  const [recherche, setRecherche] = useState('')
  const [edition, setEdition] = useState(null) // client en cours d'édition
  const [sauve, setSauve] = useState(null)
  const [nouveau, setNouveau] = useState(null) // formulaire nouveau client
  const [messageCreation, setMessageCreation] = useState('')

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

  const creer = async () => {
    if (!nouveau?.nom?.trim()) { setMessageCreation('El apellido es obligatorio.'); return }
    const { data: numero, error } = await supabase.rpc('obtenir_numero_client', {
      p_civilite: nouveau.civilite || null, p_prenom: nouveau.prenom || null, p_nom: nouveau.nom.trim(),
      p_adresse: nouveau.adresse || null, p_ville: nouveau.ville || null,
    })
    if (error) { setMessageCreation('Error al crear el cliente.'); return }
    const dejaConnu = clients.some((x) => x.numero === numero)
    setMessageCreation(dejaConnu
      ? `Este cliente ya existía: ${numero} (ficha actualizada).`
      : `Cliente creado: ${numero}.`)
    setNouveau(null)
    setRecherche(nouveau.nom.trim())
    charger()
    setTimeout(() => setMessageCreation(''), 5000)
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
          <button className="btn petit" onClick={() => { setNouveau(nouveau ? null : { civilite: 'Frau', prenom: '', nom: '', adresse: '', ville: '' }); setMessageCreation('') }}>
            {nouveau ? '✕ Cancelar' : '+ Nuevo cliente'}
          </button>
          <input style={{ maxWidth: 300 }} placeholder="Buscar nombre, dirección, KD-..." value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          <span style={{ fontSize: 13, color: '#666' }}>
            <b>{clients.length}</b> clientes · volumen histórico 2017–2026: <b>{fmt(volumeTotal)} €</b>
          </span>
        </div>
        {messageCreation && <p style={{ fontSize: 13, color: '#1a6b1a', background: '#e9f6e9', padding: '8px 12px', borderRadius: 7 }}>{messageCreation}</p>}
        {nouveau && (
          <div style={{ border: '1.5px solid var(--rouge)', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fdf7f2' }}>
            <div className="grille">
              <div>
                <label>Tratamiento</label>
                <select value={nouveau.civilite} onChange={(e) => setNouveau({ ...nouveau, civilite: e.target.value })}>
                  <option>Frau</option><option>Herr</option><option>Familie</option><option>Firma</option>
                </select>
              </div>
              <div><label>Nombre</label><input value={nouveau.prenom} onChange={(e) => setNouveau({ ...nouveau, prenom: e.target.value })} /></div>
              <div><label>Apellido *</label><input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} /></div>
              <div><label>Dirección</label><input value={nouveau.adresse} placeholder="Calle y número" onChange={(e) => setNouveau({ ...nouveau, adresse: e.target.value })} /></div>
              <div><label>CP y ciudad</label><input value={nouveau.ville} placeholder="81379 München" onChange={(e) => setNouveau({ ...nouveau, ville: e.target.value })} /></div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
              <button className="btn petit" onClick={creer}>Crear cliente</button>
              <span style={{ fontSize: 12, color: '#888', alignSelf: 'center' }}>El número KD- se asigna automáticamente. Si el nombre+apellido ya existe, se reutiliza la ficha.</span>
            </div>
          </div>
        )}
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
