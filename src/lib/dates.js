// Helpers de dates pour le module de planification

export const jour = 864e5

export function parseDate(s) {
  if (!s) return null
  const d = new Date(s + 'T00:00:00')
  return isNaN(d) ? null : d
}

export function toISO(d) {
  return d.toISOString().slice(0, 10)
}

export function fmtDate(s) {
  const d = parseDate(s)
  return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'
}

export function joursEntre(a, b) {
  const da = parseDate(a), db = parseDate(b)
  if (!da || !db) return 0
  return Math.round((db - da) / jour) + 1
}

export function chevauche(d1a, d1b, d2a, d2b) {
  const a1 = parseDate(d1a), b1 = parseDate(d1b), a2 = parseDate(d2a), b2 = parseDate(d2b)
  if (!a1 || !b1 || !a2 || !b2) return false
  return a1 <= b2 && a2 <= b1
}

export const MOIS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
export const JOURS_SEM = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

// Lundi de la semaine d'une date
export function lundiDe(d) {
  const x = new Date(d)
  const j = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - j)
  x.setHours(0, 0, 0, 0)
  return x
}
