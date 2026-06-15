import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDate, toISO, fmtDate, chevauche, MOIS, jour } from '../lib/dates'

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
    if (!selection && p.data?.length) setSelection(p.data[0].id)
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

  // Allocations d'une personne = tâches où elle est affectée, enrichies du projet
  const allocationsDe = (persId) => {
    const tIds = allocations.filter((a) => a.personnel_id === persId).map((a) => a.tache_id)
    return taches
      .filter((t) => tIds.includes(t.id) && t.date_debut && t.date_fin)
      .map((t) => ({ ...t, projet: projets.find((p) => p.id === t.projet_id) }))
      .sort((a, b) => (a.date_debut > b.date_debut ? 1 : -1))
  }

  // Conflits : deux tâches de la même personne qui se chevauchent
  const conflits = (persId) => {
    const al = allocationsDe(persId)
    const set = new Set()
    for (let i = 0; i < al.length; i++)
      for (let j = i + 1; j < al.length; j++)
        if (chevauche(al[i].date_debut, al[i].date_fin, al[j].date_debut, al[j].date_fin)) {
          set.add(al[i].id); set.add(al[j].id)
        }
    return set
  }

  const persSelectionnee = personnel.find((p) => p.id === selection)

  return (
    <div className="page" style={{ maxWidth: 1100 }}>
      <div className="carte">
        <h2>Recursos humanos</h2>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button className="btn petit" onClick={() => setNouveau(nouveau ? null : { nom: '', metier: '', couleur: COULEURS[personnel.length % COULEURS.length] })}>
            {nouveau ? '✕ Cancelar' : '+ Nueva persona'}
          </button>
        </div>
        {nouveau && (
          <div style={{ border: '1.5px solid var(--rouge)', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fdf7f2', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div><label>Nombre *</label><input value={nouveau.nom} onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} /></div>
            <div><label>Oficio</label><input value={nouveau.metier} placeholder="Maler, Fliesenleger..." onChange={(e) => setNouveau({ ...nouveau, metier: e.target.value })} /></div>
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
              const al = allocationsDe(p.id)
              const aujourdhui = toISO(new Date())
              const enCours = al.filter((t) => t.date_debut <= aujourdhui && t.date_fin >= aujourdhui)
              const cf = conflits(p.id)
              return (
                <tr key={p.id} style={{ opacity: p.actif ? 1 : 0.45, cursor: 'pointer', background: selection === p.id ? '#fdf7f2' : '' }}
                  onClick={() => setSelection(p.id)}>
                  <td><span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 4, background: p.couleur }} /></td>
                  <td><b>{p.nom}</b></td>
                  <td>{p.metier}</td>
                  <td>
                    {enCours.length > 0 ? enCours.map((t) => t.projet?.nom).join(', ') : <span style={{ color: '#999' }}>libre</span>}
                    {cf.size > 0 && <span style={{ color: '#c00000', fontWeight: 700 }}> · ⚠ {cf.size} solapamientos</span>}
                  </td>
                  <td><button className="btn petit sec" onClick={(e) => { e.stopPropagation(); toggleActif(p) }}>{p.actif ? 'Desactivar' : 'Activar'}</button></td>
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
          <CalendrierAnnuel annee={annee} allocations={allocationsDe(selection)} conflits={conflits(selection)} />
        </div>
      )}
    </div>
  )
}

// Bande annuelle : 12 mois, barres des projets alloués
function CalendrierAnnuel({ annee, allocations, conflits }) {
  const debutAnnee = new Date(annee, 0, 1)
  const finAnnee = new Date(annee, 11, 31)
  const totalJours = Math.round((finAnnee - debutAnnee) / jour) + 1

  const pct = (d) => {
    const x = parseDate(d)
    if (!x) return 0
    return Math.max(0, Math.min(100, ((x - debutAnnee) / jour / totalJours) * 100))
  }

  if (allocations.length === 0)
    return <p style={{ color: '#999', fontSize: 14, marginTop: 14 }}>Sin asignaciones este año.</p>

  return (
    <div style={{ marginTop: 16 }}>
      {/* échelle des mois */}
      <div style={{ display: 'flex', borderBottom: '1px solid #ddd', marginBottom: 8 }}>
        {MOIS.map((m, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10.5, color: '#888', textAlign: 'center', padding: '2px 0', borderLeft: i ? '1px solid #f0f0f0' : 'none' }}>
            {m.slice(0, 3)}
          </div>
        ))}
      </div>
      {/* barres */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {allocations.map((t) => {
          const gauche = pct(t.date_debut)
          const largeur = Math.max(1.2, pct(t.date_fin) - gauche)
          const enConflit = conflits.has(t.id)
          return (
            <div key={t.id} style={{ position: 'relative', height: 30 }}>
              <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, background: '#faf8f5', borderRadius: 5 }} />
              <div title={`${t.projet?.nom} · ${t.titre}`}
                style={{
                  position: 'absolute', left: `${gauche}%`, width: `${largeur}%`, top: 0, height: 30,
                  background: enConflit ? '#c00000' : (t.projet?.couleur || '#6d6d6d'),
                  borderRadius: 5, color: '#fff', fontSize: 11, padding: '0 7px', display: 'flex', alignItems: 'center',
                  overflow: 'hidden', whiteSpace: 'nowrap', boxShadow: enConflit ? '0 0 0 2px #c00000' : 'none',
                }}>
                {enConflit && '⚠ '}{t.projet?.nom} — {t.titre}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 12.5, color: '#666' }}>
        {allocations.map((t) => (
          <div key={t.id} style={{ padding: '2px 0', color: conflits.has(t.id) ? '#c00000' : 'inherit' }}>
            <b>{t.projet?.nom}</b> — {t.titre} · {fmtDate(t.date_debut)} → {fmtDate(t.date_fin)}
            {conflits.has(t.id) && ' ⚠ solapamiento'}
          </div>
        ))}
      </div>
    </div>
  )
}
