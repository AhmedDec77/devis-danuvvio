import { fmt } from '../lib/supabase'
import { SOCIETE } from '../lib/societe.js'
import Logo from './Logo.jsx'

const TITRES = {
  abschlag1: 'ABSCHLAGSRECHNUNG Nr. 1',
  abschlag2: 'ABSCHLAGSRECHNUNG Nr. 2',
  schluss: 'SCHLUSSRECHNUNG',
}
const LIBELLES = {
  abschlag1: 'Abschlagszahlung 1 (30 % der Auftragssumme) — bei Auftragserteilung und Arbeitsbeginn',
  abschlag2: 'Abschlagszahlung 2 (40 % der Auftragssumme) — nach Fertigstellung der Rohbau- und Vorbereitungsarbeiten',
  schluss: 'Schlusszahlung (30 % der Auftragssumme) — nach gemeinsamer Abnahme und Mängelbeseitigung',
}
const TITRES_R = { rechnung: 'RECHNUNG' }

export default function DocumentRechnung({ facture, devis, facturesPrecedentes = [], nachtraege = [] }) {
  const date = new Date(facture.date_facture || Date.now()).toLocaleDateString('de-DE')
  const echeance = new Date(new Date(facture.date_facture || Date.now()).getTime() + 14 * 864e5).toLocaleDateString('de-DE')
  const estSchluss = facture.type === 'schluss'
  const estRechnung = facture.type === 'rechnung'

  return (
    <div className="doc">
      <table className="doc-cadre">
        <thead>
          <tr><td>
            <div className="doc-entete">
              <div className="doc-logo"><Logo width={150} /></div>
              <div className="doc-entete-droite">
                <div className="doc-grand-titre">{TITRES[facture.type] || 'RECHNUNG'}</div>
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

            <p className="doc-intro">
              Sehr geehrte{devis.client_civilite === 'Herr' ? 'r Herr' : devis.client_civilite === 'Frau' ? ' Frau' : ''} {devis.client_nom},<br />
              gemäß Kostenvoranschlag Nr. {devis.numero} vom Bauvorhaben <b>{devis.titre || '—'}</b> berechne
              ich Ihnen {estSchluss ? 'die Schlusszahlung wie folgt' : estRechnung ? 'folgende Rechnung' : 'folgende Abschlagszahlung'}:
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
                {estRechnung && (
                  <tr>
                    <td>1</td>
                    <td>
                      <b>Erbrachte Leistungen gemäß Kostenvoranschlag Nr. {devis.numero}</b>
                      <div className="desc-detail">
                        {nachtraege.length > 0
                          ? <>Gesamte Bauleistung inkl. Nachträge N1–N{nachtraege.length} gemäß Auftrag.</>
                          : <>Gesamte Bauleistung gemäß Auftrag.</>}
                      </div>
                    </td>
                    <td className="num"><b>{fmt(facture.montant_ht)} €</b></td>
                  </tr>
                )}
                {!estSchluss && !estRechnung && (
                  <tr>
                    <td>1</td>
                    <td>
                      <b>{LIBELLES[facture.type]}</b>
                      <div className="desc-detail">
                        {nachtraege.length > 0
                          ? <>Auftragssumme gemäß Kostenvoranschlag Nr. {devis.numero} inkl. Nachträge N1–N{nachtraege.length}: {fmt(facture.base_ht)} € netto</>
                          : <>Auftragssumme gemäß Kostenvoranschlag Nr. {devis.numero}: {fmt(facture.base_ht)} € netto</>}
                        {'\n'}Davon {facture.pourcentage} %
                      </div>
                    </td>
                    <td className="num"><b>{fmt(facture.montant_ht)} €</b></td>
                  </tr>
                )}
                {estSchluss && (
                  <>
                    <tr>
                      <td>1</td>
                      <td><b>Gesamtleistung gemäß Kostenvoranschlag Nr. {devis.numero}</b>
                        <div className="desc-detail">{LIBELLES.schluss}</div>
                      </td>
                      <td className="num">{fmt(devis.total_ht)} €</td>
                    </tr>
                    {nachtraege.map((n, i) => (
                      <tr key={'n' + i}>
                        <td>{2 + i}</td>
                        <td><b>Nachtrag N{n.numero}</b>
                          <div className="desc-detail">{n.description}</div>
                        </td>
                        <td className="num">{Number(n.montant_ht) >= 0 ? '' : '− '}{fmt(Math.abs(n.montant_ht))} €</td>
                      </tr>
                    ))}
                    {nachtraege.length > 0 && (
                      <tr>
                        <td></td>
                        <td><b>Auftragssumme inkl. Nachträge (netto)</b></td>
                        <td className="num"><b>{fmt(facture.base_ht)} €</b></td>
                      </tr>
                    )}
                    {facturesPrecedentes.map((f, i) => (
                      <tr key={i} className="doc-materiel">
                        <td></td>
                        <td><i>abzüglich {f.type === 'abschlag1' ? 'Abschlagsrechnung Nr. 1' : 'Abschlagsrechnung Nr. 2'} ({f.numero} vom {new Date(f.date_facture).toLocaleDateString('de-DE')})</i></td>
                        <td className="num"><i>− {fmt(f.montant_ht)} €</i></td>
                      </tr>
                    ))}
                    <tr>
                      <td></td>
                      <td><b>Verbleibender Restbetrag (netto)</b></td>
                      <td className="num"><b>{fmt(facture.montant_ht)} €</b></td>
                    </tr>
                  </>
                )}
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

            <div className="doc-section-titre">Zahlungshinweis</div>
            <div className="doc-legal">
              Zahlbar innerhalb von 14 Tagen ohne Abzug auf folgendes Konto:<br /><br />
              <b>{SOCIETE.titulaire}</b><br />
              {SOCIETE.banque} · IBAN: <b>{SOCIETE.iban}</b> · BIC: {SOCIETE.bic}<br /><br />
              Bitte geben Sie bei der Überweisung die Rechnungs-Nr. <b>{facture.numero}</b> an.
              {estSchluss && <><br /><br />Mit Begleichung dieser Schlussrechnung ist das Bauvorhaben vollständig abgerechnet.
              Ich bedanke mich für Ihr Vertrauen und die angenehme Zusammenarbeit.</>}
            </div>
          </td></tr>
        </tbody>
      </table>

      <div className="doc-footer">
        {SOCIETE.nom} · {SOCIETE.titulaire} · {SOCIETE.rue} · {SOCIETE.ville}<br />
        Tel. {SOCIETE.tel} · {SOCIETE.banque} IBAN: {SOCIETE.iban} · BIC: {SOCIETE.bic} ·
        Betriebs-Nr: {SOCIETE.betriebsNr} · USt-IdNr. {SOCIETE.ustId}
      </div>
      <div className="doc-pages-nums">
        <div className="doc-num-page" style={{ top: 'calc(297mm - 7.5mm)' }}>Seite 1 / 1</div>
      </div>
    </div>
  )
}
