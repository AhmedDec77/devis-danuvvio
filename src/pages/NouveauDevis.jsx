import { useEffect, useMemo, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'
import DocumentAngebot from '../components/DocumentAngebot.jsx'

const TVA = 0.19

export default function NouveauDevis({ devisExistant, clientPrecharge }) {
  const [prestations, setPrestations] = useState([])
  const [client, setClient] = useState({ civilite: 'Frau', prenom: '', nom: '', adresse: '', ville: '' })
  const [projet, setProjet] = useState('')
  const [architecte, setArchitecte] = useState('')
  const [niveau, setNiveau] = useState('median')
  const [vueCatalogue, setVueCatalogue] = useState('categorie') // 'categorie' | 'din276'
  const [modeDin, setModeDin] = useState(false) // structure DIN du PDF
  const [lignes, setLignes] = useState([])
  const [apercu, setApercu] = useState(false)
  const [numero, setNumero] = useState(null)
  const [numeroClient, setNumeroClient] = useState(null)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    supabase.from('prestations').select('*').eq('actif', true).then(({ data }) => setPrestations(data || []))
  }, [])

  useEffect(() => {
    if (devisExistant) {
      setClient({
        civilite: devisExistant.client_civilite || 'Frau',
        prenom: devisExistant.client_prenom || '',
        nom: devisExistant.client_nom || '',
        adresse: devisExistant.client_adresse || '',
        ville: devisExistant.client_ville || '',
      })
      setProjet(devisExistant.titre || '')
      setArchitecte(devisExistant.architecte || '')
      setNiveau(devisExistant.niveau_prix || 'median')
      setModeDin(!!devisExistant.mode_din)
      setLignes(devisExistant.lignes || [])
      setNumero(devisExistant.numero)
      setNumeroClient(devisExistant.numero_client || null)
    }
  }, [devisExistant])

  useEffect(() => {
    if (clientPrecharge) {
      setClient({
        civilite: clientPrecharge.civilite || 'Frau',
        prenom: clientPrecharge.prenom || '',
        nom: clientPrecharge.nom || '',
        adresse: clientPrecharge.adresse || '',
        ville: clientPrecharge.ville || '',
      })
      setNumeroClient(clientPrecharge.numero || null)
      setProjet(''); setArchitecte(''); setLignes([]); setNumero(null); setEnregistre(false)
    }
  }, [clientPrecharge])

  const groupes = useMemo(() => {
    const map = {}
    for (const p of prestations) {
      const cle = vueCatalogue === 'din276'
        ? `KG ${p.din276 || '300'} — ${p.din276_libelle || 'Baukonstruktionen'}`
        : p.categorie
      if (!map[cle]) map[cle] = []
      map[cle].push(p)
    }
    return Object.fromEntries(Object.entries(map).sort())
  }, [prestations, vueCatalogue])

  const prixNiveau = (p, niv = niveau) => {
    const v = niv === 'bas' ? p.prix_bas : niv === 'haut' ? p.prix_haut : p.prix_median
    return v === null || v === undefined ? null : Number(v)
  }

  const ajouter = (p) => {
    setLignes([...lignes, {
      prestation_id: p.id,
      description: p.nom,
      quantite: 1,
      unite: p.unite,
      prix_unitaire: prixNiveau(p) ?? 0,
      din276: p.din276 || '300',
      din276_libelle: p.din276_libelle || 'Baukonstruktionen',
      materiaux: [],
    }])
    setEnregistre(false)
  }

  const ajouterLigneLibre = () => {
    setLignes([...lignes, {
      prestation_id: null, description: '', quantite: 1, unite: 'pauschal',
      prix_unitaire: 0, din276: '300', din276_libelle: 'Baukonstruktionen', materiaux: [],
    }])
  }

  const changerNiveau = (niv) => {
    setNiveau(niv)
    setLignes(lignes.map((l) => {
      const p = prestations.find((x) => x.id === l.prestation_id)
      const v = p ? prixNiveau(p, niv) : null
      return v !== null ? { ...l, prix_unitaire: v } : l
    }))
    setEnregistre(false)
  }

  const maj = (i, champ, val) => {
    const copie = [...lignes]
    copie[i] = { ...copie[i], [champ]: val }
    setLignes(copie); setEnregistre(false)
  }

  const ajouterMateriel = (i) => {
    const copie = [...lignes]
    copie[i] = { ...copie[i], materiaux: [...(copie[i].materiaux || []), { designation: '', reference: '', prix: 0 }] }
    setLignes(copie); setEnregistre(false)
  }

  const majMateriel = (i, j, champ, val) => {
    const copie = [...lignes]
    const mats = [...(copie[i].materiaux || [])]
    mats[j] = { ...mats[j], [champ]: val }
    copie[i] = { ...copie[i], materiaux: mats }
    setLignes(copie); setEnregistre(false)
  }

  const supprMateriel = (i, j) => {
    const copie = [...lignes]
    copie[i] = { ...copie[i], materiaux: copie[i].materiaux.filter((_, k) => k !== j) }
    setLignes(copie); setEnregistre(false)
  }

  const totalLigne = (l) =>
    Number(l.quantite || 0) * Number(l.prix_unitaire || 0) +
    (l.materiaux || []).reduce((s, m) => s + Number(m.prix || 0), 0)

  const totalHT = lignes.reduce((s, l) => s + totalLigne(l), 0)
  const tva = totalHT * TVA
  const ttc = totalHT + tva

  const enregistrer = async () => {
    let num = numero
    if (!num) {
      const { data } = await supabase.rpc('prochain_numero')
      num = data; setNumero(num)
    }
    let numClient = numeroClient
    if (client.nom) {
      const { data } = await supabase.rpc('obtenir_numero_client', {
        p_civilite: client.civilite, p_prenom: client.prenom, p_nom: client.nom,
        p_adresse: client.adresse, p_ville: client.ville,
      })
      if (data) { numClient = data; setNumeroClient(data) }
    }
    const payload = {
      numero: num,
      client_civilite: client.civilite, client_prenom: client.prenom, client_nom: client.nom,
      client_adresse: client.adresse, client_ville: client.ville,
      titre: projet, architecte, mode_din: modeDin, niveau_prix: niveau, numero_client: numClient,
      total_ht: totalHT, tva, total_ttc: ttc, lignes, statut: 'borrador',
    }
    if (devisExistant?.id) await supabase.from('devis').update(payload).eq('id', devisExistant.id)
    else {
      const { data: ex } = await supabase.from('devis').select('id').eq('numero', num).maybeSingle()
      if (ex) await supabase.from('devis').update(payload).eq('id', ex.id)
      else await supabase.from('devis').insert(payload)
    }
    setEnregistre(true)
  }

  const imprimer = async () => {
    if (!enregistre) await enregistrer()
    setApercu(true)
    setTimeout(() => window.print(), 350)
  }

  if (apercu) {
    return (
      <>
        <div className="page no-print" style={{ display: 'flex', gap: 10 }}>
          <button className="btn sec" onClick={() => setApercu(false)}>← Volver a editar</button>
          <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <DocumentAngebot numero={numero} numeroClient={numeroClient} client={client} architecte={architecte} projet={projet}
          lignes={lignes} totalHT={totalHT} tva={tva} ttc={ttc} modeDin={modeDin} />
      </>
    )
  }

  return (
    <div className="page">
      <div className="carte">
        <h2>1 · Cliente y proyecto</h2>
        <div className="grille">
          <div>
            <label>Tratamiento</label>
            <select value={client.civilite} onChange={(e) => setClient({ ...client, civilite: e.target.value })}>
              <option>Frau</option><option>Herr</option><option>Familie</option><option>Firma</option>
            </select>
          </div>
          <div><label>Nombre</label><input value={client.prenom} onChange={(e) => setClient({ ...client, prenom: e.target.value })} /></div>
          <div><label>Apellido *</label><input value={client.nom} onChange={(e) => setClient({ ...client, nom: e.target.value })} /></div>
          <div><label>Dirección</label><input value={client.adresse} placeholder="Calle y número" onChange={(e) => setClient({ ...client, adresse: e.target.value })} /></div>
          <div><label>CP y ciudad</label><input value={client.ville} placeholder="81379 München" onChange={(e) => setClient({ ...client, ville: e.target.value })} /></div>
          <div><label>Bauvorhaben / Proyecto</label><input value={projet} placeholder="Badezimmersanierung Wohnung..." onChange={(e) => setProjet(e.target.value)} /></div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label>Arquitecto/a (opcional — aparece en el PDF si está relleno)</label>
          <textarea rows="2" value={architecte} placeholder={"Barbara Di Gregorio, Dott. M.Arch\nrare office — Nymphenburger Str. 160, 80634 München"}
            onChange={(e) => setArchitecte(e.target.value)} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input id="modedin" type="checkbox" style={{ width: 'auto' }} checked={modeDin} onChange={(e) => setModeDin(e.target.checked)} />
          <label htmlFor="modedin" style={{ margin: 0, fontSize: 13, color: '#333' }}>
            Estructurar el PDF según <b>DIN 276 Kostengruppen</b> (como CASA Zellner)
          </label>
        </div>
      </div>

      <div className="carte">
        <h2>2 · Nivel de precio</h2>
        <div className="niveaux">
          {[['bas', 'Bajo', 'competitivo'], ['median', 'Medio', 'precio estándar'], ['haut', 'Alto', 'proyecto complejo']].map(([v, t, s]) => (
            <button key={v} className={niveau === v ? 'actif' : ''} onClick={() => changerNiveau(v)}>
              {t}<small>{s}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="carte">
        <h2>3 · Añadir trabajos</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className={'btn petit ' + (vueCatalogue === 'categorie' ? '' : 'sec')} onClick={() => setVueCatalogue('categorie')}>Por oficio</button>
          <button className={'btn petit ' + (vueCatalogue === 'din276' ? '' : 'sec')} onClick={() => setVueCatalogue('din276')}>Por DIN 276</button>
        </div>
        {Object.entries(groupes).map(([cat, items]) => (
          <div className="cat-bloc" key={cat}>
            <div className="cat-titre">{cat}</div>
            {items.map((p) => (
              <div className="prestation" key={p.id}>
                <span className="nom">{p.nom}</span>
                <span className="prix">{prixNiveau(p) !== null ? fmt(prixNiveau(p)) + ' €' : <i style={{ color: '#c00000' }}>precio a definir</i>}</span>
                <button className="btn petit" onClick={() => ajouter(p)}>+ Añadir</button>
              </div>
            ))}
          </div>
        ))}
        <button className="btn sec petit" onClick={ajouterLigneLibre}>+ Posición libre (texto manual)</button>
      </div>

      {lignes.length > 0 && (
        <div className="carte">
          <h2>4 · Posiciones del presupuesto</h2>
          {lignes.map((l, i) => (
            <div key={i} style={{ borderBottom: '2px solid #eee', padding: '12px 0' }}>
              <div className="ligne" style={{ borderBottom: 'none' }}>
                <textarea value={l.description} placeholder="Descripción en alemán (1ª línea = título en negrita)" onChange={(e) => maj(i, 'description', e.target.value)} />
                <input type="number" min="0" step="0.5" value={l.quantite} onChange={(e) => maj(i, 'quantite', e.target.value)} />
                <select value={l.unite} onChange={(e) => maj(i, 'unite', e.target.value)}>
                  <option value="pauschal">Pauschal</option><option value="m2">Qm</option>
                  <option value="stunde">Std.</option><option value="stk">Stk.</option><option value="lfm">lfm</option>
                </select>
                <input type="number" min="0" step="10" value={l.prix_unitaire} onChange={(e) => maj(i, 'prix_unitaire', e.target.value)} />
                <span className="total">{fmt(totalLigne(l))} €</span>
                <button className="suppr" onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>✕</button>
              </div>
              {(l.materiaux || []).map((m, j) => (
                <div key={j} style={{ display: 'grid', gridTemplateColumns: '1fr 200px 110px 34px', gap: 8, marginLeft: 24, marginTop: 6 }}>
                  <input value={m.designation} placeholder="Material (ej: Wakol Parkettkleber, 6 Eimer)" onChange={(e) => majMateriel(i, j, 'designation', e.target.value)} />
                  <input value={m.reference} placeholder="Referencia (ej: Art.-Nr. FW00065)" onChange={(e) => majMateriel(i, j, 'reference', e.target.value)} />
                  <input type="number" min="0" step="10" value={m.prix} placeholder="Precio €" onChange={(e) => majMateriel(i, j, 'prix', e.target.value)} />
                  <button className="suppr" onClick={() => supprMateriel(i, j)}>✕</button>
                </div>
              ))}
              <button className="btn sec petit" style={{ marginLeft: 24, marginTop: 8 }} onClick={() => ajouterMateriel(i)}>
                + Materialien und Lieferung
              </button>
            </div>
          ))}
          <div className="totaux">
            Zwischensumme: <b>{fmt(totalHT)} €</b><br />
            MwSt. 19%: <b>{fmt(tva)} €</b><br />
            <span className="ttc">Gesamt: {fmt(ttc)} €</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
            <button className="btn sec" onClick={enregistrer}>{enregistre ? '✓ Guardado' : 'Guardar'}</button>
            <button className="btn" disabled={!client.nom} onClick={imprimer}>Generar PDF</button>
          </div>
        </div>
      )}
    </div>
  )
}
