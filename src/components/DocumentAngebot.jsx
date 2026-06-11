import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib/supabase'
import Logo from './Logo.jsx'
import { SOCIETE } from '../lib/societe.js'

const PAGE_MM = 297            // hauteur A4
const PX_PAR_MM = 96 / 25.4    // conversion px ↔ mm à 96 dpi

export default function DocumentAngebot({ numero, numeroClient, client, architecte, projet, lignes, totalHT, tva, ttc, modeDin, validiteMois = 2 }) {
  const ref = useRef(null)
  const [pages, setPages] = useState(1)

  // Mesure la hauteur du contenu pour calculer le nombre de pages et placer les numéros
  useEffect(() => {
    const mesurer = () => {
      if (!ref.current) return
      const doc = ref.current
      const thead = doc.querySelector('table.doc-cadre > thead')
      const tfootSp = doc.querySelector('.doc-tfoot-espace')
      const hEcran = doc.scrollHeight / PX_PAR_MM            // hauteur du contenu (en-tête compté 1 fois)
      const hTete = (thead?.offsetHeight || 0) / PX_PAR_MM   // en-tête répété
      const hPied = (tfootSp?.offsetHeight || 0) / PX_PAR_MM // espace pied répété
      // À l'impression, l'en-tête + l'espace pied se répètent sur chaque page :
      // on itère jusqu'à ce que le nombre de pages soit stable.
      let p = Math.max(1, Math.ceil(hEcran / PAGE_MM))
      for (let k = 0; k < 5; k++) {
        const hImpression = hEcran + (p - 1) * (hTete + hPied)
        const np = Math.max(1, Math.ceil(hImpression / PAGE_MM))
        if (np === p) break
        p = np
      }
      setPages(p)
    }
    mesurer()
    const t = setTimeout(mesurer, 300)
    window.addEventListener('beforeprint', mesurer)
    return () => { clearTimeout(t); window.removeEventListener('beforeprint', mesurer) }
  }, [lignes, modeDin, architecte, projet])

  const today = new Date()
  const date = today.toLocaleDateString('de-DE')
  const validite = new Date(today.getFullYear(), today.getMonth() + validiteMois, today.getDate()).toLocaleDateString('de-DE')

  const groupes = []
  if (modeDin) {
    const map = new Map()
    for (const l of lignes) {
      const k = (l.din276 || '300') + '|' + (l.din276_libelle || 'Baukonstruktionen')
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(l)
    }
    for (const [k, ls] of [...map.entries()].sort()) {
      const [code, lib] = k.split('|')
      groupes.push({ code, lib, lignes: ls })
    }
  } else {
    groupes.push({ code: null, lib: null, lignes })
  }

  let pos = 0
  return (
    <div className="doc" ref={ref} style={{ '--pages': pages }}>
      <table className="doc-cadre">
        {/* En-tête répété sur chaque page imprimée */}
        <thead>
          <tr><td>
            <div className="doc-entete">
              <div className="doc-logo"><Logo width={130} /></div>
              <div className="doc-entete-droite">
                <div className="doc-grand-titre">KOSTENVORANSCHLAG</div>
                <div className="doc-numero">Nr. {numero}</div>
                <div className="doc-coordonnees">
                  {SOCIETE.rue} · {SOCIETE.ville} · {SOCIETE.tel} · {SOCIETE.email}
                </div>
              </div>
            </div>
            <div className="doc-trait-rouge" />
          </td></tr>
        </thead>
        {/* Réserve l'espace du pied de page sur chaque page imprimée */}
        <tfoot>
          <tr><td><div className="doc-tfoot-espace" /></td></tr>
        </tfoot>
        <tbody>
          <tr><td>
            {modeDin && <div className="doc-sous-titre">Strukturiert nach DIN 276 Kostengruppen</div>}

            <div className="doc-infos">
              <div>
                <div className="doc-info-titre">Auftraggeber / Bauherr:</div>
                {client.civilite} {client.prenom} {client.nom}<br />
                {client.adresse && <>{client.adresse}<br /></>}
                {client.ville}
              </div>
              {architecte && (
                <div>
                  <div className="doc-info-titre">Planung / Architekt:in:</div>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{architecte}</span>
                </div>
              )}
              <div>
                <div className="doc-info-titre">Bauvorhaben:</div>
                <b>{projet || '—'}</b>
              </div>
              <div>
                <div className="doc-info-titre">Angebotsdaten:</div>
                Datum: {date}<br />
                Angebots-Nr.: {numero}<br />
                {numeroClient && <>Kunden-Nr.: {numeroClient}<br /></>}
                Gültig bis: {validite}
              </div>
            </div>

            <p className="doc-intro">
              Sehr geehrte{client.civilite === 'Herr' ? 'r Herr' : client.civilite === 'Frau' ? ' Frau' : ''} {client.nom},<br />
              vielen Dank für Ihr Vertrauen. Hiermit unterbreite ich Ihnen folgendes Angebot
              {projet ? <> für das Bauvorhaben <b>{projet}</b></> : ''}. Alle Leistungen werden fachgerecht
              nach den anerkannten Regeln der Technik ausgeführt.
            </p>

            <table className="doc-table">
              <thead>
                <tr>
                  <th className="pos">Pos</th>
                  <th>Bezeichnung</th>
                  <th style={{ width: 52 }}>Menge</th>
                  <th style={{ width: 58 }}>Einheit</th>
                  <th style={{ width: 68 }}>E-Preis</th>
                  <th style={{ width: 80 }}>Gesamt €</th>
                </tr>
              </thead>
              <tbody>
                {groupes.map((g, gi) => (
                  <Groupe key={gi} g={g} startPos={() => ++pos} />
                ))}
              </tbody>
            </table>

            <div className="doc-totaux">
              <table>
                <tbody>
                  <tr><td>Zwischensumme</td><td className="num">{fmt(totalHT)} €</td></tr>
                  <tr><td>MwSt. 19 %</td><td className="num">{fmt(tva)} €</td></tr>
                  <tr className="final"><td>Gesamt</td><td className="num">{fmt(ttc)} €</td></tr>
                </tbody>
              </table>
            </div>

            <div className="doc-section-titre">Zahlungsbedingungen</div>
            <div className="doc-legal">
              Die Zahlung erfolgt nach Baufortschritt in drei Raten:<br />
              • Abschlagszahlung 1 (30 %) bei Auftragserteilung und Arbeitsbeginn<br />
              • Abschlagszahlung 2 (40 %) nach Fertigstellung der Rohbau- und Vorbereitungsarbeiten<br />
              • Schlusszahlung (30 %) nach gemeinsamer Abnahme und Mängelbeseitigung<br /><br />
              Skonto: Bei Zahlung innerhalb von 10 Tagen nach Rechnungsdatum gewähre ich 2 % Skonto.
              Bei Zahlung innerhalb von 30 Tagen ohne Abzug.
            </div>

            <div className="doc-section-titre">Hinweise</div>
            <div className="doc-legal">
              Dieses Angebot ist bis zum {validite} gültig. Zusätzliche Leistungen, die nicht in diesem Angebot
              enthalten sind, werden nach vorheriger Abstimmung gesondert berechnet. Unvorhersehbare Mehrleistungen
              (z. B. verdeckte Schäden am Untergrund) werden vor Ausführung angezeigt und freigegeben.
              Es gelten die Bestimmungen der VOB/B bzw. des BGB-Werkvertragsrechts.
            </div>

            <div className="doc-section-titre">Annahme des Angebots</div>
            <div className="doc-legal">
              Mit Unterzeichnung und Rücksendung dieses Angebots gelten die vorstehenden Bedingungen als angenommen.
            </div>
            <div className="doc-signatures">
              <div>
                <div className="doc-ligne-signature" />
                Ort, Datum, Unterschrift Auftraggeber
              </div>
              <div>
                <div className="doc-ligne-signature" />
                Ort, Datum, Unterschrift Auftragnehmer
              </div>
            </div>
          </td></tr>
        </tbody>
      </table>

      {/* Pied de page fixe — répété sur chaque page imprimée */}
      <div className="doc-footer">
        {SOCIETE.nom} · {SOCIETE.titulaire} · {SOCIETE.rue} · {SOCIETE.ville}<br />
        Tel. {SOCIETE.tel} · {SOCIETE.banque} IBAN: {SOCIETE.iban} · BIC: {SOCIETE.bic} ·
        Betriebs-Nr: {SOCIETE.betriebsNr} · USt-IdNr. {SOCIETE.ustId}
      </div>

      {/* Numéros de page — positionnés en bas à droite de chaque page A4 */}
      <div className="doc-pages-nums">
        {Array.from({ length: pages }, (_, i) => (
          <div key={i} className="doc-num-page" style={{ top: `calc(${(i + 1) * PAGE_MM}mm - 7.5mm)` }}>
            Seite {i + 1} / {pages}
          </div>
        ))}
      </div>
    </div>
  )
}

function Groupe({ g, startPos }) {
  return (
    <>
      {g.code && (
        <tr className="doc-groupe">
          <td>{g.code !== '000' ? g.code : ''}</td>
          <td colSpan="5" style={{ textAlign: 'right', fontWeight: 'bold' }}>{g.lib}</td>
        </tr>
      )}
      {g.lignes.map((l, i) => {
        const n = startPos()
        const numPos = g.code && g.code !== '000' ? `${g.code}.${String(i + 1).padStart(2, '0')}` : n
        return <Ligne key={i} l={l} numPos={numPos} />
      })}
    </>
  )
}

function Ligne({ l, numPos }) {
  const [titre, ...reste] = String(l.description || '').split('\n')
  return (
    <>
      <tr>
        <td>{numPos}</td>
        <td><b>{titre}</b>{reste.length > 0 && <div className="desc-detail">{reste.join('\n')}</div>}</td>
        <td className="num">{l.unite === 'pauschal' ? '' : l.quantite}</td>
        <td>{uniteLabel(l.unite)}</td>
        <td className="num">{l.unite === 'pauschal' ? '' : fmt(l.prix_unitaire) + ' €'}</td>
        <td className="num"><b>{fmt(l.quantite * l.prix_unitaire)} €</b></td>
      </tr>
      {(l.materiaux || []).map((m, j) => (
        <tr key={j} className="doc-materiel">
          <td></td>
          <td colSpan="4">
            <i>Materialien und Lieferung: {m.designation}{m.reference ? ` (${m.reference})` : ''}</i>
          </td>
          <td className="num"><i>{fmt(m.prix)} €</i></td>
        </tr>
      ))}
    </>
  )
}

function uniteLabel(u) {
  return { pauschal: 'Pauschal', m2: 'Qm', stunde: 'Std.', stk: 'Stk.', lfm: 'lfm' }[u] || u
}
