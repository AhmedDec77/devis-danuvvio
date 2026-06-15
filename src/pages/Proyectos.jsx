import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDate, toISO, fmtDate, joursEntre, chevauche, MOIS, JOURS_SEM, jour } from '../lib/dates'

export default function Proyectos() {
  const [projets, setProjets] = useState([])
  const [taches, setTaches] = useState([])
  const [personnel, setPersonnel] = useState([])
  const [allocations, setAllocations] = useState([])
  const [devisAcceptes, setDevisAcceptes] = useState([])
  const [selection, setSelection] = useState(null)
  const [moisRef, setMoisRef] = useState(new Date())
  const [nouveauProjet, setNouveauProjet] = useState(null)

  const charger = async () => {
    const [pr, t, pe, a, d] = await Promise.all([
      supabase.from('projets').select('*').order('date_debut'),
      supabase.from('taches').select('*').order('ordre'),
      supabase.from('personnel').select('*').eq('actif', true).order('nom'),
      supabase.from('allocations').select('*'),
      supabase.from('devis').select('id, numero, titre, client_civilite, client_nom, client_adresse, client_ville, lignes').eq('statut', 'aceptado'),
    ])
    setProjets(pr.data || []); setTaches(t.data || []); setPersonnel(pe.data || [])
    setAllocations(a.data || []); setDevisAcceptes(d.data || [])
  }
  useEffect(() => { charger() }, [])

  const tachesDe = (pId) => taches.filter((t) => t.projet_id === pId).sort((a, b) => (a.ordre || 0) - (b.ordre || 0))

  // ---- Création de projet ----
  const creerProjet = async () => {
    const n = nouveauProjet
    if (!n?.nom?.trim() && !n?.devis_id) return
    const devis = devisAcceptes.find((d) => d.id === n.devis_id)
    const debut = n.date_debut || toISO(new Date())
    const fin = n.date_fin || toISO(new Date(Date.now() + 30 * jour))
    const { data: proj } = await supabase.from('projets').insert({
      nom: n.nom?.trim() || devis?.titre || `KV ${devis?.numero}`,
      devis_id: n.devis_id || null,
      client_nom: devis ? `${devis.client_civilite || ''} ${devis.client_nom}`.trim() : (n.client_nom || null),
      adresse: devis?.client_adresse || null,
      date_debut: debut, date_fin: fin,
    }).select().single()

    // Initialise les tâches depuis les positions du devis
    if (proj && devis?.lignes?.length) {
      const dur = Math.max(1, Math.floor(joursEntre(debut, fin) / devis.lignes.length))
      const taches = devis.lignes.map((l, i) => {
        const td = toISO(new Date(parseDate(debut).getTime() + i * dur * jour))
        const tf = toISO(new Date(parseDate(debut).getTime() + ((i + 1) * dur - 1) * jour))
        return {
          projet_id: proj.id,
          titre: String(l.description || '').split('\n')[0].slice(0, 80),
          date_debut: td, date_fin: tf, nb_personnes: 1, ordre: i,
        }
      })
      await supabase.from('taches').insert(taches)
    }
    setNouveauProjet(null); await charger()
    if (proj) setSelection(proj.id)
  }

  const supprimerProjet = async (p) => {
    if (!confirm(`¿Eliminar el proyecto "${p.nom}" y todas sus tareas?`)) return
    await supabase.from('projets').delete().eq('id', p.id)
    setSelection(null); charger()
  }

  const projetSel = projets.find((p) => p.id === selection)

  return (
    <div className="page" style={{ maxWidth: 1140 }}>
      <div className="carte">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}>Calendario de proyectos</h2>
          <button className="btn petit" onClick={() => setNouveauProjet(nouveauProjet ? null : { nom: '', devis_id: '', date_debut: '', date_fin: '' })}>
            {nouveauProjet ? '✕ Cancelar' : '+ Nuevo proyecto'}
          </button>
        </div>

        {nouveauProjet && (
          <div style={{ border: '1.5px solid var(--rouge)', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fdf7f2' }}>
            <div className="grille">
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Desde un presupuesto aceptado (crea las tareas automáticamente)</label>
                <select value={nouveauProjet.devis_id} onChange={(e) => setNouveauProjet({ ...nouveauProjet, devis_id: e.target.value })}>
                  <option value="">— Proyecto manual (sin presupuesto) —</option>
                  {devisAcceptes.map((d) => (
                    <option key={d.id} value={d.id}>KV {d.numero} — {d.client_nom} {d.titre ? `· ${d.titre.slice(0, 40)}` : ''}</option>
                  ))}
                </select>
              </div>
              <div><label>Nombre del proyecto {nouveauProjet.devis_id ? '(opcional)' : '*'}</label>
                <input value={nouveauProjet.nom} onChange={(e) => setNouveauProjet({ ...nouveauProjet, nom: e.target.value })} /></div>
              <div><label>Inicio</label><input type="date" value={nouveauProjet.date_debut} onChange={(e) => setNouveauProjet({ ...nouveauProjet, date_debut: e.target.value })} /></div>
              <div><label>Fin</label><input type="date" value={nouveauProjet.date_fin} onChange={(e) => setNouveauProjet({ ...nouveauProjet, date_fin: e.target.value })} /></div>
            </div>
            <button className="btn petit" style={{ marginTop: 12 }} onClick={creerProjet}>Crear proyecto</button>
          </div>
        )}

        <CalendrierMois projets={projets} moisRef={moisRef} setMoisRef={setMoisRef}
          onSelect={setSelection} selection={selection} />
      </div>

      {projetSel && (
        <DetailProjet key={projetSel.id} projet={projetSel} taches={tachesDe(projetSel.id)}
          personnel={personnel} allocations={allocations} onChange={charger} onDelete={() => supprimerProjet(projetSel)} />
      )}
    </div>
  )
}

// ---------- Vue calendrier mois ----------
function CalendrierMois({ projets, moisRef, setMoisRef, onSelect, selection }) {
  const annee = moisRef.getFullYear(), mois = moisRef.getMonth()
  const premier = new Date(annee, mois, 1)
  const dernier = new Date(annee, mois + 1, 0)
  const debutGrille = new Date(premier)
  debutGrille.setDate(premier.getDate() - ((premier.getDay() + 6) % 7))
  const cases = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(debutGrille); d.setDate(debutGrille.getDate() + i); cases.push(d)
  }
  const projetsActifs = (d) => {
    const iso = toISO(d)
    return projets.filter((p) => p.date_debut && p.date_fin && p.date_debut <= iso && p.date_fin >= iso)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button className="btn petit sec" onClick={() => setMoisRef(new Date(annee, mois - 1, 1))}>←</button>
        <b style={{ fontSize: 15 }}>{MOIS[mois]} {annee}</b>
        <button className="btn petit sec" onClick={() => setMoisRef(new Date(annee, mois + 1, 1))}>→</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {JOURS_SEM.map((j) => <div key={j} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#888', padding: 4 }}>{j}</div>)}
        {cases.map((d, i) => {
          const horsMois = d.getMonth() !== mois
          const actifs = projetsActifs(d)
          const auj = toISO(d) === toISO(new Date())
          return (
            <div key={i} style={{
              minHeight: 64, border: '1px solid #eee', borderRadius: 6, padding: 4,
              background: horsMois ? '#fafafa' : '#fff', opacity: horsMois ? 0.5 : 1,
              outline: auj ? '2px solid var(--rouge)' : 'none',
            }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{d.getDate()}</div>
              {actifs.slice(0, 3).map((p) => (
                <div key={p.id} onClick={() => onSelect(p.id)} title={p.nom}
                  style={{
                    fontSize: 10, background: p.couleur, color: '#fff', borderRadius: 3, padding: '1px 4px',
                    marginBottom: 2, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    outline: selection === p.id ? '1.5px solid #232323' : 'none',
                  }}>
                  {p.nom}
                </div>
              ))}
              {actifs.length > 3 && <div style={{ fontSize: 9, color: '#999' }}>+{actifs.length - 3}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------- Détail projet : Gantt + tâches + allocations ----------
function DetailProjet({ projet, taches, personnel, allocations, onChange, onDelete }) {
  const [nouvelleTache, setNouvelleTache] = useState(false)
  const [formTache, setFormTache] = useState({ titre: '', date_debut: projet.date_debut, date_fin: projet.date_fin, nb_personnes: 1 })

  const allocsDe = (tId) => allocations.filter((a) => a.tache_id === tId)
  const persDe = (tId) => allocsDe(tId).map((a) => personnel.find((p) => p.id === a.personnel_id)).filter(Boolean)

  const ajouterTache = async () => {
    if (!formTache.titre.trim()) return
    await supabase.from('taches').insert({
      projet_id: projet.id, titre: formTache.titre.trim(),
      date_debut: formTache.date_debut || null, date_fin: formTache.date_fin || null,
      nb_personnes: Number(formTache.nb_personnes) || 1, ordre: taches.length,
    })
    setNouvelleTache(false); setFormTache({ titre: '', date_debut: projet.date_debut, date_fin: projet.date_fin, nb_personnes: 1 })
    onChange()
  }

  const majTache = async (t, champ, val) => {
    await supabase.from('taches').update({ [champ]: val }).eq('id', t.id)
    onChange()
  }

  const supprimerTache = async (t) => {
    await supabase.from('taches').delete().eq('id', t.id)
    onChange()
  }

  const toggleAllocation = async (t, persId) => {
    const existe = allocsDe(t.id).find((a) => a.personnel_id === persId)
    if (existe) await supabase.from('allocations').delete().eq('id', existe.id)
    else await supabase.from('allocations').insert({ tache_id: t.id, personnel_id: persId })
    onChange()
  }

  // Gantt : bornes = min/max des dates de tâches (ou dates projet)
  const dates = taches.filter((t) => t.date_debut && t.date_fin)
  const debut = dates.length ? dates.reduce((m, t) => t.date_debut < m ? t.date_debut : m, dates[0].date_debut) : projet.date_debut
  const fin = dates.length ? dates.reduce((m, t) => t.date_fin > m ? t.date_fin : m, dates[0].date_fin) : projet.date_fin
  const total = joursEntre(debut, fin) || 1
  const pos = (d) => {
    const x = parseDate(d), d0 = parseDate(debut)
    if (!x || !d0) return 0
    return ((x - d0) / jour / total) * 100
  }

  return (
    <div className="carte">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>{projet.nom}</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>
            {projet.client_nom} {projet.adresse && `· ${projet.adresse}`} · {fmtDate(projet.date_debut)} → {fmtDate(projet.date_fin)}
          </p>
        </div>
        <button className="btn petit sec" onClick={onDelete}>Eliminar proyecto</button>
      </div>

      {/* Gantt */}
      {dates.length > 0 && (
        <div style={{ marginTop: 18, overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            {taches.map((t) => {
              if (!t.date_debut || !t.date_fin) return null
              const g = Math.max(0, pos(t.date_debut))
              const w = Math.max(1.5, pos(t.date_fin) - g)
              const ps = persDe(t.id)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 180, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.titre}>{t.titre}</div>
                  <div style={{ flex: 1, position: 'relative', height: 26, background: '#faf8f5', borderRadius: 5 }}>
                    <div style={{ position: 'absolute', left: `${g}%`, width: `${w}%`, height: 26, background: projet.couleur, borderRadius: 5, display: 'flex', alignItems: 'center', padding: '0 6px', gap: 3 }}>
                      {ps.map((p) => <span key={p.id} title={p.nom} style={{ width: 12, height: 12, borderRadius: '50%', background: p.couleur, border: '1.5px solid #fff' }} />)}
                      {t.nb_personnes > ps.length && <span style={{ fontSize: 10, color: '#fff' }}>+{t.nb_personnes - ps.length}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Liste des tâches éditables */}
      <h2 style={{ marginTop: 22 }}>Tareas</h2>
      <table className="histo">
        <thead><tr><th>Tarea</th><th>Inicio</th><th>Fin</th><th>Nº pers.</th><th>Equipo asignado</th><th></th></tr></thead>
        <tbody>
          {taches.map((t) => (
            <tr key={t.id}>
              <td><input defaultValue={t.titre} style={{ fontSize: 13 }} onBlur={(e) => e.target.value !== t.titre && majTache(t, 'titre', e.target.value)} /></td>
              <td><input type="date" defaultValue={t.date_debut || ''} onChange={(e) => majTache(t, 'date_debut', e.target.value)} style={{ width: 130 }} /></td>
              <td><input type="date" defaultValue={t.date_fin || ''} onChange={(e) => majTache(t, 'date_fin', e.target.value)} style={{ width: 130 }} /></td>
              <td><input type="number" min="1" defaultValue={t.nb_personnes} onBlur={(e) => majTache(t, 'nb_personnes', Number(e.target.value))} style={{ width: 55 }} /></td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {personnel.map((p) => {
                    const actif = allocsDe(t.id).some((a) => a.personnel_id === p.id)
                    return (
                      <button key={p.id} onClick={() => toggleAllocation(t, p.id)}
                        style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 12, cursor: 'pointer',
                          border: '1px solid ' + p.couleur,
                          background: actif ? p.couleur : '#fff', color: actif ? '#fff' : p.couleur,
                        }}>
                        {p.nom}
                      </button>
                    )
                  })}
                </div>
              </td>
              <td><button className="suppr" style={{ paddingTop: 0 }} onClick={() => supprimerTache(t)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {nouvelleTache ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}><label>Tarea</label><input value={formTache.titre} onChange={(e) => setFormTache({ ...formTache, titre: e.target.value })} /></div>
          <div><label>Inicio</label><input type="date" value={formTache.date_debut || ''} onChange={(e) => setFormTache({ ...formTache, date_debut: e.target.value })} /></div>
          <div><label>Fin</label><input type="date" value={formTache.date_fin || ''} onChange={(e) => setFormTache({ ...formTache, date_fin: e.target.value })} /></div>
          <div><label>Nº pers.</label><input type="number" min="1" value={formTache.nb_personnes} onChange={(e) => setFormTache({ ...formTache, nb_personnes: e.target.value })} style={{ width: 60 }} /></div>
          <button className="btn petit" onClick={ajouterTache}>Añadir</button>
        </div>
      ) : (
        <button className="btn sec petit" style={{ marginTop: 10 }} onClick={() => setNouvelleTache(true)}>+ Nueva tarea</button>
      )}
    </div>
  )
}
