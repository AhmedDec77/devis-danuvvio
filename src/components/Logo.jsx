export default function Logo({ width = 150 }) {
  const h = Math.round(width * 52 / 150)
  return (
    <svg width={width} height={h} viewBox="0 0 150 52" xmlns="http://www.w3.org/2000/svg">
      <g>
        <polygon points="2,22 30,4 36,8 10,25" fill="#c00000" />
        <polygon points="14,24 36,9 42,13 22,26" fill="#8a8a8a" />
        <polygon points="26,26 42,14 48,18 34,27" fill="#c00000" />
        <rect x="44" y="6" width="3" height="3" fill="#8a8a8a" />
        <rect x="48" y="6" width="3" height="3" fill="#8a8a8a" />
        <rect x="44" y="10" width="3" height="3" fill="#8a8a8a" />
        <rect x="48" y="10" width="3" height="3" fill="#8a8a8a" />
      </g>
      <text x="2" y="40" fontFamily="'Archivo', Helvetica, Arial" fontSize="13" fontWeight="bold" fill="#232323">Handwerker</text>
      <text x="2" y="51" fontFamily="'Archivo', Helvetica, Arial" fontSize="11.5" fontWeight="bold">
        <tspan fill="#c00000">Crispin </tspan><tspan fill="#232323">München</tspan>
      </text>
    </svg>
  )
}
