import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDate, toISO, fmtDate, MOIS, jour } from '../lib/dates'

const COULEURS = ['#c00000', '#1d4f9c', '#b8860b', '#1a6b1a', '#7b2d8e', '#0d7377', '#d84315', '#5d4037']

export default function Recursos() {
  const [personnel, setPersonnel] = useState([])
  const [projets, setProjets] = useState([])
  const [taches, setTaches] = useState([])
  const [allocations, setAllocations] = useState([])
  const [nouveau, setNouveau] = useState(null)
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [selection, setSelection] = useState(null)

  const charger = async () => {
    const [p, pr, t, a] = await Promise.all([
      supabase.from('personnel').select('*').order('nom'),
      supabase.from('projets').select('*'),
      supabase.from('taches').select('*'),
      supabase.from('allocations').select('*'),
    ])
    setPersonnel(p.data || []); setProjets(pr.data || [])
    setTaches(t.data || []); setAllocations(a.data || [])
  }
  useEffect(() => { charger() }, [])

  const creer = async () => {
    if (!nouveau?.nom?.trim()) return
    await supabase.from('personnel').insert({
      nom: nouveau.nom.trim(), metier: nouveau.metier || null,
      couleur: nouveau.couleur || COULEURS[personnel.length % COULEURS.length],
    })
    setNouveau(null); charger()
  }

  const toggleActif = async (p) => {
    await supabase.from('personnel').update({ actif: !p.actif }).eq('id', p.id)
    charger()
  }

  const supprimer = async (p) => {
    if (!confirm(`¿Eliminar a ${p.nom} del equipo? Se quitarán sus asignaciones.`)) return
    await supabase.from('personnel').delete().eq('id', p.id)
    if (selection === p.id) setSelection(null)
    charger()
  }

  // Implication d'une personne PAR PROJET : {projet, debut, fin} sur la base de ses tâches
  const projetsDe = (persId) => {
    const tIds = allocations.filter((a) => a.personnel_id === persId).map((a) => a.tache_id)
    const mesTaches = taches.filter((t) => tIds.includes(t.id) && t.date_debut && t.date_fin)
    const parProjet = {}
    for (const t of mesTaches) {
      const p = projets.find((x) => x.id === t.projet_id)
      if (!p) continue
      if (!parProjet[p.id]) parProjet[p.id] = { projet: p, debut: t.date_debut, fin: t.date_fin, nbTaches: 0 }
      const e = parProjet[p.id]
      if (t.date_debut < e.debut) e.debut = t.date_debut
      if (t.date_fin > e.fin) e.fin = t.date_fin
      e.nbTaches++
    }
    return Object.values(parProjet).sort((a, b) => (a.debut > b.debut ? 1 : -1))
  }

  const persSelectionnee = personnel.find((p) => p.id === selection)

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="carte">
        <h2>Equipo Danuvvio</h2>
        <p style={{ fontSize: 12.5, color: '#999', margin: '0 0 14px' }}>
          Solo el personal propio. Fontanería y electricidad se subcontratan y no se gestionan aquí.
        </p>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button className="btn petit" onClick={() => setNouveau(nouveau ? null : { nom: '', metier: '', couleur: COULEURS[personnel.length % COULEURS.length] })}>
            {nouveau ? '✕ Cancelar' : '+ Nueva persona'}
          </button>
        </div>
        {nouveau && (
          <div style={{ border: '1.5px solid var(--rouge)', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fdf7f2', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label>Nombre *</label><input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} /></div>
            <div><label>Oficio</label><input value={nouveau.metier} placeholder="Maler, Fliesenleger, Allrounder..." onChange={(e) => setNouveau({ ...nouveau, metier: e.target.value })} /></div>
            <div>
              <label>Color</label>
              <div style={{ display: 'flex', gap: 4 }}>
                {COULEURS.map((c) => (
                  <button key={c} onClick={() => setNouveau({ ...nouveau, couleur: c })}
                    style={{ width: 24, height: 24, borderRadius: 5, background: c, border: nouveau.couleur === c ? '3px solid #232323' : '1px solid #ccc', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
            <button className="btn petit" onClick={creer}>Crear</button>
          </div>
        )}
        <table className="histo">
          <thead><tr><th></th><th>Nombre</th><th>Oficio</th><th>Proyectos activos</th><th></th></tr></thead>
          <tbody>
            {personnel.map((p) => {
              const projs = projetsDe(p.id)
              const aujourdhui = toISO(new Date())
              return (
                <tr key={p.id} style={{ opacity: p.actif ? 1 : 0.45, cursor: 'pointer', background: selection === p.id ? '#fdf7f2' : '' }}
                  onClick={() => setSelection(selection === p.id ? null : p.id)}>
                  <td><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: p.couleur }} /></td>
                  <td><b>{p.nom}</b></td>
                  <td>{p.metier}</td>
                  <td>
                    {projs.length === 0 ? <span style={{ color: '#999' }}>—</span> : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {projs.map((e) => {
                          const enCours = e.debut <= aujourdhui && e.fin >= aujourdhui
                          return (
                            <span key={e.projet.id} title={`${fmtDate(e.debut)} → ${fmtDate(e.fin)}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, padding: '2px 8px', borderRadius: 12, background: '#f4f1ec', border: enCours ? `1.5px solid ${e.projet.couleur}` : '1px solid #e4e4e4' }}>
                              <span style={{ width: 9, height: 9, borderRadius: '50%', background: e.projet.couleur }} />
                              {e.projet.nom}
                            </span>
                          )
                        })}
                      </div>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn petit sec" onClick={(ev) => { ev.stopPropagation(); toggleActif(p) }}>{p.actif ? 'Desactivar' : 'Activar'}</button>{' '}
                    <button className="suppr" style={{ paddingTop: 0 }} onClick={(ev) => { ev.stopPropagation(); supprimer(p) }}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {persSelectionnee && (
        <div className="carte">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Calendario de {persSelectionnee.nom} — {annee}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn petit sec" onClick={() => setAnnee(annee - 1)}>← {annee - 1}</button>
              <button className="btn petit sec" onClick={() => setAnnee(annee + 1)}>{annee + 1} →</button>
            </div>
          </div>
          <CalendrierAnnuel annee={annee} implications={projetsDe(selection)} />
        </div>
      )}
    </div>
  )
}

// Bande annuelle : une barre par projet (durée d'implication)
function CalendrierAnnuel({ annee, implications }) {
  const debutAnnee = new Date(annee, 0, 1)
  const finAnnee = new Date(annee, 11, 31)
  const totalJours = Math.round((finAnnee - debutAnnee) / jour) + 1

  const pct = (d) => {
    const x = parseDate(d)
    if (!x) return null
    return ((x - debutAnnee) / jour / totalJours) * 100
  }

  // ne garder que les implications qui touchent l'année affichée
  const visibles = implications.filter((e) => {
    const d = parseDate(e.debut), f = parseDate(e.fin)
    return f >= debutAnnee && d <= finAnnee
  })

  if (visibles.length === 0)
    return <p style={{ color: '#999', fontSize: 14, marginTop: 14 }}>Sin asignaciones este año.</p>

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 8 }}>
        {MOIS.map((m, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10.5, color: '#888', textAlign: 'center', padding: '2px 0', borderLeft: i ? '1px solid #f0f0f0' : 'none' }}>
            {m.slice(0, 3)}
          </div>
        ))}
      </div>
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {visibles.map((e) => {
          const gauche = Math.max(0, pct(e.debut))
          const droite = Math.min(100, pct(e.fin) + (100 / totalJours))
          const largeur = Math.max(1.2, droite - gauche)
          return (
            <div key={e.projet.id} style={{ position: 'relative', height: 30 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: '#faf8f5', borderRadius: 5 }} />
              <div title={`${e.projet.nom} · ${fmtDate(e.debut)} → ${fmtDate(e.fin)}`}
                style={{
                  position: 'absolute', left: `${gauche}%`, width: `${largeur}%`, top: 0, height: 30,
                  background: e.projet.couleur, borderRadius: 5, color: '#fff', fontSize: 11, padding: '0 8px',
                  display: 'flex', alignItems: 'center', overflow: 'hidden', whiteSpace: 'nowrap',
                }}>
                {e.projet.nom}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, color: '#666' }}>
        {visibles.map((e) => (
          <div key={e.projet.id} style={{ padding: '2px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.projet.couleur }} />
            <b>{e.projet.nom}</b> · {fmtDate(e.debut)} → {fmtDate(e.fin)} <span style={{ color: '#999' }}>({e.nbTaches} tareas)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
