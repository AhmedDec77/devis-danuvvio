import { useEffect, useMemo, useState } from 'react'
import { supabase, fmt } from '../lib/supabase'
import DocumentAngebot from '../components/DocumentAngebot.jsx'

const TVA = 0.19

export default function NouveauDevis({ devisExistant }) {
  const [prestations, setPrestations] = useState([])
  const [client, setClient] = useState({ civilite: 'Frau', prenom: '', nom: '', adresse: '', ville: '' })
  const [titre, setTitre] = useState('')
  const [niveau, setNiveau] = useState('median')
  const [lignes, setLignes] = useState([])
  const [apercu, setApercu] = useState(false)
  const [numero, setNumero] = useState(null)
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
      setTitre(devisExistant.titre || '')
      setNiveau(devisExistant.niveau_prix || 'median')
      setLignes(devisExistant.lignes || [])
      setNumero(devisExistant.numero)
    }
  }, [devisExistant])

  const categories = useMemo(() => {
    const map = {}
    for (const p of prestations) {
      if (!map[p.categorie]) map[p.categorie] = []
      map[p.categorie].push(p)
    }
    return map
  }, [prestations])

  const prixNiveau = (p, niv = niveau) =>
    niv === 'bas' ? Number(p.prix_bas) : niv === 'haut' ? Number(p.prix_haut) : Number(p.prix_median)

  const ajouter = (p) => {
    setLignes([...lignes, {
      prestation_id: p.id,
      description: p.nom,
      quantite: 1,
      unite: p.unite,
      prix_unitaire: prixNiveau(p),
    }])
    setEnregistre(false)
  }

  const changerNiveau = (niv) => {
    setNiveau(niv)
    setLignes(lignes.map((l) => {
      const p = prestations.find((x) => x.id === l.prestation_id)
      return p ? { ...l, prix_unitaire: prixNiveau(p, niv) } : l
    }))
    setEnregistre(false)
  }

  const maj = (i, champ, val) => {
    const copie = [...lignes]
    copie[i] = { ...copie[i], [champ]: val }
    setLignes(copie)
    setEnregistre(false)
  }

  const totalHT = lignes.reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0)
  const tva = totalHT * TVA
  const ttc = totalHT + tva

  const enregistrer = async () => {
    let num = numero
    if (!num) {
      const { data } = await supabase.rpc('prochain_numero')
      num = data
      setNumero(num)
    }
    const payload = {
      numero: num,
      client_civilite: client.civilite, client_prenom: client.prenom, client_nom: client.nom,
      client_adresse: client.adresse, client_ville: client.ville,
      titre, niveau_prix: niveau,
      total_ht: totalHT, tva, total_ttc: ttc,
      lignes, statut: 'brouillon',
    }
    if (devisExistant?.id) {
      await supabase.from('devis').update(payload).eq('id', devisExistant.id)
    } else {
      const { data: existant } = await supabase.from('devis').select('id').eq('numero', num).maybeSingle()
      if (existant) await supabase.from('devis').update(payload).eq('id', existant.id)
      else await supabase.from('devis').insert(payload)
    }
    setEnregistre(true)
  }

  const imprimer = async () => {
    if (!enregistre) await enregistrer()
    setApercu(true)
    setTimeout(() => window.print(), 300)
  }

  if (apercu) {
    return (
      <>
        <div className="page no-print" style={{ display: 'flex', gap: 10 }}>
          <button className="btn sec" onClick={() => setApercu(false)}>← Volver a editar</button>
          <button className="btn" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <DocumentAngebot numero={numero} client={client} titre={titre} lignes={lignes}
          totalHT={totalHT} tva={tva} ttc={ttc} />
      </>
    )
  }

  return (
    <div className="page">
      <div className="carte">
        <h2>1 · Cliente</h2>
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
          <div><label>Título del proyecto</label><input value={titre} placeholder="Badezimmersanierung" onChange={(e) => setTitre(e.target.value)} /></div>
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
        {Object.entries(categories).map(([cat, items]) => (
          <div className="cat-bloc" key={cat}>
            <div className="cat-titre">{cat}</div>
            {items.map((p) => (
              <div className="prestation" key={p.id}>
                <span className="nom">{p.nom}</span>
                <span className="prix">{fmt(prixNiveau(p))} €</span>
                <button className="btn petit" onClick={() => ajouter(p)}>+ Añadir</button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {lignes.length > 0 && (
        <div className="carte">
          <h2>4 · Posiciones del presupuesto</h2>
          <div className="ligne" style={{ fontWeight: 'bold', fontSize: 12, color: '#666' }}>
            <span>Descripción (alemán — aparece en el PDF)</span><span>Cant.</span><span>Unidad</span><span>Precio €</span><span></span>
          </div>
          {lignes.map((l, i) => (
            <div className="ligne" key={i}>
              <textarea value={l.description} onChange={(e) => maj(i, 'description', e.target.value)} />
              <input type="number" min="0" step="0.5" value={l.quantite} onChange={(e) => maj(i, 'quantite', e.target.value)} />
              <select value={l.unite} onChange={(e) => maj(i, 'unite', e.target.value)}>
                <option value="pauschal">Pauschal</option><option value="m2">m²</option>
                <option value="stunde">Std.</option><option value="stk">Stk.</option><option value="lfm">lfm</option>
              </select>
              <input type="number" min="0" step="10" value={l.prix_unitaire} onChange={(e) => maj(i, 'prix_unitaire', e.target.value)} />
              <span className="total">{fmt(l.quantite * l.prix_unitaire)} €</span>
              <button className="suppr" onClick={() => setLignes(lignes.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div className="totaux">
            Netto: <b>{fmt(totalHT)} €</b><br />
            MwSt. 19%: <b>{fmt(tva)} €</b><br />
            <span className="ttc">Gesamtbetrag: {fmt(ttc)} €</span>
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
