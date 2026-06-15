import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseDate, toISO, fmtDate, joursEntre, MOIS, JOURS_SEM, jour } from '../lib/dates'
import { calculerFin, prochainOuvre } from '../lib/feries'

// Teinte douce dérivée d'une couleur vive (mélange avec du blanc)
function douce(hex, ratio = 0.55) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const m = (c) => Math.round(c + (255 - c) * ratio)
  return `rgb(${m(r)}, ${m(g)}, ${m(b)})`
}

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

    // Tâches depuis les positions : toutes démarrent au début projet, 2 jours estimés (Danuvvio ajuste ensuite)
    if (proj && devis?.lignes?.length) {
      const { fin } = calculerFin(debut, 2, false)
      const rows = devis.lignes.map((l, i) => ({
        projet_id: proj.id,
        titre: String(l.description || '').split('\n')[0].slice(0, 80),
        date_debut: debut, date_fin: fin, duree_ouvree: 2, samedi_ouvre: false,
        nb_personnes: 1, ordre: i,
      }))
      await supabase.from('taches').insert(rows)
    }
    setNouveauProjet(null); await charger()
    if (proj) { setSelection(proj.id); setTimeout(() => recadrer(proj.id), 200) }
  }

  // Recadre les bornes du projet sur min/max des tâches
  const recadrer = async (projetId) => {
    const { data } = await supabase.from('taches').select('date_debut, date_fin').eq('projet_id', projetId)
    const valides = (data || []).filter((t) => t.date_debut && t.date_fin)
    if (!valides.length) return
    const debut = valides.reduce((m, t) => t.date_debut < m ? t.date_debut : m, valides[0].date_debut)
    const fin = valides.reduce((m, t) => t.date_fin > m ? t.date_fin : m, valides[0].date_fin)
    await supabase.from('projets').update({ date_debut: debut, date_fin: fin }).eq('id', projetId)
    charger()
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
          personnel={personnel} allocations={allocations} onChange={charger} onRecadrer={() => recadrer(projetSel.id)} onDelete={() => supprimerProjet(projetSel)} />
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
                  style={{ fontSize: 10, background: douce(p.couleur || '#c00000', 0.25), color: '#fff', borderRadius: 3, padding: '1px 4px', marginBottom: 2, cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', outline: selection === p.id ? '1.5px solid #232323' : 'none' }}>
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

function DetailProjet({ projet, taches, personnel, allocations, onChange, onRecadrer, onDelete }) {
  const [nouvelleTache, setNouvelleTache] = useState(false)
  const [formTache, setFormTache] = useState({ titre: '', date_debut: projet.date_debut, duree: 2, samedi: false })
  const [creationPers, setCreationPers] = useState(null)

  const allocsDe = (tId) => allocations.filter((a) => a.tache_id === tId)
  const persDe = (tId) => allocsDe(tId).map((a) => personnel.find((p) => p.id === a.personnel_id)).filter(Boolean)

  const ajouterTache = async () => {
    if (!formTache.titre.trim()) return
    const debut = formTache.date_debut || projet.date_debut || toISO(new Date())
    const { fin } = calculerFin(debut, Number(formTache.duree) || 1, formTache.samedi)
    await supabase.from('taches').insert({
      projet_id: projet.id, titre: formTache.titre.trim(),
      date_debut: debut, date_fin: fin,
      duree_ouvree: Number(formTache.duree) || 1, samedi_ouvre: formTache.samedi,
      nb_personnes: 1, ordre: taches.length,
    })
    setNouvelleTache(false); setFormTache({ titre: '', date_debut: projet.date_debut, duree: 2, samedi: false })
    await onChange(); onRecadrer()
  }

  // Changement date début OU durée → recalcule la date de fin
  const majDebutOuDuree = async (t, champ, val) => {
    const debut = champ === 'date_debut' ? val : t.date_debut
    const duree = champ === 'duree_ouvree' ? Number(val) : Number(t.duree_ouvree || 1)
    const sam = champ === 'samedi_ouvre' ? val : t.samedi_ouvre
    if (!debut) { // pas de date de début : on stocke juste le champ
      await supabase.from('taches').update({ [champ]: val }).eq('id', t.id)
      await onChange(); return
    }
    const { fin } = calculerFin(debut, duree || 1, sam)
    await supabase.from('taches').update({ [champ]: val, date_fin: fin }).eq('id', t.id)
    await onChange(); onRecadrer()
  }

  // Date de fin modifiée à la main → on la garde telle quelle (ne touche pas à la durée)
  const majFinManuelle = async (t, val) => {
    await supabase.from('taches').update({ date_fin: val }).eq('id', t.id)
    await onChange(); onRecadrer()
  }

  const majTitre = async (t, val) => {
    await supabase.from('taches').update({ titre: val }).eq('id', t.id); onChange()
  }

  const supprimerTache = async (t) => {
    await supabase.from('taches').delete().eq('id', t.id)
    await onChange(); onRecadrer()
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
      nom: creationPers.nom.trim(), couleur: couleurs[personnel.length % couleurs.length],
    }).select().single()
    if (pers) await supabase.from('allocations').insert({ tache_id: creationPers.tacheId, personnel_id: pers.id })
    setCreationPers(null); onChange()
  }

  // ---- Gantt ----
  const dates = taches.filter((t) => t.date_debut && t.date_fin)
  const debut = projet.date_debut, fin = projet.date_fin
  const total = Math.max(1, joursEntre(debut, fin))
  // position en % du bord gauche d'un jour
  const posJour = (d) => {
    const x = parseDate(d), d0 = parseDate(debut)
    return x && d0 ? (Math.round((x - d0) / jour) / total) * 100 : 0
  }
  const couleurGantt = douce(projet.couleur || '#c00000', 0.5)
  const couleurPoint = projet.couleur || '#c00000'

  return (
    <div className="carte">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0 }}>{projet.nom}</h2>
          <p style={{ fontSize: 13, color: '#666', margin: '4px 0 0' }}>
            {projet.client_nom} {projet.adresse && `· ${projet.adresse}`}
            <br />
            <b style={{ color: 'var(--rouge)' }}>{fmtDate(projet.date_debut)} → {fmtDate(projet.date_fin)}</b>
            {' '}({joursEntre(projet.date_debut, projet.date_fin)} días)
          </p>
        </div>
        <button className="btn petit sec" onClick={onDelete}>Eliminar proyecto</button>
      </div>

      {/* Gantt */}
      {dates.length > 0 && (
        <div style={{ marginTop: 18, overflowX: 'auto' }}>
          <div style={{ minWidth: 640 }}>
            {taches.map((t) => {
              if (!t.date_debut || !t.date_fin) return null
              const g = Math.max(0, Math.min(99, posJour(t.date_debut)))
              const finPct = Math.min(100, posJour(t.date_fin) + (100 / total)) // inclut le dernier jour
              const w = Math.max(1.5, finPct - g)
              const ps = persDe(t.id)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 190, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={t.titre}>{t.titre}</div>
                  <div style={{ flex: 1, position: 'relative', height: 24, background: '#f4f1ec', borderRadius: 5 }}>
                    {/* barre */}
                    <div style={{ position: 'absolute', left: `${g}%`, width: `${w}%`, height: 24, background: couleurGantt, borderRadius: 5, display: 'flex', alignItems: 'center', paddingLeft: 16, gap: 3 }}>
                      {ps.map((p) => <span key={p.id} title={p.nom} style={{ width: 11, height: 11, borderRadius: '50%', background: douce(p.couleur, 0.15), border: '1.5px solid #fff' }} />)}
                    </div>
                    {/* point de départ */}
                    <div title={'Inicio: ' + fmtDate(t.date_debut)}
                      style={{ position: 'absolute', left: `calc(${g}% - 5px)`, top: 6, width: 12, height: 12, borderRadius: '50%', background: couleurPoint, border: '2px solid #fff', boxShadow: '0 0 0 1px ' + couleurPoint }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <h2 style={{ marginTop: 22 }}>Tareas / posiciones</h2>
      <table className="histo">
        <thead><tr><th>Tarea</th><th>Inicio</th><th>Días</th><th>Sáb.</th><th>Fin (auto / editable)</th><th>Equipo</th><th></th></tr></thead>
        <tbody>
          {taches.map((t) => (
            <tr key={t.id}>
              <td><input defaultValue={t.titre} style={{ fontSize: 13, minWidth: 150 }} onBlur={(e) => e.target.value !== t.titre && majTitre(t, e.target.value)} /></td>
              <td><input type="date" value={t.date_debut || ''} onChange={(e) => majDebutOuDuree(t, 'date_debut', e.target.value)} style={{ width: 130 }} /></td>
              <td><input type="number" min="1" value={t.duree_ouvree || 1} onChange={(e) => majDebutOuDuree(t, 'duree_ouvree', Math.max(1, Number(e.target.value) || 1))} style={{ width: 50 }} /></td>
              <td style={{ textAlign: 'center' }}><input type="checkbox" checked={t.samedi_ouvre} onChange={(e) => majDebutOuDuree(t, 'samedi_ouvre', e.target.checked)} style={{ width: 'auto' }} /></td>
              <td><input type="date" value={t.date_fin || ''} onChange={(e) => majFinManuelle(t, e.target.value)} style={{ width: 130 }} /></td>
              <td>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  {personnel.map((p) => {
                    const actif = allocsDe(t.id).some((a) => a.personnel_id === p.id)
                    return (
                      <button key={p.id} onClick={() => toggleAllocation(t, p.id)}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, cursor: 'pointer', border: '1px solid ' + p.couleur, background: actif ? douce(p.couleur, 0.15) : '#fff', color: actif ? '#fff' : p.couleur }}>
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
                    <button onClick={() => setCreationPers({ tacheId: t.id, nom: '' })}
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
          <div style={{ flex: 1, minWidth: 160 }}><label>Tarea</label><input autoFocus value={formTache.titre} onChange={(e) => setFormTache({ ...formTache, titre: e.target.value })} /></div>
          <div><label>Inicio</label><input type="date" value={formTache.date_debut || ''} onChange={(e) => setFormTache({ ...formTache, date_debut: e.target.value })} /></div>
          <div><label>Días</label><input type="number" min="1" value={formTache.duree} onChange={(e) => setFormTache({ ...formTache, duree: e.target.value })} style={{ width: 60 }} /></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingBottom: 9 }}>
            <input type="checkbox" id="sab" checked={formTache.samedi} onChange={(e) => setFormTache({ ...formTache, samedi: e.target.checked })} style={{ width: 'auto' }} />
            <label htmlFor="sab" style={{ margin: 0 }}>Sábado</label>
          </div>
          <button className="btn petit" onClick={ajouterTache}>Añadir</button>
        </div>
      ) : (
        <button className="btn sec petit" style={{ marginTop: 10 }} onClick={() => setNouvelleTache(true)}>+ Nueva tarea</button>
      )}
      <p style={{ fontSize: 11.5, color: '#999', marginTop: 10 }}>
        Elige la fecha de inicio de cada tarea. La fecha de fin se calcula con los días estimados (días laborables Bayern), pero puedes modificarla a mano si hay días sin actividad. El inicio y fin del proyecto se ajustan solos.
      </p>
    </div>
  )
}
