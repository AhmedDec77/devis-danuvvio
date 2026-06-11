import { fmt } from '../lib/supabase'

const SOCIETE = {
  nom: 'Handwerker Crispin München',
  titulaire: 'Danuvvio Milwaukee Crispin Leon',
  rue: 'Rudolfstraße 11',
  ville: '82152 Planegg',
  tel: '0176 / 34 388 949',
  email: 'handwerkercrispin@gmail.com',
  iban: 'DE85 7601 0085 0179 4088 57',
  bic: 'PBNKDEFF',
  banque: 'Postbank',
  betriebsNr: '7164410',
  ustId: '144/184/50267',
}

function Logo() {
  return (
    <svg width="150" height="52" viewBox="0 0 150 52" xmlns="http://www.w3.org/2000/svg">
      <g>
        <polygon points="2,22 30,4 36,8 10,25" fill="#c00000" />
        <polygon points="14,24 36,9 42,13 22,26" fill="#8a8a8a" />
        <polygon points="26,26 42,14 48,18 34,27" fill="#c00000" />
        <rect x="44" y="6" width="3" height="3" fill="#8a8a8a" />
        <rect x="48" y="6" width="3" height="3" fill="#8a8a8a" />
        <rect x="44" y="10" width="3" height="3" fill="#8a8a8a" />
        <rect x="48" y="10" width="3" height="3" fill="#8a8a8a" />
      </g>
      <text x="2" y="40" fontFamily="Helvetica, Arial" fontSize="13" fontWeight="bold" fill="#1a1a1a">Handwerker</text>
      <text x="2" y="51" fontFamily="Helvetica, Arial" fontSize="11.5" fontWeight="bold">
        <tspan fill="#c00000">Crispin </tspan><tspan fill="#1a1a1a">München</tspan>
      </text>
    </svg>
  )
}

export default function DocumentAngebot({ numero, client, architecte, projet, lignes, totalHT, tva, ttc, modeDin, validiteMois = 2 }) {
  const today = new Date()
  const date = today.toLocaleDateString('de-DE')
  const validite = new Date(today.getFullYear(), today.getMonth() + validiteMois, today.getDate()).toLocaleDateString('de-DE')

  // group lines by DIN group when modeDin
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
    <div className="doc">
      {/* En-tête */}
      <div className="doc-entete">
        <div className="doc-logo"><Logo /></div>
        <div className="doc-entete-droite">
          <div className="doc-grand-titre">KOSTENVORANSCHLAG</div>
          <div className="doc-numero">Nr. {numero}</div>
          {modeDin && <div className="doc-sous-titre">Strukturiert nach DIN 276 Kostengruppen</div>}
          <div className="doc-coordonnees">
            {SOCIETE.rue} · {SOCIETE.ville} · {SOCIETE.tel}<br />
            {SOCIETE.email}
          </div>
        </div>
      </div>
      <div className="doc-trait-rouge" />

      {/* Bloc info 4 colonnes */}
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
          Gültig bis: {validite}
        </div>
      </div>

      <p className="doc-intro">
        Sehr geehrte{client.civilite === 'Herr' ? 'r Herr' : client.civilite === 'Frau' ? ' Frau' : ''} {client.nom},<br />
        vielen Dank für Ihr Vertrauen. Hiermit unterbreite ich Ihnen folgendes Angebot
        {projet ? <> für das Bauvorhaben <b>{projet}</b></> : ''}. Alle Leistungen werden fachgerecht
        nach den anerkannten Regeln der Technik ausgeführt.
      </p>

      {/* Tableau */}
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

      {/* Totaux */}
      <div className="doc-totaux">
        <table>
          <tbody>
            <tr><td>Zwischensumme</td><td className="num">{fmt(totalHT)} €</td></tr>
            <tr><td>MwSt. 19 %</td><td className="num">{fmt(tva)} €</td></tr>
            <tr className="final"><td>Gesamt</td><td className="num">{fmt(ttc)} €</td></tr>
          </tbody>
        </table>
      </div>

      {/* Zahlungsbedingungen */}
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

      {/* Pied de page imprimé sur chaque page */}
      <div className="doc-footer">
        {SOCIETE.nom} · {SOCIETE.titulaire} · {SOCIETE.rue} · {SOCIETE.ville}<br />
        Tel. {SOCIETE.tel} · {SOCIETE.banque} IBAN: {SOCIETE.iban} · BIC: {SOCIETE.bic}<br />
        Betriebs-Nr: {SOCIETE.betriebsNr} · USt-IdNr. {SOCIETE.ustId}
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
        return (
          <Ligne key={i} l={l} numPos={numPos} />
        )
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
