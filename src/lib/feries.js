// Jours fériés Bayern (Munich) + calcul de dates ouvrées
import { parseDate, toISO, jour } from './dates'

// Calcul de Pâques (algorithme de Gauss/Meeus) → renvoie un Date
function paques(annee) {
  const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mois = Math.floor((h + l - 7 * m + 114) / 31)
  const jourM = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(annee, mois - 1, jourM)
}

const cacheFeries = {}

// Ensemble des jours fériés Bayern pour une année (clés ISO 'YYYY-MM-DD')
export function feriesBayern(annee) {
  if (cacheFeries[annee]) return cacheFeries[annee]
  const p = paques(annee)
  const ajoute = (base, n) => toISO(new Date(base.getTime() + n * jour))
  const set = new Set([
    `${annee}-01-01`,           // Neujahr
    `${annee}-01-06`,           // Heilige Drei Könige (Bayern)
    ajoute(p, -2),              // Karfreitag
    ajoute(p, 1),               // Ostermontag
    `${annee}-05-01`,           // Tag der Arbeit
    ajoute(p, 39),              // Christi Himmelfahrt
    ajoute(p, 50),              // Pfingstmontag
    ajoute(p, 60),              // Fronleichnam (Bayern)
    `${annee}-08-15`,           // Mariä Himmelfahrt (Bayern, large part)
    `${annee}-10-03`,           // Tag der Deutschen Einheit
    `${annee}-11-01`,           // Allerheiligen (Bayern)
    `${annee}-12-25`,           // 1. Weihnachtstag
    `${annee}-12-26`,           // 2. Weihnachtstag
  ])
  cacheFeries[annee] = set
  return set
}

export function estFerie(d) {
  return feriesBayern(d.getFullYear()).has(toISO(d))
}

// Un jour est-il ouvré ? dim = jamais ; sam = seulement si samediOuvre ; férié = jamais
export function estOuvre(d, samediOuvre = false) {
  const jourSem = d.getDay() // 0 = dim, 6 = sam
  if (jourSem === 0) return false
  if (jourSem === 6 && !samediOuvre) return false
  return !estFerie(d)
}

// Avance jusqu'au prochain jour ouvré (inclus)
export function prochainOuvre(d, samediOuvre = false) {
  const x = new Date(d)
  while (!estOuvre(x, samediOuvre)) x.setDate(x.getDate() + 1)
  return x
}

// À partir d'une date de début et d'une durée en jours ouvrés, renvoie {debut, fin} en ISO
export function calculerFin(debutISO, dureeOuvree, samediOuvre = false) {
  let cur = prochainOuvre(parseDate(debutISO), samediOuvre)
  const debut = toISO(cur)
  let restant = Math.max(1, dureeOuvree)
  // le premier jour ouvré compte pour 1
  while (restant > 1) {
    cur.setDate(cur.getDate() + 1)
    if (estOuvre(cur, samediOuvre)) restant--
  }
  return { debut, fin: toISO(cur) }
}

// Jour ouvré suivant la fin d'une tâche (point de départ de la tâche suivante)
export function jourSuivantOuvre(finISO, samediOuvre = false) {
  const x = parseDate(finISO)
  x.setDate(x.getDate() + 1)
  return toISO(prochainOuvre(x, samediOuvre))
}

// Compte les jours ouvrés entre deux dates incluses
export function dureeOuvree(debutISO, finISO, samediOuvre = false) {
  let cur = parseDate(debutISO)
  const fin = parseDate(finISO)
  let n = 0
  while (cur <= fin) {
    if (estOuvre(cur, samediOuvre)) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}
