import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDate, toISO, fmtDate, joursEntre, MOIS, JOURS_SEM, jour } from '../lib/dates'
import { calculerFin, jourSuivantOuvre, prochainOuvre } from '../lib/feries'

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

  const creerProjet = async () => {
    const n = nouveauProjet
    if (!n?.nom?.trim() && !n?.devis_id) return
    const devis = devisAcceptes.find((d) => d.id === n.devis_id)
    const debut = n.date_debut || toISO(prochainOuvre(new Date()))
    const { data: proj } = await supabase.from('projets').insert({
      nom: n.nom?.trim() || devis?.titre || `KV ${devis?.numero}`,
      devis_id: n.devis_id || null,
      client_nom: devis ? `${devis.client_civilite || ''} ${devis.client_nom}`.trim() : (n.client_nom || null),
      adresse: devis?.client_adresse || null,
      date_debut: debut, date_fin: debut,
    }).select().single()

    // Tâches depuis les positions du devis : 2 jours ouvrés chacune par défaut, enchaînées
    if (proj && devis?.lignes?.length) {
      let curDebut = debut
      const rows = devis.lignes.map((l, i) => {
        const { debut: td, fin: tf } = calculerFin(curDebut, 2, false)
        curDebut = jourSuivantOuvre(tf, false)
        return {
          projet_id: proj.id,
          titre: String(l.description || '').split('\n')[0].slice(0, 80),
          date_debut: td, date_fin: tf, duree_ouvree: 2, samedi_ouvre: false,
          nb_personnes: 1, ordre: i,
        }
      })
      await supabase.from('taches').insert(rows)
      // recadre le projet
      const fin = rows[rows.length - 1].date_fin
      await supabase.from('projets').update({ date_debut: rows[0].date_debut, date_fin: fin }).eq('id', proj.id)
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
          <button className="btn petit" onClick={() => setNouveauProjet(nouveauProjet ? null : { nom: '', devis_id: '', date_debut: '' })}>
            {nouveauProjet ? '✕ Cancelar' : '+ Nuevo proyecto'}
          </button>
        </div>

        {nouveauProjet && (
          <div style={{ border: '1.5px solid var(--rouge)', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fdf7f2' }}>
            <div className="grille">
              <div style={{ gridColumn: '1 / -1' }}>
                <label>Desde un presupuesto aceptado (crea las tareas desde las posiciones)</label>
                <select value={nouveauProjet.devis_id} onChange={(e) => setNouveauProjet({ ...nouveauProjet, devis_id: e.target.value })}>
                  <option value="">— Proyecto manual (sin presupuesto) —</option>
                  {devisAcceptes.map((d) => (
                    <option key={d.id} value={d.id}>KV {d.numero} — {d.client_nom} {d.titre ? `· ${d.titre.slice(0, 40)}` : ''}</option>
                  ))}
                </select>
              </div>
              <div><label>Nombre {nouveauProjet.devis_id ? '(opcional)' : '*'}</label>
                <input value={nouveauProjet.nom} onChange={(e) => setNouveauProjet({ ...nouveauProjet, nom: e.target.value })} /></div>
              <div><label>Inicio del proyecto</label><input type="date" value={nouveauProjet.date_debut} onChange={(e) => setNouveauProjet({ ...nouveauProjet, date_debut: e.target.value })} /></div>
            </div>
            <button className="btn petit" style={{ marginTop: 12 }} onClick={creerProjet}>Crear proyecto</button>
          </div>
        )}

        <CalendrierMois projets={projets} moisRef={moisRef} setMoisRef={setMoisRef} onSelect={setSelection} selection={selection} />
      </div>

      {projetSel && (
        <DetailProjet key={projetSel.id} projet={projetSel} taches={tachesDe(projetSel.id)}
          personnel={personnel} allocations={allocations} onChange={charger} onDelete={() => supprimerProjet(projetSel)} />
      )}
    </div>
  )
}

function CalendrierMois({ projets, moisRef, setMoisRef, onSelect, selection }) {
  const annee = moisRef.getFullYear(), mois = moisRef.getMonth()
  const premier = new Date(annee, mois, 1)
  const debutGrille = new Date(premier)
  debutGrille.setDate(premier.getDate() - ((premier.getDay() + 6) % 7))
  const cases = []
  for (let i = 0; i < 42; i++) { const d = new Date(debutGrille); d.setDate(debutGrille.getDate() + i); cases.push(d) }
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
            <div key={i} style={{ minHeight: 64, border: '1px solid #eee', borderRadius: 6, padding: 4, background: horsMois ? '#fafafa' : '#fff', opacity: horsMois ? 0.5 : 1, outline: auj ? '2px solid var(--rouge)' : 'none' }}>
              <div style={{ fontSize: 11, color: '#999', marginBottom: 2 }}>{d.getDate()}</div>
              {actifs.slice(0, 3).map((p) => (
                <div key={p.id} onClick={() => onSelect(p.id)} title={p.nom}
                  style={{ fontSize: 10, background: p.couleur, color: '#fff', borderRadius: 3, padding: '1px 4px', marginBottom: 2, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', outline: selection === p.id ? '1.5px solid #232323' : 'none' }}>
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

function DetailProjet({ projet, taches, personnel, allocations, onChange, onDelete }) {
  const [nouvelleTache, setNouvelleTache] = useState(false)
  const [formTache, setFormTache] = useState({ titre: '', duree: 2, samedi: false })
  const [creationPers, setCreationPers] = useState(null) // {tacheId, nom}

  const allocsDe = (tId) => allocations.filter((a) => a.tache_id === tId)
  const persDe = (tId) => allocsDe(tId).map((a) => personnel.find((p) => p.id === a.personnel_id)).filter(Boolean)

  // Recalcule toutes les dates en chaîne à partir du début projet, puis recadre le projet
  const replanifier = async (tachesMaj) => {
    const ordered = [...tachesMaj].sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
    let curDebut = projet.date_debut || toISO(prochainOuvre(new Date()))
    const updates = []
    for (const t of ordered) {
      const { debut, fin } = calculerFin(curDebut, t.duree_ouvree || 1, t.samedi_ouvre)
      updates.push({ id: t.id, date_debut: debut, date_fin: fin })
      curDebut = jourSuivantOuvre(fin, t.samedi_ouvre)
    }
    for (const u of updates) await supabase.from('taches').update({ date_debut: u.date_debut, date_fin: u.date_fin }).eq('id', u.id)
    if (updates.length) {
      const debutP = updates.reduce((m, u) => u.date_debut < m ? u.date_debut : m, updates[0].date_debut)
      const finP = updates.reduce((m, u) => u.date_fin > m ? u.date_fin : m, updates[0].date_fin)
      await supabase.from('projets').update({ date_debut: debutP, date_fin: finP }).eq('id', projet.id)
    }
    onChange()
  }

  const ajouterTache = async () => {
    if (!formTache.titre.trim()) return
    await supabase.from('taches').insert({
      projet_id: projet.id, titre: formTache.titre.trim(),
      duree_ouvree: Number(formTache.duree) || 1, samedi_ouvre: formTache.samedi,
      nb_personnes: 1, ordre: taches.length,
    })
    setNouvelleTache(false); setFormTache({ titre: '', duree: 2, samedi: false })
    const { data } = await supabase.from('taches').select('*').eq('projet_id', projet.id).order('ordre')
    replanifier(data || [])
  }

  const majTacheChamp = async (t, champ, val) => {
    await supabase.from('taches').update({ [champ]: val }).eq('id', t.id)
    if (champ === 'duree_ouvree' || champ === 'samedi_ouvre') {
      const { data } = await supabase.from('taches').select('*').eq('projet_id', projet.id).order('ordre')
      replanifier(data || [])
    } else onChange()
  }

  const supprimerTache = async (t) => {
    await supabase.from('taches').delete().eq('id', t.id)
    const { data } = await supabase.from('taches').select('*').eq('projet_id', projet.id).order('ordre')
    replanifier(data || [])
  }

  const toggleAllocation = async (t, persId) => {
    const existe = allocsDe(t.id).find((a) => a.personnel_id === persId)
    if (existe) await supabase.from('allocations').delete().eq('id', existe.id)
    else await supabase.from('allocations').insert({ tache_id: t.id, personnel_id: persId })
    onChange()
  }

  const creerEtAllouer = async () => {
    if (!creationPers?.nom?.trim()) return
    const couleurs = ['#1d4f9c', '#b8860b', '#1a6b1a', '#7b2d8e', '#0d7377', '#d84315']
    const { data: pers } = await supabase.from('personnel').insert({
      nom: creationPers.nom.trim(), metier: creationPers.metier || null,
      couleur: couleurs[personnel.length % couleurs.length],
    }).select().single()
    if (pers) await supabase.from('allocations').insert({ tache_id: creationPers.tacheId, personnel_id: pers.id })
    setCreationPers(null); onChange()
  }

  // Gantt
  const dates = taches.filter((t) => t.date_debut && t.date_fin)
  const debut = projet.date_debut, fin = projet.date_fin
  const total = joursEntre(debut, fin) || 1
  const pos = (d) => { const x = parseDate(d), d0 = parseDate(debut); return x && d0 ? ((x - d0) / jour / total) * 100 : 0 }

  return (
    <div className="carte">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>{projet.nom}</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>
            {projet.client_nom} {projet.adresse && `· ${projet.adresse}`}
            <br />
            <b style={{ color: 'var(--rouge)' }}>{fmtDate(projet.date_debut)} → {fmtDate(projet.date_fin)}</b>
            {' '}({joursEntre(projet.date_debut, projet.date_fin)} días corridos)
            <span style={{ color: '#999' }}> · fechas calculadas automáticamente (días laborables Bayern)</span>
          </p>
        </div>
        <button className="btn petit sec" onClick={onDelete}>Eliminar proyecto</button>
      </div>

      {dates.length > 0 && (
        <div style={{ marginTop: 18, overflowX: 'auto' }}>
          <div style={{ minWidth: 600 }}>
            {taches.map((t) => {
              if (!t.date_debut || !t.date_fin) return null
              const g = Math.max(0, pos(t.date_debut))
              const w = Math.max(1.5, pos(t.date_fin) - g + (100 / total))
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

      <h2 style={{ marginTop: 22 }}>Tareas / posiciones</h2>
      <table className="histo">
        <thead><tr><th>Tarea</th><th>Días lab.</th><th>Sáb.</th><th>Inicio</th><th>Fin</th><th>Equipo</th><th></th></tr></thead>
        <tbody>
          {taches.map((t) => (
            <tr key={t.id}>
              <td><input defaultValue={t.titre} style={{ fontSize: 13, minWidth: 160 }} onBlur={(e) => e.target.value !== t.titre && majTacheChamp(t, 'titre', e.target.value)} /></td>
              <td><input type="number" min="1" defaultValue={t.duree_ouvree} onBlur={(e) => Number(e.target.value) !== t.duree_ouvree && majTacheChamp(t, 'duree_ouvree', Number(e.target.value))} style={{ width: 55 }} /></td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={t.samedi_ouvre} onChange={(e) => majTacheChamp(t, 'samedi_ouvre', e.target.checked)} style={{ width: 'auto' }} /></td>
              <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{fmtDate(t.date_debut)}</td>
              <td style={{ whiteSpace: 'nowrap', fontSize: 12.5 }}>{fmtDate(t.date_fin)}</td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {personnel.map((p) => {
                    const actif = allocsDe(t.id).some((a) => a.personnel_id === p.id)
                    return (
                      <button key={p.id} onClick={() => toggleAllocation(t, p.id)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid ' + p.couleur, background: actif ? p.couleur : '#fff', color: actif ? '#fff' : p.couleur }}>
                        {p.nom}
                      </button>
                    )
                  })}
                  {creationPers?.tacheId === t.id ? (
                    <span style={{ display: 'inline-flex', gap: 4 }}>
                      <input autoFocus value={creationPers.nom} placeholder="nombre" onChange={(e) => setCreationPers({ ...creationPers, nom: e.target.value })}
                        onKeyDown={(e) => e.key === 'Enter' && creerEtAllouer()} style={{ width: 90, padding: '2px 6px', fontSize: 11 }} />
                      <button className="btn petit" onClick={creerEtAllouer}>✓</button>
                      <button className="btn petit sec" onClick={() => setCreationPers(null)}>✕</button>
                    </span>
                  ) : (
                    <button onClick={() => setCreationPers({ tacheId: t.id, nom: '', metier: '' })}
                      style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, cursor: 'pointer', border: '1px dashed #aaa', background: '#fff', color: '#888' }}>+ nuevo</button>
                  )}
                </div>
              </td>
              <td><button className="suppr" style={{ paddingTop: 0 }} onClick={() => supprimerTache(t)}>✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {nouvelleTache ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}><label>Tarea</label><input autoFocus value={formTache.titre} onChange={(e) => setFormTache({ ...formTache, titre: e.target.value })} /></div>
          <div><label>Días laborables</label><input type="number" min="1" value={formTache.duree} onChange={(e) => setFormTache({ ...formTache, duree: e.target.value })} style={{ width: 70 }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 9 }}>
            <input type="checkbox" id="sab" checked={formTache.samedi} onChange={(e) => setFormTache({ ...formTache, samedi: e.target.checked })} style={{ width: 'auto' }} />
            <label htmlFor="sab" style={{ margin: 0 }}>Trabaja sábado</label>
          </div>
          <button className="btn petit" onClick={ajouterTache}>Añadir</button>
        </div>
      ) : (
        <button className="btn sec petit" style={{ marginTop: 10 }} onClick={() => setNouvelleTache(true)}>+ Nueva tarea</button>
      )}
      <p style={{ fontSize: 11.5, color: '#999', marginTop: 10 }}>
        Las fechas se calculan en cadena a partir del inicio del proyecto, saltando domingos y festivos de Baviera (y sábados salvo si la tarea lo marca). El inicio y fin del proyecto se ajustan automáticamente.
      </p>
    </div>
  )
}
