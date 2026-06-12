import logoUrl from '../assets/logo.png'

// Logo officiel Handwerker Crispin München (extrait des documents originaux, ratio 778×299)
export default function Logo({ width = 150 }) {
  return (
    <img
      src={logoUrl}
      width={width}
      height={Math.round(width * 299 / 778)}
      alt="Handwerker Crispin München"
      style={{ display: 'block' }}
    />
  )
}
