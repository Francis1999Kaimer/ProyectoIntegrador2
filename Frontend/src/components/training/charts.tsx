import type { EpochLog } from '../../training/types'

/** Gráfica de línea por época (sin dependencias). */
export function MetricChart({ title, history, metric, epochs, format, color }: {
  title: string; history: EpochLog[]; metric: 'accuracy' | 'loss'; epochs: number; format: (value: number) => string; color: string
}) {
  const width = 320, height = 150, left = 44, right = 10, top = 12, bottom = 26
  const values = history.map(item => item[metric])
  const max = metric === 'accuracy' ? 1 : Math.max(0.1, ...values) * 1.1
  const x = (epoch: number) => left + (epochs <= 1 ? 0 : (epoch - 1) / (epochs - 1)) * (width - left - right)
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom)
  const points = history.map(item => `${x(item.epoch).toFixed(1)},${y(item[metric]).toFixed(1)}`).join(' ')
  const last = history.at(-1)
  return <figure className="metric-chart">
    <figcaption><span>{title}</span><strong>{last ? format(last[metric]) : '—'}</strong></figcaption>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} por época`}>
      {[0, 0.5, 1].map(f => <g key={f}>
        <line x1={left} x2={width - right} y1={y(max * f)} y2={y(max * f)} className="chart-grid" />
        <text x={left - 6} y={y(max * f) + 4} textAnchor="end" className="chart-axis">{format(max * f)}</text>
      </g>)}
      <text x={left} y={height - 6} className="chart-axis">1</text>
      <text x={width - right} y={height - 6} textAnchor="end" className="chart-axis">{epochs}</text>
      <text x={(left + width - right) / 2} y={height - 6} textAnchor="middle" className="chart-axis">Época</text>
      {history.length > 1 && <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" />}
      {history.map(item => <circle key={item.epoch} cx={x(item.epoch)} cy={y(item[metric])} r="3" fill={color} />)}
    </svg>
  </figure>
}

export function Bar({ value, label }: { value: number; label?: string }) {
  return <div className="bar" role="img" aria-label={label ?? `${Math.round(value * 100)} %`}><div className="bar-fill" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }} /></div>
}
