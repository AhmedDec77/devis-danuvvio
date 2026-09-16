import { useEffect, useRef, useState } from 'react'
import { fmt } from '../lib/supabase'
import { SOCIETE } from '../lib/societe.js'
import Logo from './Logo.jsx'
import { Groupe } from './DocumentAngebot.jsx'

const PAGE_MM = 297
const PX_PAR_MM = 96 / 25.4

// Types reconnus (compatibilité avec les anciens devis 30/40/30 déjà émis)
const TYPES_FINALE = ['schluss', 'rechnung']

export default function DocumentRechnung({ facture, devis, acomptesPrecedentes = [], nachtraege = [] }) {
  const ref = useRef(null)
  const [pages, setPages] = useState(1)

  const estFinale = TYPES_FINALE.includes(facture.type)

  useEffect(() => {
    const mesurer = () => {
      if (!ref.current) return
      const doc = ref.current
      const thead = doc.querySelector('table.doc-cadre > thead')
      const tfootSp = doc.querySelector('.doc-tfoot-espace')
      const hEcran = doc.scrollHeight / PX_PAR_MM
      const hTete = (thead?.offsetHeight || 0) / PX_PAR_MM
      const hPied = (tfootSp?.offsetHeight || 0) / PX_PAR_MM
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
  }, [facture, devis, nachtraege, acomptesPrecedentes])

  const date = new Date(facture.date_facture || Date.now()).toLocaleDateString('de-DE')
  const echeance = new Date(new Date(facture.date_facture || Date.now()).getTime() + 14 * 864e5).toLocaleDateString('de-DE')

  const titre = estFinale
    ? (facture.type === 'rechnung' ? 'RECHNUNG' : 'SCHLUSSRECHNUNG')
    : `ABSCHLAGSRECHNUNG Nr. ${facture.numero_acompte || ''}`

  // --- Regroupement des positions du devis (DIN 276 ou par ordre de saisie), identique au Kostenvoranschlag ---
  const groupes = []
  if (devis.mode_din) {
    const map = new Map()
    for (const l of devis.lignes || []) {
      const k = (l.din276 || '300') + '|' + (l.din276_libelle || 'Baukonstruktionen')
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(l)
    }
    for (const [k, ls] of [...map.entries()].sort()) {
      const [code, lib] = k.split('|')
      groupes.push({ code, lib, lignes: ls })
    }
  } else {
    groupes.push({ code: null, lib: null, lignes: devis.lignes || [] })
  }
  let pos = 0

  // --- Mention légale "Lohnkosten" : uniquement la main d'œuvre des positions d'origine (hors Nachträge) ---
  const arbeitNetto = (devis.lignes || []).reduce((s, l) => s + Number(l.quantite || 0) * Number(l.prix_unitaire || 0), 0)
  const arbeitBrutto = arbeitNetto * 1.19
  const arbeitMwst = arbeitBrutto - arbeitNetto

  const esParticular = (devis.client_civilite || 'Frau') !== 'Firma'

  return (
    <div className="doc" ref={ref} style={{ '--pages': pages }}>
      <table className="doc-cadre">
        <thead>
          <tr><td>
            <div className="doc-entete">
              <div className="doc-logo"><Logo width={150} /></div>
              <div className="doc-entete-droite">
                <div className="doc-grand-titre">{titre}</div>
                <div className="doc-numero">Nr. {facture.numero}</div>
                <div className="doc-coordonnees">
                  {SOCIETE.rue} · {SOCIETE.ville} · {SOCIETE.tel}<br />
                  {SOCIETE.email}
                </div>
              </div>
            </div>
            <div className="doc-trait-rouge" />
          </td></tr>
        </thead>
        <tfoot>
          <tr><td><div className="doc-tfoot-espace" /></td></tr>
        </tfoot>
        <tbody>
          <tr><td>
            <div className="doc-infos">
              <div>
                <div className="doc-info-titre">Auftraggeber / Bauherr:</div>
                {devis.client_civilite} {devis.client_prenom} {devis.client_nom}<br />
                {devis.client_adresse && <>{devis.client_adresse}<br /></>}
                {devis.client_ville}
              </div>
              <div>
                <div className="doc-info-titre">Bauvorhaben:</div>
                <b>{devis.titre || '—'}</b>
              </div>
              <div>
                <div className="doc-info-titre">Rechnungsdaten:</div>
                Rechnungsdatum: {date}<br />
                Rechnungs-Nr.: {facture.numero}<br />
                {facture.numero_client && <>Kunden-Nr.: {facture.numero_client}<br /></>}
                Kostenvoranschlag: Nr. {devis.numero}
              </div>
              <div>
                <div className="doc-info-titre">Zahlungsziel:</div>
                Fällig bis: <b>{echeance}</b><br />
                (14 Tage, ohne Abzug)
              </div>
            </div>

            {estFinale ? (
              <>
                <p className="doc-intro">
                  Sehr geehrte{devis.client_civilite === 'Herr' ? 'r Herr' : devis.client_civilite === 'Frau' ? ' Frau' : ''} {devis.client_nom},<br />
                  gemäß Kostenvoranschlag Nr. {devis.numero} vom Bauvorhaben <b>{devis.titre || '—'}</b> berechne
                  ich Ihnen die Schlussrechnung mit allen ausgeführten Positionen wie folgt:
                </p>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th className="pos">Pos</th>
                      <th>Bezeichnung</th>
                      <th style={{ width: 52 }}>Menge</th>
                      <th style={{ width: 58 }}>Einheit</th>
                      <th style={{ width: 80 }}>Gesamt €</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupes.map((g, gi) => (
                      <Groupe key={gi} g={g} startPos={() => ++pos} />
                    ))}
                    {nachtraege.map((n, i) => (
                      <tr key={'n' + i}>
                        <td>{++pos}</td>
                        <td colSpan="3">
                          <b>Nachtrag N{n.numero}</b>
                          <div className="desc-detail">{n.description}</div>
                        </td>
                        <td className="num">
                          <b>{Number(n.montant_ht) >= 0 ? '' : '− '}{fmt(Math.abs(n.montant_ht))} €</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="doc-totaux">
                  <table>
                    <tbody>
                      <tr><td>Summe Positionen Netto</td><td className="num">{fmt(facture.base_ht)} €</td></tr>
                      <tr><td>Mehrwertsteuer 19 %</td><td className="num">{fmt(facture.base_ht * 0.19)} €</td></tr>
                      <tr className="final"><td>Summe brutto</td><td className="num">{fmt(facture.base_ht * 1.19)} €</td></tr>
                    </tbody>
                  </table>
                </div>

                {acomptesPrecedentes.length > 0 && (
                  <>
                    <div className="doc-section-titre">Rechnungsaufstellung — Abschlagszahlungen</div>
                    <table className="doc-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Nettobetrag €</th>
                          <th>MwSt. 19 % €</th>
                          <th>Re.-Nummer</th>
                          <th style={{ width: 90 }}>Endbetrag €</th>
                        </tr>
                      </thead>
                      <tbody>
                        {acomptesPrecedentes.map((a, i) => (
                          <tr key={i}>
                            <td>{new Date(a.date_facture).toLocaleDateString('de-DE')}</td>
                            <td className="num">{fmt(a.montant_ht)}</td>
                            <td className="num">{fmt(a.tva)}</td>
                            <td>{a.numero}</td>
                            <td className="num">{fmt(a.ttc)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}

                <div className="doc-section-titre">Verbleibende Restforderung</div>
                <div className="doc-totaux">
                  <table>
                    <tbody>
                      <tr><td>Nettobetrag</td><td className="num">{fmt(facture.montant_ht)} €</td></tr>
                      <tr><td>MwSt. 19 %</td><td className="num">{fmt(facture.tva)} €</td></tr>
                      <tr className="final"><td>Rechnungsbetrag</td><td className="num">{fmt(facture.ttc)} €</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <p className="doc-intro">
                  Sehr geehrte{devis.client_civilite === 'Herr' ? 'r Herr' : devis.client_civilite === 'Frau' ? ' Frau' : ''} {devis.client_nom},<br />
                  gemäß Kostenvoranschlag Nr. {devis.numero} vom Bauvorhaben <b>{devis.titre || '—'}</b> berechne
                  ich Ihnen folgende Abschlagszahlung:
                </p>

                <table className="doc-table">
                  <thead>
                    <tr>
                      <th className="pos">Pos</th>
                      <th>Bezeichnung</th>
                      <th style={{ width: 95 }}>Betrag €</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>1</td>
                      <td>
                        <b>Abschlagszahlung Nr. {facture.numero_acompte || ''}</b>
                        <div className="desc-detail">
                          {nachtraege.length > 0
                            ? <>Auftragssumme gemäß Kostenvoranschlag Nr. {devis.numero} inkl. Nachträge N1–N{nachtraege.length}: {fmt(facture.base_ht)} € netto</>
                            : <>Auftragssumme gemäß Kostenvoranschlag Nr. {devis.numero}: {fmt(facture.base_ht)} € netto</>}
                          {'\n'}Davon {facture.pourcentage} %
                        </div>
                      </td>
                      <td className="num"><b>{fmt(facture.montant_ht)} €</b></td>
                    </tr>
                  </tbody>
                </table>

                <div className="doc-totaux">
                  <table>
                    <tbody>
                      <tr><td>Nettobetrag</td><td className="num">{fmt(facture.montant_ht)} €</td></tr>
                      <tr><td>MwSt. 19 %</td><td className="num">{fmt(facture.tva)} €</td></tr>
                      <tr className="final"><td>Rechnungsbetrag</td><td className="num">{fmt(facture.ttc)} €</td></tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="doc-section-titre">Zahlungshinweis</div>
            <div className="doc-legal">
              Zahlbar innerhalb von 14 Tagen ohne Abzug auf folgendes Konto:<br /><br />
              <b>{SOCIETE.titulaire}</b><br />
              {SOCIETE.banque} · IBAN: <b>{SOCIETE.iban}</b> · BIC: {SOCIETE.bic}<br /><br />
              Bitte geben Sie bei der Überweisung die Rechnungs-Nr. <b>{facture.numero}</b> an.
              {estFinale && <><br /><br />Mit Begleichung dieser Schlussrechnung ist das Bauvorhaben vollständig abgerechnet.
              Ich bedanke mich für Ihr Vertrauen und die angenehme Zusammenarbeit.</>}
            </div>

            {estFinale && (
              <div className="doc-legal" style={{ marginTop: 10 }}>
                Im Bruttobetrag sind {fmt(arbeitBrutto)} € Lohnkosten enthalten.<br />
                Die darin enthaltene Mehrwertsteuer beträgt {fmt(arbeitMwst)} €.
                {esParticular && <><br /><br />
                  Als Privatperson sind Sie gemäß § 14b Abs. 1 UStG verpflichtet, diese Rechnung
                  mindestens zwei Jahre lang aufzubewahren.
                </>}
              </div>
            )}
          </td></tr>
        </tbody>
      </table>

      <div className="doc-footer">
        {SOCIETE.nom} · {SOCIETE.titulaire} · {SOCIETE.rue} · {SOCIETE.ville}<br />
        Tel. {SOCIETE.tel} · {SOCIETE.banque} IBAN: {SOCIETE.iban} · BIC: {SOCIETE.bic} ·
        Betriebs-Nr: {SOCIETE.betriebsNr} · USt-IdNr. {SOCIETE.ustId}
      </div>
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
