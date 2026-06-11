import { fmt } from '../lib/supabase'

export default function DocumentAngebot({ numero, client, titre, lignes, totalHT, tva, ttc }) {
  const date = new Date().toLocaleDateString('de-DE')
  return (
    <div className="doc">
      <div className="doc-entete">
        <b>HANDWERKER CRISPIN München</b><br />
        Rudolfstraße 11<br />
        82152 Planegg<br />
        Telefon: 0176 / 34 388 949<br />
        E-Mail: handwerkercrispin@gmail.com
      </div>

      <h1 className="doc-titre">Kostenvoranschlag</h1>

      <div className="doc-meta">
        <div className="gauche">
          Datum: {date}<br />
          Auftrags-Nr.: {numero || ''}
        </div>
        <div className="client">
          An: {client.civilite} {client.prenom} {client.nom}<br />
          {client.adresse && <>{client.adresse}<br /></>}
          {client.ville}
        </div>
      </div>

      <p className="doc-intro">
        Sehr geehrte{client.civilite === 'Herr' ? 'r Herr' : ' ' + client.civilite} {client.nom},<br />
        vielen Dank für Ihre Anfrage. Ich unterbreite Ihnen für Ihre gewünschten
        {titre ? ` ${titre}s` : ''}arbeiten folgendes Angebot.
      </p>

      <table className="doc-table">
        <thead>
          <tr>
            <th className="pos">Pos</th>
            <th>Bezeichnung</th>
            <th style={{ width: 55 }}>Menge</th>
            <th style={{ width: 60 }}>Einheit</th>
            <th style={{ width: 75 }}>E-Preis</th>
            <th style={{ width: 85 }}>Gesamt €</th>
          </tr>
        </thead>
        <tbody>
          {titre && (
            <tr><td>1.0</td><td colSpan="5" style={{ fontWeight: 'bold' }}>{titre}</td></tr>
          )}
          {lignes.map((l, i) => (
            <tr key={i}>
              <td>{titre ? `1.${i + 1}` : i + 1}</td>
              <td className="desc-cell">{l.description}</td>
              <td className="num">{l.unite === 'pauschal' ? '' : l.quantite}</td>
              <td>{uniteLabel(l.unite)}</td>
              <td className="num">{l.unite === 'pauschal' ? '' : fmt(l.prix_unitaire) + ' €'}</td>
              <td className="num">{fmt(l.quantite * l.prix_unitaire)} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="doc-totaux">
        <table>
          <tbody>
            <tr><td>Nettobetrag</td><td className="num">{fmt(totalHT)} €</td></tr>
            <tr><td>zzgl. 19% MwSt.</td><td className="num">{fmt(tva)} €</td></tr>
            <tr className="final"><td>Gesamtbetrag</td><td className="num">{fmt(ttc)} €</td></tr>
          </tbody>
        </table>
      </div>

      <div className="doc-pied">
        Dieses Angebot ist 30 Tage gültig. Zahlbar innerhalb von 14 Tagen ohne Abzüge.<br /><br />
        Mit freundlichen Grüßen<br />
        Danuvvio Crispin Leon
      </div>
    </div>
  )
}

function uniteLabel(u) {
  return { pauschal: 'Pauschal', m2: 'm²', stunde: 'Std.', stk: 'Stk.', lfm: 'lfm' }[u] || u
}
