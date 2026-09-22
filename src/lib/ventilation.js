// Ventilation d'une position de devis/facture en trois natures (demande comptable) :
//   Leistung  = main-d'œuvre (Lohnkosten, Handwerkerleistung § 35a EStG)
//   Material  = matériaux détaillés : quantité × prix unitaire
//   Lieferung = livraison, montant séparé par position
// Source unique de calcul pour le formulaire, le Kostenvoranschlag et la Rechnung.

const n = (v) => Number(v || 0)

// Ancien format de matériau : { designation, reference, prix } (montant forfaitaire)
export const estMateriauAncien = (m) => m && (m.quantite === undefined || m.quantite === null) && m.prix !== undefined

export const montantMateriau = (m) =>
  estMateriauAncien(m) ? n(m.prix) : n(m.quantite) * n(m.prix_unitaire)

export const montantLeistung = (l) => n(l.quantite) * n(l.prix_unitaire)
export const montantMaterial = (l) => (l.materiaux || []).reduce((s, m) => s + montantMateriau(m), 0)
export const montantLieferung = (l) => (l.lieferung ? n(l.lieferung.prix) : 0)
export const totalLigne = (l) => montantLeistung(l) + montantMaterial(l) + montantLieferung(l)

export function ventiler(lignes = []) {
  const r = { leistung: 0, material: 0, lieferung: 0, total: 0 }
  for (const l of lignes) {
    r.leistung += montantLeistung(l)
    r.material += montantMaterial(l)
    r.lieferung += montantLieferung(l)
  }
  r.total = r.leistung + r.material + r.lieferung
  return r
}

// Convertit un matériau ancien format en 1 Stk. × prix (même montant) — utilisé à l'édition uniquement
export const normaliserMateriau = (m) =>
  estMateriauAncien(m)
    ? { designation: m.designation || '', reference: m.reference || '', quantite: 1, unite: 'stk', prix_unitaire: n(m.prix) }
    : m

export const UNITES_MATERIAL = [
  ['stk', 'Stk.'], ['m2', 'Qm'], ['lfm', 'lfm'], ['m3', 'm³'], ['kg', 'kg'], ['l', 'Liter'],
  ['sack', 'Sack'], ['eimer', 'Eimer'], ['rolle', 'Rolle'], ['pkt', 'Pkt.'], ['karton', 'Karton'],
]

